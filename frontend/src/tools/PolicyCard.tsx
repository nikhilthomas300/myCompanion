import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { ToolComponentProps } from "@/registry/componentRegistry";

interface PolicyProps extends Record<string, unknown> {
  title?: string;
  summary?: string;
  policy_id?: string;
  links?: { label: string; href: string }[];
}

export default function PolicyCard({ props }: ToolComponentProps) {
  const data = props as PolicyProps;
  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{data.title ?? "Policy"}</CardTitle>
            <CardDescription>Most relevant answer from HR knowledge base.</CardDescription>
          </div>
          {data.policy_id && <Badge variant="secondary">{data.policy_id}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{data.summary}</p>
        {Array.isArray(data.links) && data.links.length > 0 && (
          <div className="space-y-2">
            <Separator />
            <p className="text-xs uppercase text-muted-foreground">References</p>
            <ul className="space-y-1">
              {data.links.map((link) => (
                <li key={link.href}>
                  <a href={link.href} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
