import { memo } from "react";
import { resolveComponent } from "@/registry/componentRegistry";
import type { ToolInvocation } from "@/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Copy, ThumbsUp, ThumbsDown } from "lucide-react";
import { useState } from "react";

function ToolActions({ content }: { content: string }) {
  const [liked, setLiked] = useState<boolean | null>(null);

  return (
    <>
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
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full hover:bg-secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(content);
          } catch {
            // Ignore error
          }
        }}
      >
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>
    </>
  );
}

interface ToolRendererProps {
  toolInvocations: ToolInvocation[];
}

function ToolRenderer({ toolInvocations }: ToolRendererProps) {
  if (toolInvocations.length === 0) return null;

  const TOOL_NAMES: Record<string, string> = {
    "leave.applyForm": "Leave Application",
    "policy.showCard": "Policy Summary",
    "general.answer": "General Answer",
    "weather.showCard": "Weather Snapshot",
  };

  return (
    <div className="space-y-4 py-2">
      {toolInvocations.map((invocation, index) => {
        const componentKey = invocation.output?.componentId;
        
        // Only render if we have a valid componentId
        if (!componentKey) {
          return null;
        }

        const Component = resolveComponent(componentKey);

        // Only render if we have a registered component
        if (!Component) {
          return null;
        }

        return (
          <div key={`${componentKey}-${index}`} className="flex justify-start animate-fade-in">
            <div className="w-full max-w-[100%] overflow-hidden rounded-[1.5rem] rounded-tl-sm border border-border/50 bg-white/80 p-5 shadow-medium backdrop-blur-sm transition-all hover:shadow-lg hover:bg-white">
              <div className="mb-4 flex items-center justify-between border-b border-border/30 pb-3">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary hover:bg-primary/10">
                    {TOOL_NAMES[invocation.toolId] ?? invocation.toolId}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <ToolActions content={JSON.stringify(invocation.output?.props ?? {}, null, 2)} />
                </div>
              </div>
              <div className="mt-2">
                <Component props={invocation.output?.props ?? {}} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default memo(ToolRenderer);
