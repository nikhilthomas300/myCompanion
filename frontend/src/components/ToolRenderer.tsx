import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveComponent } from "@/registry/componentRegistry";
import type { ToolInvocation } from "@/types";

interface ToolRendererProps {
  toolInvocations: ToolInvocation[];
}

function ToolRenderer({ toolInvocations }: ToolRendererProps) {
  if (toolInvocations.length === 0) return null;

  return (
    <div className="space-y-4">
      {toolInvocations.map((invocation, index) => {
        const componentKey = invocation.output?.componentId;
        if (!componentKey) {
          return null;
        }

        const Component = resolveComponent(componentKey);

        if (Component) {
          return (
            <div key={`${componentKey}-${index}`} className="flex justify-start">
              <div className="max-w-[80%] rounded-3xl bg-white/90 p-4 shadow-sm ring-1 ring-slate-200">
                <Component props={invocation.output?.props ?? {}} />
              </div>
            </div>
          );
        }

        return (
          <div key={`${componentKey}-${index}`} className="flex justify-start">
            <Card className="max-w-[80%] rounded-3xl border border-gray-200">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-gray-900">{componentKey}</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs text-gray-500">
                  {JSON.stringify(invocation.output ?? invocation.args, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}

export default memo(ToolRenderer);
