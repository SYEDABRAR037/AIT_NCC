import { Router, Request, Response } from 'express';
import { generateAuthenticAnswer, ChatMessage } from '../services/aiAssistant.service';

const router = Router();

/**
 * POST /api/assistant/chat
 * Publicly accessible AI Cadet Assistant endpoint (grounded on verified facts & online research)
 */
router.post('/chat', async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'A valid question or message is required.',
      });
      return;
    }

    const chatHistory: ChatMessage[] = Array.isArray(history) ? history : [];
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
