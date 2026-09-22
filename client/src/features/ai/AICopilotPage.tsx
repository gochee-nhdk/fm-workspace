import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import {
  Button,
  Badge,
  Spinner
} from '@/components/ui';
import {
  Bot,
  Send,
  Sparkles,
  User,
  Copy,
  Check,
  RefreshCw,
  HelpCircle,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export const AICopilotPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Xin chào! Tôi là **AI Procurement & Merchandising Copilot** của bạn tại Farmers Market.\n\nTôi được thiết kế để hỗ trợ bạn:\n- Rà soát tồn kho và phát hiện nguy cơ thiếu hàng\n- Tính toán gợi ý số lượng đặt hàng tối ưu (ADS, Lead Time, MOQ)\n- Phát hiện hàng cận hạn dùng để cảnh báo đẩy bán\n- Tìm kiếm cơ hội điều chuyển hàng giữa các cửa hàng\n\nBạn muốn tôi kiểm tra vấn đề gì trong không gian làm việc hôm nay?`,
      createdAt: new Date().toISOString()
    }
  ]);

  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const suggestedPrompts = [
    'SKU nào đang có nguy cơ thiếu hàng hoặc tồn bằng 0?',
    'Có sản phẩm nào cận hạn sử dụng trong 7 ngày tới không?',
    'Có cơ hội điều chuyển hàng giữa các cửa hàng không?',
    'Giải thích công thức tính Reorder Point và Target Stock'
  ];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      createdAt: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setLoading(true);

    try {
      const res = await api.post('/ai/chat', { message: text.trim() });
      const content = res.data?.data?.reply || res.data?.data?.response || res.data?.reply || res.data?.response;
      if (content) {
        const assistantMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content,
          createdAt: new Date().toISOString()
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.message || 'Không thể kết nối với Gemini AI. Vui lòng kiểm tra lại API Key trong phần Cài đặt.';
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `❌ **Lỗi phản hồi**: ${errMsg}`,
          createdAt: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Đã sao chép phản hồi vào clipboard.');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 pb-3 border-b border-white/20 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-teal-600 text-white shadow-sm">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#1d1d1f] dark:text-white flex items-center gap-2">
              <span>Trợ lý AI Procurement Copilot</span>
              <Badge variant="success" size="sm" dot>Gemini Grounded</Badge>
            </h2>
            <p className="text-[11px] text-[#76767b] dark:text-[#a1a1a6]">
              Phân tích căn cứ trên dữ liệu thực tế • Tuân thủ SOP & Quy tắc nghiệp vụ công ty • Không bịa đặt số liệu
            </p>
          </div>
        </div>

        <Button
          variant="glass"
          size="sm"
          onClick={() => setMessages([messages[0]])}
          icon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Hội thoại mới
        </Button>
      </div>

      {/* Chat Messages Container */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                  isUser
                    ? 'bg-slate-800 text-white'
                    : 'bg-teal-600 text-white shadow-xs'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div
                className={`relative group max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed ${
                  isUser
                    ? 'bg-teal-600 text-white rounded-tr-none'
                    : 'glass-material text-[#1d1d1f] dark:text-[#f5f5f7] rounded-tl-none'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {!isUser && (
                  <button
                    onClick={() => copyToClipboard(msg.id, msg.content)}
                    className="absolute top-2 right-2 p-1 rounded-md text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Sao chép câu trả lời"
                  >
                    {copiedId === msg.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="glass-material p-3.5 rounded-2xl rounded-tl-none text-xs flex items-center gap-2.5 text-[#76767b] dark:text-[#a1a1a6]">
              <Spinner size="sm" />
              <span>AI đang đọc dữ liệu tồn kho và tính toán căn cứ...</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div className="shrink-0 space-y-2 pt-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <Sparkles className="w-3.5 h-3.5 text-teal-600 shrink-0" />
          <span className="text-[11px] font-semibold text-[#76767b] dark:text-[#a1a1a6] shrink-0">Gợi ý nhanh:</span>
          {suggestedPrompts.map((p, i) => (
            <button
              key={i}
              onClick={() => handleSend(p)}
              disabled={loading}
              className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full glass-btn text-[#1d1d1f] dark:text-white hover:scale-[1.02] transition-transform"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Message Input Box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2 p-2 rounded-[20px] glass-material focus-within:ring-2 focus-within:ring-teal-500/30 transition-all"
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Hỏi AI về tính toán đặt hàng, phân tích SKU, rà soát tồn kho hoặc tệp Excel..."
            className="flex-1 text-xs bg-transparent px-3 py-2 text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#a1a1a6] focus:outline-none"
            disabled={loading}
          />
          <Button
            type="submit"
            variant="glassProminent"
            size="sm"
            disabled={!inputMessage.trim() || loading}
            icon={<Send className="w-3.5 h-3.5" />}
          >
            Gửi
          </Button>
        </form>
      </div>
    </div>
  );
};

