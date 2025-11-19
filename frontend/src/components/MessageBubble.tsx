import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, ThumbsUp, ThumbsDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface MessageBubbleProps {
  message: ChatMessage;
  index: number;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant" || message.role === "tool";
  const [liked, setLiked] = useState<boolean | null>(null);
  const toolName = message.metadata?.name as string | undefined;

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[100%] rounded-3xl px-4 py-3 text-sm leading-relaxed shadow-sm",
          isUser
            ? "bg-emerald-600 text-white"
            : "bg-white text-slate-900 border border-slate-200"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-line">{message.content}</p>
        ) : (
          <>
            {toolName && (
              <div className="mb-2 flex items-center gap-2">
                <div className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{toolName}</div>
              </div>
            )}
          <div className="prose prose-sm max-w-none text-slate-900 prose-headings:text-slate-900 prose-code:text-xs">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
          </>
        )}
        {isAssistant && (
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setLiked((s) => (s === true ? null : true))}>
                <ThumbsUp className={cn("h-4 w-4", liked ? "text-emerald-600" : "text-slate-400")} />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setLiked((s) => (s === false ? null : false))}>
                <ThumbsDown className={cn("h-4 w-4", liked === false ? "text-rose-600" : "text-slate-400")} />
              </Button>
            </div>
            <div>
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(message.content);
                    alert("Copied to clipboard");
                  } catch {
                    alert("Couldn't copy");
                  }
                }}
              >
                <Copy className="h-4 w-4 text-slate-500" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
