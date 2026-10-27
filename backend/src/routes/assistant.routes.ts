import { Router, Request, Response, NextFunction } from 'express';
import { generateAuthenticAnswer, ChatMessage } from '../services/aiAssistant.service';
import { ProcessLocalRateLimitStore } from '../services/rateLimitStore';

const router = Router();

// Process-local fallback: deployment-wide enforcement requires a shared store.
const aiRequestBuckets = new ProcessLocalRateLimitStore(10_000);

const aiRateLimiter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const ip = (req.ip || req.socket.remoteAddress || 'unknown').toString();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 10;
  let result;
  try {
    result = await aiRequestBuckets.consume(ip, maxRequests, windowMs);
  } catch {
    res.status(503).json({ success: false, message: 'Request protection is temporarily unavailable.' });
    return;
  }

  if (result.limited) {
    res.setHeader('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)));
    res.status(429).json({
      success: false,
      message: 'Too many requests. Please wait a moment before asking again.',
    });
    return;
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
