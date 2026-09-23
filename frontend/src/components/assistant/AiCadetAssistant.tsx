import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  Shield,
  Search,
  RefreshCw,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  researchedOnline?: boolean;
  topicCategory?: string;
  timestamp: string;
}

const INITIAL_WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome-msg',
  role: 'assistant',
  content: `### 🇮🇳 Jai Hind, Cadet!
I am **Command Saathi**, the official Cadet Assistant for the NCC Detachment at **Army Institute of Technology, Pune (2 Maharashtra Bn NCC)**.

How can I help you today? You can ask about:
• **Weapon Training** (.22 Deluxe Rifle, 7.62 SLR, firing grouping)
• **Regimental Drill** (Hindi words of command, turnout inspection)
• **Certificates & SSB** ('B' & 'C' cert exams, direct OTA SSB entries)
• **Camps & Selection** (RDC, TSC, YEP, CATC)
• **AIT Pune Procedures** (Circular facial attendance, leave rules)`,
  sources: ['Directorate General NCC (DGNCC) Handbooks', 'AIT Pune NCC SOP'],
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
};

const QUICK_PROMPTS = [
  'What is the caliber & effective range of .22 Deluxe Rifle?',
  "What are the benefits of NCC 'C' Certificate in Indian Army SSB?",
  'How does the Live Circular Face Attendance system work at AIT?',
  'What are the official Hindi words of command for Savdhan & Vishram?',
  'What is the eligibility & selection process for Republic Day Camp (RDC)?',
  'What are the uniform and turnout rules for DMS boots & beret hackle?',
];

export const AiCadetAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_WELCOME_MESSAGE]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setLoading(true);

    try {
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: historyPayload,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        const assistantMsg: ChatMessage = {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content: data.answer,
          sources: data.sources || [],
          researchedOnline: data.researchedOnline,
          topicCategory: data.topicCategory,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        const errorMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ **Communication Link Error**: Unable to retrieve verified defense records. Please try again.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch (err) {
      console.error('AI Assistant Fetch Error:', err);
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Network Advisory**: Connection to the Command Assistant server timed out. Please check your network and retry.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Fixed instant reset without blocking popup
  const clearChat = () => {
    setIsRefreshing(true);
    setMessages([
      {
        ...INITIAL_WELCOME_MESSAGE,
        id: `welcome-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setInputMessage('');
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Helper to parse inline markdown tokens: **bold**, *italic*, `code`
  const renderInlineMarkdown = (text: string, isUser: boolean): React.ReactNode => {
    if (!text) return null;
    const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
    const parts = text.split(tokenRegex);

    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        return (
          <strong
            key={index}
            style={{
              fontWeight: 700,
              color: isUser ? '#FFFFFF' : '#0A192F',
            }}
          >
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        return (
          <code
            key={index}
            style={{
              background: isUser ? 'rgba(255,255,255,0.2)' : '#F1F5F9',
              padding: '1px 5px',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontSize: '0.85em',
              color: isUser ? '#E0E7FF' : '#1E3A8A',
            }}
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
        return (
          <em key={index} style={{ fontStyle: 'italic' }}>
            {part.slice(1, -1)}
          </em>
        );
      }
      return part;
    });
  };

  // Structured and arranged message content renderer
  const renderFormattedContent = (content: string, isUser: boolean): React.ReactNode => {
    const lines = content
      .split('\n')
      .filter((line) => !line.toLowerCase().includes('verification note'));

    return lines.map((rawLine, idx) => {
      const line = rawLine.trim();

      // Empty line spacer
      if (!line) {
        return <div key={idx} style={{ height: '6px' }} />;
      }

      // Horizontal divider: --- or ***
      if (line === '---' || line === '***' || line === '___') {
        return (
          <div
            key={idx}
            style={{
              height: '1px',
              background: isUser ? 'rgba(255,255,255,0.2)' : '#E2E8F0',
              margin: '8px 0',
            }}
          />
        );
      }

      // Main section headers: ### Header or ## Header
      if (line.startsWith('### ') || line.startsWith('## ')) {
        const cleanHeader = line.replace(/^#{2,3}\s+/, '').replace(/^\*\*|\*\*$/g, '').trim();
        return (
          <div
            key={idx}
            style={{
              margin: '10px 0 6px',
              padding: '6px 10px',
              background: isUser ? 'rgba(255,255,255,0.12)' : 'linear-gradient(90deg, #F1F5F9 0%, #FFFFFF 100%)',
              borderLeft: '3px solid #D4AF37',
              borderRadius: '0 6px 6px 0',
              fontWeight: 800,
              fontSize: '0.92rem',
              color: isUser ? '#FFFFFF' : '#0A192F',
              letterSpacing: '0.01em',
            }}
          >
            {renderInlineMarkdown(cleanHeader, isUser)}
          </div>
        );
      }

      // Subheaders: #### Header or standalone bold header line like **Technical Parameters:**
      const isBoldHeader =
        line.startsWith('#### ') ||
        (/^\*\*[^*]+:\*\*$/.test(line)) ||
        (/^\*\*[^*]+\*\*$/.test(line) && line.length < 65);

      if (isBoldHeader) {
        const cleanSub = line.replace(/^####\s+/, '').replace(/^\*\*|\*\*$/g, '').trim();
        return (
          <div
            key={idx}
            style={{
              margin: '8px 0 4px',
              fontWeight: 700,
              fontSize: '0.85rem',
              color: isUser ? '#93C5FD' : '#1E3A8A',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#D4AF37',
                flexShrink: 0,
              }}
            />
            <span>{renderInlineMarkdown(cleanSub, isUser)}</span>
          </div>
        );
      }

      // Bullet points: •, -, *, +
      if (/^[•\-*+]\s+/.test(line)) {
        const cleanBullet = line.replace(/^[•\-*+]\s+/, '');
        return (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              margin: '3px 0',
              paddingLeft: '2px',
              fontSize: '0.84rem',
              lineHeight: '1.5',
            }}
          >
            <span
              style={{
                color: isUser ? '#93C5FD' : '#D4AF37',
                fontWeight: 800,
                fontSize: '0.85rem',
                lineHeight: '1.4',
                flexShrink: 0,
              }}
            >
              ▸
            </span>
            <div style={{ flex: 1 }}>
              {renderInlineMarkdown(cleanBullet, isUser)}
            </div>
          </div>
        );
      }

      // Numbered lists: 1. 2. 3.
      const numMatch = line.match(/^(\d+)\.\s+(.*)/);
      if (numMatch) {
        return (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              margin: '4px 0',
              paddingLeft: '2px',
              fontSize: '0.84rem',
              lineHeight: '1.5',
            }}
          >
            <span
              style={{
                minWidth: '18px',
                height: '18px',
                borderRadius: '50%',
                background: isUser ? 'rgba(255,255,255,0.2)' : 'rgba(30, 58, 138, 0.1)',
                color: isUser ? '#FFFFFF' : '#1E3A8A',
                fontSize: '0.68rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '2px',
              }}
            >
              {numMatch[1]}
            </span>
            <div style={{ flex: 1 }}>
              {renderInlineMarkdown(numMatch[2], isUser)}
            </div>
          </div>
        );
      }

      // Blockquote: > text
      if (line.startsWith('> ')) {
        return (
          <div
            key={idx}
            style={{
              background: isUser ? 'rgba(255,255,255,0.08)' : '#F8FAFC',
              borderLeft: '3px solid #3B82F6',
              padding: '6px 10px',
              margin: '6px 0',
              fontSize: '0.8rem',
              color: isUser ? '#E2E8F0' : '#334155',
              borderRadius: '0 4px 4px 0',
              fontStyle: 'italic',
            }}
          >
            {renderInlineMarkdown(line.replace('> ', ''), isUser)}
          </div>
        );
      }

      // Standard text line
      return (
        <div
          key={idx}
          style={{
            margin: '2px 0',
            fontSize: '0.85rem',
            lineHeight: '1.55',
            color: isUser ? '#FFFFFF' : '#1E293B',
          }}
        >
          {renderInlineMarkdown(line, isUser)}
        </div>
      );
    });
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9990,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
        }}
      >
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            id="open-ai-assistant-btn"
            title="Command Saathi — NCC AI Assistant"
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              background: 'linear-gradient(135deg, #0A192F 0%, #1E3A8A 100%)',
              color: '#FFFFFF',
              border: '2px solid #D4AF37',
              boxShadow: '0 6px 20px rgba(10, 25, 47, 0.45), 0 0 12px rgba(212, 175, 55, 0.3)',
              cursor: 'pointer',
              transition: 'all 0.25s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.08)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(10, 25, 47, 0.55), 0 0 16px rgba(212, 175, 55, 0.45)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(10, 25, 47, 0.45), 0 0 12px rgba(212, 175, 55, 0.3)';
            }}
            aria-label="Command Saathi AI Assistant"
          >
            <div
              style={{
                position: 'absolute',
                top: '2px',
                right: '2px',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#10B981',
                border: '2px solid #0A192F',
                boxShadow: '0 0 6px #10B981',
              }}
            />
            <img
              src="/assets/logos/ncc_logo.png"
              alt="NCC Command Saathi"
              style={{
                width: '32px',
                height: '32px',
                objectFit: 'contain',
                filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.35))',
              }}
            />
          </button>
        )}
      </div>

      {/* Interactive Chat Window */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '460px',
            maxWidth: 'calc(100vw - 28px)',
            height: '630px',
            maxHeight: 'calc(100vh - 36px)',
            background: '#FFFFFF',
            borderRadius: '16px',
            boxShadow: '0 20px 50px rgba(6, 19, 37, 0.35)',
            border: '2px solid var(--navy-primary, #0A192F)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'inherit',
          }}
        >
          <style>{`
            .saathi-quick-prompts::-webkit-scrollbar {
              display: none;
            }
          `}</style>

          {/* Header - Cleaned up per user request */}
          <div
            style={{
              background: 'linear-gradient(135deg, #061325 0%, #0A192F 100%)',
              color: '#FFFFFF',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '3px solid #D4AF37',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: 'rgba(212, 175, 55, 0.15)',
                  border: '1.5px solid #D4AF37',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#D4AF37',
                }}
              >
                <Shield size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, letterSpacing: '0.02em', color: '#FFFFFF' }}>
                  Command Saathi
                </h3>
                <div style={{ fontSize: '0.75rem', color: '#93C5FD' }}>
                  AIT NCC Cadet Assistant
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={clearChat}
                title="Reset Conversation"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#93C5FD',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'transform 0.4s ease',
                  transform: isRefreshing ? 'rotate(360deg)' : 'none',
                }}
              >
                <RefreshCw size={17} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close Assistant"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Quick Prompts Bar */}
          <div
            className="saathi-quick-prompts"
            style={{
              padding: '8px 12px',
              background: '#F8FAFC',
              borderBottom: '1px solid #E2E8F0',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              display: 'flex',
              gap: '6px',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {QUICK_PROMPTS.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(p)}
                disabled={loading}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '20px',
                  padding: '4px 10px',
                  fontSize: '0.72rem',
                  color: '#0A192F',
                  fontWeight: 600,
                  cursor: 'pointer',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#1E3A8A')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#CBD5E1')}
              >
                <Sparkles size={11} style={{ color: '#D4AF37' }} />
                <span>{p.length > 35 ? p.substring(0, 32) + '...' : p}</span>
              </button>
            ))}
          </div>

          {/* Messages Container */}
          <div
            style={{
              flex: 1,
              padding: '14px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              background: '#F1F5F9',
            }}
          >
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '100%',
                }}
              >
                <div
                  style={{
                    maxWidth: '92%',
                    padding: '12px 14px',
                    borderRadius: m.role === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                    background: m.role === 'user' ? '#0A192F' : '#FFFFFF',
                    color: m.role === 'user' ? '#FFFFFF' : '#0F172A',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                    border: m.role === 'user' ? 'none' : '1px solid #E2E8F0',
                    fontSize: '0.88rem',
                    lineHeight: '1.55',
                    wordBreak: 'break-word',
                  }}
                >
                  {/* Assistant Header Tag - Cleaned */}
                  {m.role === 'assistant' && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid #F1F5F9',
                        paddingBottom: '4px',
                        marginBottom: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: '#1E3A8A',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Shield size={12} style={{ color: '#D4AF37' }} />
                        Assistant
                      </span>
                      <button
                        onClick={() => handleCopy(m.content, m.id)}
                        title="Copy text"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#64748B',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px',
                          fontSize: '0.7rem',
                        }}
                      >
                        {copiedId === m.id ? <Check size={12} style={{ color: '#10B981' }} /> : <Copy size={12} />}
                      </button>
                    </div>
                  )}

                  {/* Clean Structured Message Content */}
                  <div>
                    {renderFormattedContent(m.content, m.role === 'user')}
                  </div>

                  {/* Time Stamp */}
                  <div
                    style={{
                      fontSize: '0.65rem',
                      color: m.role === 'user' ? '#93C5FD' : '#94A3B8',
                      textAlign: 'right',
                      marginTop: '4px',
                    }}
                  >
                    {m.timestamp}
                  </div>
                </div>
              </div>
            ))}

            {/* Live Research Indicator */}
            {loading && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#FFFFFF',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  alignSelf: 'flex-start',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                  fontSize: '0.82rem',
                  color: '#1E3A8A',
                  fontWeight: 600,
                  border: '1px solid #BFDBFE',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Search size={14} className="animate-spin" style={{ color: '#D4AF37' }} />
                  <span>Researching defense sources...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box - Cleaned, footer text removed */}
          <div
            style={{
              padding: '12px',
              background: '#FFFFFF',
              borderTop: '1px solid #E2E8F0',
            }}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              style={{ display: 'flex', gap: '8px' }}
            >
              <input
                type="text"
                placeholder="Ask any NCC, drill, weapon or camp question..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.88rem',
                  outline: 'none',
                  color: '#0A192F',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#0A192F')}
                onBlur={(e) => (e.target.style.borderColor = '#CBD5E1')}
              />
              <button
                type="submit"
                disabled={loading || !inputMessage.trim()}
                style={{
                  background: inputMessage.trim() ? '#0A192F' : '#E2E8F0',
                  color: inputMessage.trim() ? '#FFFFFF' : '#94A3B8',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0 16px',
                  cursor: inputMessage.trim() ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                }}
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
