import { Application, Router } from 'express';
import { stagingEmailDiagnosticHandler } from '../controllers/stagingEmailDiagnostic.controller';
import { DiagnosticEnvironment, isStagingEmailDiagnosticEnabled } from '../stagingEmailDiagnosticPolicy';

export const stagingEmailDiagnosticRouter = Router();
stagingEmailDiagnosticRouter.post('/email-diagnostic', stagingEmailDiagnosticHandler);

/** Mount only after validating the exact staging Render service identity. */
export function mountStagingEmailDiagnosticRoute(
  app: Pick<Application, 'use'>,
  env: DiagnosticEnvironment = process.env,
): boolean {
  if (!isStagingEmailDiagnosticEnabled(env)) return false;
  app.use('/api/internal/staging', stagingEmailDiagnosticRouter);
  return true;
}
