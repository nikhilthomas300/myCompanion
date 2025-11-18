/**
 * Chat component using AG UI protocol
 */
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { Send, Square } from "lucide-react";
import MessageBubble from "@/components/MessageBubble";
import ToolRenderer from "@/components/ToolRenderer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAGUIChatStore, type AGUIChatState } from "@/state/aguiChatStore";
import type { ChatMessage } from "@/types";

export default function AGUIChat() {
  const messages = useAGUIChatStore((state: AGUIChatState) => state.messages);
  const toolInvocations = useAGUIChatStore((state: AGUIChatState) => state.toolInvocations);
  const loading = useAGUIChatStore((state: AGUIChatState) => state.loading);
  const error = useAGUIChatStore((state: AGUIChatState) => state.error);
  const send = useAGUIChatStore((state: AGUIChatState) => state.send);
  const stopStreaming = useAGUIChatStore((state: AGUIChatState) => state.stopStreaming);

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, toolInvocations, loading]);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input.trim() || loading) return;
    const message = input.trim();
    setInput("");
    await send(message);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!input.trim() || loading) return;
      const message = input.trim();
      setInput("");
      send(message);
    }
  };

  const handleStop = () => {
    stopStreaming();
  };

  return (
    <div className="flex h-screen flex-col bg-[#f7f7f8]">
      <header className="border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-sky-500 text-white font-semibold">
              MC
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">MY COMPANION</h1>
              <p className="text-xs text-gray-500">Powered by AG UI Protocol</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-4">
          <div className="flex-1 overflow-y-auto py-6 scrollbar-hide">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center space-y-5 text-center">
                <div className="rounded-3xl bg-white p-6 shadow-sm">
                  <p className="text-base font-semibold text-gray-900">Ready when you are</p>
                  <p className="mt-2 max-w-sm text-sm text-gray-500">
                    Ask anything about policies, leave planning, or benefits and My Companion will respond in seconds.
                  </p>
                </div>
                <div className="grid w-full gap-3 sm:grid-cols-2">
                  {["Summarize the parental leave policy","Draft a response for an employee query","Help me compare PTO options","What approvals do I need for sabbatical?"].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => {
                        setInput(suggestion);
                        textareaRef.current?.focus();
                      }}
                      className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left text-sm text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((message: ChatMessage, index: number) => (
                  <MessageBubble key={`${message.role}-${index}`} message={message} index={index} />
                ))}
                {toolInvocations.length > 0 && <ToolRenderer toolInvocations={toolInvocations} />}
                {loading && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-3xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 shadow-sm">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0ms" }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "150ms" }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "300ms" }} />
                      <span className="pl-1">My Companion is typing…</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>
      </main>

      <div className="border-t border-gray-200 bg-white/95">
        <div className="mx-auto w-full max-w-3xl px-4 py-4">
          {error && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 shadow-sm">
              <strong className="font-medium">Heads up:</strong> {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="relative">
            <Textarea
              ref={textareaRef}
              placeholder="Message My Companion"
              value={input}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[64px] max-h-[220px] resize-none rounded-2xl border-gray-200 bg-white pr-12 text-base shadow-sm focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
              rows={1}
            />
            {loading ? (
              <Button
                type="button"
                onClick={handleStop}
                size="icon"
                className="absolute bottom-3 right-3 h-9 w-9 rounded-xl bg-gray-900 text-white hover:bg-gray-800"
              >
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={!input.trim()}
                size="icon"
                className="absolute bottom-3 right-3 h-9 w-9 rounded-xl bg-gray-900 text-white transition disabled:bg-gray-300"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </form>
          <p className="mt-2 text-center text-xs text-gray-500">Responses can contain errors. Please verify critical information.</p>
        </div>
      </div>
    </div>
  );
}
