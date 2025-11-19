/**
 * Chat store using AG UI protocol for streaming
 */
import { create, type StateCreator } from "zustand";
import { HttpAgent, type AgentSubscriber, type Message as AGUIMessage } from "@ag-ui/client";
import type { ChatMessage, ToolInvocation, Artifact, Role } from "@/types";

export interface AGUIChatState {
  messages: ChatMessage[];
  toolInvocations: ToolInvocation[];
  artifacts: Artifact[];
  loading: boolean;
  error?: string;
  threadId: string;
  agent: HttpAgent;
  send: (text: string) => Promise<void>;
  stopStreaming: () => void;
  reset: () => void;
}

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const LOG_AGUI_EVENTS = Boolean(import.meta.env.DEV || import.meta.env.VITE_AGUI_DEBUG === "true");

const logAGUI = (message: string, payload?: unknown, level: "info" | "error" = "info") => {
  if (!LOG_AGUI_EVENTS) {
    return;
  }
  const prefix = `[AGUI] ${message}`;
  if (payload === undefined) {
    level === "error" ? console.error(prefix) : console.info(prefix);
    return;
  }
  level === "error" ? console.error(prefix, payload) : console.info(prefix, payload);
};

const buildAgent = () => {
  const agent = new HttpAgent({
    url: `${API_BASE}/ag-ui/run`,
    description: "My Companion",
  });
  agent.threadId = `thread_${Date.now()}`;
  return agent;
};

// Helper to convert AG UI message to ChatMessage
function convertAGUIMessageToChatMessage(msg: AGUIMessage): ChatMessage {
  let content = "";
  if (typeof msg.content === "string") {
    content = msg.content;
  } else if (Array.isArray(msg.content)) {
    // Handle multimodal content - extract text parts
    content = msg.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n");
  }

  return {
    id: msg.id,
    role: msg.role as "user" | "assistant" | "system" | "tool",
    content,
    toolId: msg.role === "tool" ? (msg as any).toolCallId : undefined,
    metadata: {
      name: "name" in msg ? msg.name : undefined,
    },
  };
}

const store: StateCreator<AGUIChatState, [], [], AGUIChatState> = (set, get) => {
  const initialAgent = buildAgent();

  const syncMessagesFromAgent = () => {
    const agent = get().agent;
    if (!agent) {
      return;
    }
    const converted = agent.messages.map(convertAGUIMessageToChatMessage);
    set({ messages: converted });
  };

  const upsertMessage = (partial: Partial<ChatMessage> & { id: string }) => {
    set((state) => {
      const index = state.messages.findIndex((message) => message.id === partial.id);

      if (index === -1) {
        const newMessage: ChatMessage = {
          id: partial.id,
          role: (partial.role ?? "assistant") as Role,
          content: partial.content ?? "",
          toolId: partial.toolId,
          metadata: partial.metadata,
        };
        return { messages: [...state.messages, newMessage] };
      }

      const existing = state.messages[index];
      const nextContent = partial.content ?? existing.content;
      const nextRole = (partial.role ?? existing.role) as Role;
      const nextToolId = partial.toolId ?? existing.toolId;
      const nextMetadata = partial.metadata
        ? { ...(existing.metadata ?? {}), ...partial.metadata }
        : existing.metadata;

      if (
        nextContent === existing.content &&
        nextRole === existing.role &&
        nextToolId === existing.toolId &&
        nextMetadata === existing.metadata
      ) {
        return state;
      }

      const nextMessages = [...state.messages];
      nextMessages[index] = {
        ...existing,
        ...partial,
        content: nextContent,
        role: nextRole,
        toolId: nextToolId,
        metadata: nextMetadata,
      };
      return { messages: nextMessages };
    });
  };

  const resolveRole = (incomingRole?: string): Role => {
    if (incomingRole === "user" || incomingRole === "assistant" || incomingRole === "system" || incomingRole === "tool") {
      return incomingRole;
    }
    return "assistant";
  };

  const createSubscriber = (toolInvocationsMap: Map<string, ToolInvocation>): AgentSubscriber => {
    const updateToolInvocations = () => {
      set({ toolInvocations: Array.from(toolInvocationsMap.values()) });
    };

    return {
      onRunInitialized: () => {
        set({ loading: true, error: undefined });
        syncMessagesFromAgent();
        logAGUI("Run initialized", { threadId: get().threadId });
      },
      onRunFailed: ({ error }) => {
        set({ loading: false, error: error.message || "Agent run failed" });
        logAGUI("Run failed", { message: error.message }, "error");
      },
      onRunFinalized: () => {
        set({ loading: false });
        syncMessagesFromAgent();
        logAGUI("Run finalized", { totalMessages: get().agent.messages.length });
      },
      onNewMessage: () => {
        syncMessagesFromAgent();
        logAGUI("Message snapshot synced", { totalMessages: get().agent.messages.length });
      },
      onTextMessageStartEvent: ({ event }) => {
        const eventRole = (event as { role?: string }).role;
        upsertMessage({ id: event.messageId, role: resolveRole(eventRole), content: "" });
        logAGUI("Assistant message started", { messageId: event.messageId, role: eventRole });
      },
      onTextMessageContentEvent: ({ event, textMessageBuffer }) => {
        upsertMessage({ id: event.messageId, content: textMessageBuffer });
      },
      onTextMessageEndEvent: ({ event, textMessageBuffer }) => {
        upsertMessage({ id: event.messageId, content: textMessageBuffer });
        syncMessagesFromAgent();
        logAGUI("Assistant message completed", { messageId: event.messageId, content: textMessageBuffer });
      },
      onMessagesSnapshotEvent: () => {
        syncMessagesFromAgent();
        logAGUI("Messages snapshotted");
      },
      onToolCallStartEvent: ({ event }) => {
        toolInvocationsMap.set(event.toolCallId, {
          toolId: event.toolCallName,
          args: {},
          status: "running",
        });
        updateToolInvocations();
        logAGUI("Tool call started", { toolCallId: event.toolCallId, toolId: event.toolCallName });
      },
      onToolCallArgsEvent: ({ event, partialToolCallArgs }) => {
        const invocation = toolInvocationsMap.get(event.toolCallId);
        if (invocation) {
          const safeArgs =
            partialToolCallArgs && typeof partialToolCallArgs === "object" && !Array.isArray(partialToolCallArgs)
              ? partialToolCallArgs
              : {};
          invocation.args = safeArgs as Record<string, unknown>;
          updateToolInvocations();
          logAGUI("Tool call args patched", { toolCallId: event.toolCallId, args: invocation.args });
        }
      },
      onToolCallResultEvent: ({ event }) => {
        const invocation = toolInvocationsMap.get(event.toolCallId);
        if (invocation) {
          try {
            const parsed = JSON.parse(event.content ?? "{}");
            invocation.output = {
              componentId: parsed.componentId ?? parsed.component_id,
              props: parsed.props ?? {},
            };
            if (typeof parsed.summary === "string") {
              if (!invocation.args || typeof invocation.args !== "object" || Array.isArray(invocation.args)) {
                invocation.args = {};
              }
              (invocation.args as Record<string, unknown>).summary = parsed.summary;
            }
            if (Array.isArray(parsed.artifacts)) {
              set({ artifacts: parsed.artifacts });
            }
          } catch (err) {
            console.error("Failed to parse TOOL_CALL_RESULT:", err);
          }
          updateToolInvocations();
          logAGUI("Tool call result", { toolCallId: event.toolCallId, output: invocation.output });
        }
      },
      onToolCallEndEvent: ({ event }) => {
        const invocation = toolInvocationsMap.get(event.toolCallId);
        if (invocation) {
          if (invocation.status === "running") {
            invocation.status = "succeeded";
          }
          updateToolInvocations();
          logAGUI("Tool call ended", { toolCallId: event.toolCallId, status: invocation.status });
        }
      },
      onRunFinishedEvent: () => {
        set({ loading: false });
        syncMessagesFromAgent();
        logAGUI("Run finished", { threadId: get().threadId });
      },
      onRunErrorEvent: ({ event }) => {
        set({ loading: false, error: event.message || "Agent error" });
        logAGUI("Run error", { code: event.code, message: event.message }, "error");
      },
    };
  };

  return {
    agent: initialAgent,
    messages: [] as ChatMessage[],
    toolInvocations: [] as ToolInvocation[],
    artifacts: [] as Artifact[],
    loading: false,
    error: undefined,
    threadId: initialAgent.threadId,

    send: async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }

      if (get().loading) {
        return;
      }

      const agent = get().agent;
      const threadId = get().threadId;
      agent.threadId = threadId;

      const userMessageId = `user_${Date.now()}`;
      agent.addMessage({
        id: userMessageId,
        role: "user",
        content: trimmed,
      });
      syncMessagesFromAgent();
      logAGUI("Sending user message", { threadId, userMessageId, content: trimmed });

      set({
        loading: true,
        error: undefined,
        toolInvocations: [],
        artifacts: [],
        agent,
      });

      const toolInvocationsMap = new Map<string, ToolInvocation>();

      try {
        await agent.runAgent(undefined, createSubscriber(toolInvocationsMap));
        syncMessagesFromAgent();
        logAGUI("Run completed", { threadId, totalMessages: agent.messages.length });
      } catch (error) {
        console.error("Agent run failed:", error);
        set({
          loading: false,
          error: error instanceof Error ? error.message : "Failed to send message",
        });
        logAGUI("Agent run threw", error, "error");
      }
    },

    stopStreaming: () => {
      const agent = get().agent;
      agent.abortRun();
      set({ loading: false });
    },

    reset: () => {
      const currentAgent = get().agent;
      currentAgent.abortRun();
      const nextAgent = buildAgent();
      set({
        agent: nextAgent,
        threadId: nextAgent.threadId,
        messages: [],
        toolInvocations: [],
        artifacts: [],
        loading: false,
        error: undefined,
      });
    },
  };
};

export const useAGUIChatStore = create<AGUIChatState>()(store);
