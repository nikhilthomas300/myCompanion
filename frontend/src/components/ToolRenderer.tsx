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
      <Button variant="ghost" size="icon" onClick={() => setLiked((s) => (s === true ? null : true))}>
        <ThumbsUp className={cn("h-4 w-4", liked ? "text-emerald-600" : "text-slate-400")} />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => setLiked((s) => (s === false ? null : false))}>
        <ThumbsDown className={cn("h-4 w-4", liked === false ? "text-rose-600" : "text-slate-400")} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(content);
            alert("Copied tool output");
          } catch {
            alert("Couldn't copy");
          }
        }}
      >
        <Copy className="h-4 w-4 text-slate-500" />
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
  };

  return (
    <div className="space-y-4">
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
          <div key={`${componentKey}-${index}`} className="flex justify-start">
            <div className="max-w-[100%] rounded-3xl bg-white/90 p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="outline">Tool: {TOOL_NAMES[invocation.toolId] ?? invocation.toolId}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <ToolActions content={JSON.stringify(invocation.output?.props ?? {}, null, 2)} />
                </div>
              </div>
              <div className="mt-3">
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
