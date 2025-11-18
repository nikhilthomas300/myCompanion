export type Role = "user" | "assistant" | "system" | "tool";

export interface ChatMessage {
  role: Role;
  content: string;
  toolId?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolInvocation {
  toolId: string;
  args: Record<string, unknown>;
  status: "pending" | "running" | "succeeded" | "failed";
  output?: {
    componentId?: string;
    props: Record<string, unknown>;
  };
}

export interface Artifact {
  id: string;
  kind: "json" | "table" | "text" | "link";
  payload: unknown;
}
