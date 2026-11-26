import crypto from 'node:crypto';
import { Request, Response } from 'express';
import { ProcessLocalRateLimitStore, RateLimitStore } from '../services/rateLimitStore';
import { sendOtpEmail } from '../services/mail.service';
import { DiagnosticEnvironment, isStagingEmailDiagnosticEnabled, isValidDiagnosticAuthorization } from '../stagingEmailDiagnosticPolicy';

const AUTH_LIMIT = 5;
const AUTH_WINDOW_MS = 10 * 60_000;

interface SendAttemptState { attempted: boolean; }
interface DiagnosticDependencies {
  env: () => DiagnosticEnvironment;
  rateLimitStore: RateLimitStore;
  sendEmail: typeof sendOtpEmail;
  state: SendAttemptState;
}

// Shared by the single mounted handler for the lifetime of this Node process.
const processSendState: SendAttemptState = { attempted: false };
const processRateLimitStore = new ProcessLocalRateLimitStore(1_000);

const genericFailure = { success: false, message: 'Staging email diagnostic is unavailable.' };

export function createStagingEmailDiagnosticHandler(dependencies: Partial<DiagnosticDependencies> = {}) {
  const deps: DiagnosticDependencies = {
    env: dependencies.env || (() => process.env),
    rateLimitStore: dependencies.rateLimitStore || processRateLimitStore,
    sendEmail: dependencies.sendEmail || sendOtpEmail,
    state: dependencies.state || processSendState,
  };

  return async (req: Request, res: Response): Promise<void> => {
    const env = deps.env();
    if (!isStagingEmailDiagnosticEnabled(env)) {
      res.status(404).json(genericFailure);
      return;
    }

    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const rate = await deps.rateLimitStore.consume(`staging-email-diagnostic:${ip}`, AUTH_LIMIT, AUTH_WINDOW_MS);
    if (rate.limited) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil(rate.retryAfterMs / 1000))));
      res.status(429).json(genericFailure);
      return;
    }

    const authorization = req.get('x-ncc-staging-diagnostic-secret');
    if (!isValidDiagnosticAuthorization(env, authorization)) {
      res.status(401).json(genericFailure);
      return;
    }

    // The endpoint accepts no request payload. Recipient and code are always
    // server-generated/configured and cannot be selected by a caller.
    const hasPayload = req.body !== undefined && req.body !== null
      && (typeof req.body !== 'object' || Object.keys(req.body).length > 0);
    if (hasPayload) {
      res.status(400).json(genericFailure);
      return;
    }

    if (deps.state.attempted) {
      res.status(409).json(genericFailure);
      return;
    }
    // Set synchronously before awaiting provider I/O: concurrent requests in
    // this process can never trigger a second send. Keep consumed on failure
    // because provider acceptance can be ambiguous after a network timeout.
    deps.state.attempted = true;

    const diagnosticCode = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    try {
      const result = await deps.sendEmail({
        recipientEmail: env.NCC_STAGING_EMAIL_DIAGNOSTIC_RECIPIENT!.trim(),
        cadetName: 'NCC staging email diagnostic',
        otp: diagnosticCode,
        purpose: 'login',
      });
      if (!result.success) {
        res.status(503).json(genericFailure);
        return;
      }
      res.status(202).json({ success: true, message: 'Diagnostic email accepted for the configured staging inbox.' });
    } catch {
      // Provider details, recipient and diagnostic code are deliberately omitted.
      res.status(503).json(genericFailure);
    }
  };
}

export const stagingEmailDiagnosticHandler = createStagingEmailDiagnosticHandler();
