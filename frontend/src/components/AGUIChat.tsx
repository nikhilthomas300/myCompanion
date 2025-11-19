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
    <div className="flex h-screen flex-col bg-background font-sans text-foreground selection:bg-primary/10">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border/40 bg-background/80 backdrop-blur-xl transition-all">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-indigo-600 text-white shadow-lg shadow-primary/20 ring-1 ring-white/20">
              <span className="font-display text-lg font-bold tracking-tight">MC</span>
            </div>
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight text-foreground">My Companion</h1>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></span>
                <p className="text-xs font-medium text-muted-foreground">AG UI Protocol Active</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        {/* Decorative background elements */}
        <div className="pointer-events-none absolute inset-0 flex justify-center overflow-hidden opacity-30">
          <div className="h-[500px] w-[500px] rounded-full bg-primary/5 blur-[100px]" />
        </div>

        <div className="relative mx-auto flex h-full w-full max-w-3xl flex-col px-4">
          <div className="flex-1 overflow-y-auto py-8 scrollbar-hide">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center space-y-8 text-center animate-fade-in">
                <div className="relative rounded-[2rem] bg-white/50 p-8 shadow-soft ring-1 ring-border/50 backdrop-blur-sm">
                  <div className="mb-4 inline-flex items-center justify-center rounded-xl bg-primary/10 p-3 text-primary">
                    <div className="h-6 w-6 rounded-full border-2 border-current opacity-60" />
                  </div>
                  <h2 className="font-display text-2xl font-semibold text-foreground">Ready to assist</h2>
                  <p className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground">
                    Ask anything about policies, leave planning, or benefits. I'm here to help simplify your work life.
                  </p>
                </div>
                
                <div className="grid w-full gap-4 sm:grid-cols-2">
                  {[
                    "Summarize the parental leave policy",
                    "Draft a response for an employee query",
                    "Help me compare PTO options",
                    "What approvals do I need for sabbatical?"
                  ].map((suggestion, i) => (
                    <button
                      key={suggestion}
                      type="button"
                      style={{ animationDelay: `${i * 100}ms` }}
                      onClick={() => {
                        setInput(suggestion);
                        textareaRef.current?.focus();
                      }}
                      className="group relative animate-fade-in-up overflow-hidden rounded-2xl border border-border/60 bg-white/60 px-5 py-4 text-left text-sm font-medium text-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:bg-white hover:shadow-medium"
                    >
                      <span className="relative z-10">{suggestion}</span>
                      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/0 to-primary/5 opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-5 pb-4">
                {messages.filter((msg) => msg.role !== "tool" && msg.content?.trim()).map((message: ChatMessage, index: number) => (
                  <MessageBubble key={message.id ?? `${message.role}-${index}`} message={message} index={index} />
                ))}
                {toolInvocations.length > 0 && <ToolRenderer toolInvocations={toolInvocations} />}
                {loading && (
                  <div className="flex justify-start animate-fade-in">
                    <div className="flex items-center gap-2 rounded-2xl border border-border bg-white/80 px-4 py-3 shadow-sm backdrop-blur-sm">
                      <div className="flex gap-1">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60" style={{ animationDelay: "0ms" }} />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60" style={{ animationDelay: "150ms" }} />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60" style={{ animationDelay: "300ms" }} />
                      </div>
                      <span className="pl-2 text-xs font-medium text-muted-foreground">Thinking...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Input Area - Floating Design */}
      <div className="relative z-20">
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
        <div className="mx-auto w-full max-w-3xl px-4 pb-6 pt-2">
          {error && (
            <div className="mb-4 animate-fade-in rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-700 shadow-sm backdrop-blur-sm">
              <strong className="font-semibold">Error:</strong> {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="relative flex items-end gap-2 rounded-[2rem] bg-white p-2 shadow-medium ring-1 ring-border/60 transition-shadow focus-within:ring-primary/20 focus-within:shadow-lg">
            <Textarea
              ref={textareaRef}
              placeholder="Message My Companion..."
              value={input}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[52px] max-h-[200px] w-full resize-none border-0 bg-transparent px-4 py-3.5 text-base text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
              rows={1}
            />
            <div className="pb-1 pr-1">
              {loading ? (
                <Button
                  type="button"
                  onClick={handleStop}
                  size="icon"
                  className="h-10 w-10 rounded-full bg-foreground text-background shadow-sm hover:bg-foreground/90"
                >
                  <Square className="h-4 w-4 fill-current" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={!input.trim()}
                  size="icon"
                  className="h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg hover:scale-105 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none disabled:scale-100"
                >
                  <Send className="h-4 w-4 ml-0.5" />
                </Button>
              )}
            </div>
          </form>
          <p className="mt-3 text-center text-[11px] font-medium text-muted-foreground/60">
            AI-generated content may be incorrect.
          </p>
        </div>
      </div>
    </div>
  );
}
