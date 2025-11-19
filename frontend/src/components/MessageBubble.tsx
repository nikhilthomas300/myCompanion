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
    <div className={cn("flex w-full animate-fade-in", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] px-4 py-3 text-sm leading-relaxed shadow-sm transition-all",
          isUser
            ? "rounded-2xl rounded-tr-sm bg-primary text-primary-foreground shadow-md"
            : "rounded-2xl rounded-tl-sm bg-white text-foreground border border-border/40 shadow-soft"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-line font-medium">{message.content}</p>
        ) : (
          <>
            {toolName && (
              <div className="mb-3 flex items-center gap-2">
                <div className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground uppercase tracking-wider">
                  {toolName}
                </div>
              </div>
            )}
            <div className="prose prose-sm max-w-none text-foreground prose-headings:font-display prose-headings:text-foreground prose-p:text-foreground/90 prose-strong:text-foreground prose-code:text-xs prose-code:bg-secondary prose-code:px-1 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            </div>
          </>
        )}
        {isAssistant && (
          <div className="mt-4 flex items-center justify-between border-t border-border/30 pt-2">
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-full hover:bg-secondary"
                onClick={() => setLiked((s) => (s === true ? null : true))}
              >
                <ThumbsUp className={cn("h-3.5 w-3.5 transition-colors", liked ? "text-primary fill-primary/20" : "text-muted-foreground")} />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-full hover:bg-secondary"
                onClick={() => setLiked((s) => (s === false ? null : false))}
              >
                <ThumbsDown className={cn("h-3.5 w-3.5 transition-colors", liked === false ? "text-destructive fill-destructive/20" : "text-muted-foreground")} />
              </Button>
            </div>
            <div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full hover:bg-secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(message.content);
                  } catch {
                    // Ignore error
                  }
                }}
              >
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
