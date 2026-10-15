import { Router, Request, Response, NextFunction } from 'express';
import { generateAuthenticAnswer, ChatMessage } from '../services/aiAssistant.service';

const router = Router();

// In-memory sliding window rate limiter: 10 requests per 60 seconds per IP (DEF-04)
const aiRequestBuckets = new Map<string, number[]>();

const aiRateLimiter = (req: Request, res: Response, next: NextFunction): void => {
  const ip = (req.ip || req.socket.remoteAddress || 'unknown').toString();
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 10;

  const timestamps = (aiRequestBuckets.get(ip) || []).filter((time) => now - time < windowMs);

  if (timestamps.length >= maxRequests) {
    const oldestTimestamp = timestamps[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldestTimestamp + windowMs - now) / 1000));
    res.setHeader('Retry-After', retryAfterSec.toString());
    res.status(429).json({
      success: false,
      message: 'Too many requests. Please wait a moment before asking again.',
    });
    return;
  }

  timestamps.push(now);
  aiRequestBuckets.set(ip, timestamps);

  // Periodic memory cleanup if bucket gets large
  if (aiRequestBuckets.size > 2000) {
    for (const [key, times] of aiRequestBuckets.entries()) {
      const active = times.filter((t) => now - t < windowMs);
      if (active.length === 0) {
        aiRequestBuckets.delete(key);
      } else {
        aiRequestBuckets.set(key, active);
      }
    }
  }

  next();
};

/**
 * POST /api/assistant/chat
 * Publicly accessible AI Cadet Assistant endpoint (grounded on verified facts & online research)
 * DEF-04: Protected by IP rate limit (10 req/min) and request-size validation.
 */
router.post('/chat', aiRateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'A valid question or message is required.',
      });
      return;
    }

    // DEF-04: Request size validation
    if (message.trim().length > 2000) {
      res.status(400).json({
        success: false,
        message: 'Message exceeds maximum allowed length of 2,000 characters.',
      });
      return;
    }

    const rawHistory: unknown[] = Array.isArray(history) ? history : [];
    if (rawHistory.length > 50) {
      res.status(400).json({
        success: false,
        message: 'Conversation history is too long. Please start a new session.',
      });
      return;
    }

    // Validate and sanitize each history item
    const chatHistory: ChatMessage[] = rawHistory
      .filter(
        (item): item is { role: string; content: string } =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as Record<string, unknown>).role === 'string' &&
          typeof (item as Record<string, unknown>).content === 'string',
      )
      .map((item) => ({
        role: item.role === 'model' ? 'model' : 'user',
        content: String(item.content).slice(0, 2000),
      })) as ChatMessage[];

    const result = await generateAuthenticAnswer(message.trim(), chatHistory);

    res.json({
      success: true,
      answer: result.answer,
      sources: result.sources,
      researchedOnline: result.researchedOnline,
      topicCategory: result.topicCategory,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('AI Assistant API error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process inquiry. Please check your connection.',
    });
  }
});

export default router;
