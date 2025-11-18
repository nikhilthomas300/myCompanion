/**
 * Chat store using AG UI protocol for streaming
 */
import { create, type StateCreator } from "zustand";
import type { 
  BaseEvent, 
  EventType,
  Message as AGUIMessage 
} from "@ag-ui/core";
import { runAGUIAgent } from "@/api/agui";
import type { ChatMessage, ToolInvocation, Artifact } from "@/types";

export interface AGUIChatState {
  messages: ChatMessage[];
  toolInvocations: ToolInvocation[];
  artifacts: Artifact[];
  loading: boolean;
  error?: string;
  threadId: string;
  send: (text: string) => Promise<void>;
  stopStreaming: () => void;
  reset: () => void;
}

const initialState = {
  messages: [] as ChatMessage[],
  toolInvocations: [] as ToolInvocation[],
  artifacts: [] as Artifact[],
  loading: false,
  error: undefined as string | undefined,
  threadId: `thread_${Date.now()}`,
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
      .join(" ");
  }

  return {
    role: msg.role as "user" | "assistant" | "system" | "tool",
    content,
    toolId: msg.role === "tool" ? (msg as any).toolCallId : undefined,
    metadata: { 
      id: msg.id, 
      name: "name" in msg ? msg.name : undefined 
    },
  };
}

const store: StateCreator<AGUIChatState, [], [], AGUIChatState> = (set, get) => {
  let subscription: any = null;

  return {
    ...initialState,
    
    send: async (text: string) => {
      const currentMessages = get().messages;
      const threadId = get().threadId;
      const runId = `run_${Date.now()}`;
      
      // Add user message optimistically
      const userMessage: ChatMessage = {
        role: "user",
        content: text,
        metadata: { id: `user_${Date.now()}` },
      };
      
      set({ 
        messages: [...currentMessages, userMessage], 
        loading: true, 
        error: undefined,
        toolInvocations: [],
      });

      // Prepare AG UI messages format
      const aguiMessages: AGUIMessage[] = [
        ...currentMessages.map(msg => {
          const base: any = {
            id: (msg.metadata?.id as string) || `msg_${Date.now()}_${Math.random()}`,
            role: msg.role,
            content: msg.content,
          };
          
          if (msg.role === "tool" && msg.toolId) {
            base.toolCallId = msg.toolId;
          }
          
          return base;
        }),
        {
          id: (userMessage.metadata?.id as string) || `user_${Date.now()}`,
          role: "user" as const,
          content: text,
        },
      ];

      try {
        // Create observable stream
        const stream = runAGUIAgent({
          threadId,
          runId,
          messages: aguiMessages,
          tools: [],
          context: [],
          state: null,
        });

        // Track streaming state
        let currentMessageId = "";
        let currentMessageContent = "";
        let currentToolCallId = "";
        let currentToolCallName = "";
        let currentToolArgs = "";
        const toolInvocationsMap = new Map<string, ToolInvocation>();

        // Subscribe to stream
        subscription = stream.subscribe({
          next: (event: BaseEvent) => {
            const state = get();
            
            switch (event.type) {
              case "TEXT_MESSAGE_START":
                const startEvent = event as any;
                currentMessageId = startEvent.messageId;
                currentMessageContent = "";
                break;

              case "TEXT_MESSAGE_CONTENT":
                const contentEvent = event as any;
                currentMessageContent += contentEvent.delta;
                
                // Update assistant message in real-time
                const messagesWithStreaming = [
                  ...state.messages.filter(m => m.metadata?.id !== currentMessageId),
                  {
                    role: "assistant" as const,
                    content: currentMessageContent,
                    metadata: { id: currentMessageId },
                  },
                ];
                
                set({ messages: messagesWithStreaming });
                break;

              case "TEXT_MESSAGE_END":
                // Final message is already set
                break;

              case "TOOL_CALL_START":
                const toolStartEvent = event as any;
                currentToolCallId = toolStartEvent.toolCallId;
                currentToolCallName = toolStartEvent.toolCallName;
                currentToolArgs = "";
                
                toolInvocationsMap.set(currentToolCallId, {
                  toolId: currentToolCallName,
                  args: {},
                  status: "running",
                });
                
                set({ toolInvocations: Array.from(toolInvocationsMap.values()) });
                break;

              case "TOOL_CALL_ARGS":
                const argsEvent = event as any;
                currentToolArgs += argsEvent.delta;
                
                try {
                  const parsedArgs = JSON.parse(currentToolArgs);
                  const inv = toolInvocationsMap.get(argsEvent.toolCallId);
                  if (inv) {
                    inv.args = parsedArgs;
                    set({ toolInvocations: Array.from(toolInvocationsMap.values()) });
                  }
                } catch {
                  // Partial JSON, wait for more
                }
                break;

              case "TOOL_CALL_RESULT": {
                const resultEvent = event as any;
                const invocation = toolInvocationsMap.get(resultEvent.toolCallId);
                if (invocation) {
                  try {
                    const parsed = JSON.parse(resultEvent.content ?? "{}");
                    invocation.output = {
                      componentId: parsed.componentId ?? parsed.component_id,
                      props: parsed.props ?? {},
                    };
                    if (typeof parsed.summary === "string") {
                      invocation.args.summary = parsed.summary;
                    }
                    invocation.status = invocation.status === "running" ? "succeeded" : invocation.status;
                  } catch (err) {
                    console.error("Failed to parse TOOL_CALL_RESULT:", err);
                  }
                  set({ toolInvocations: Array.from(toolInvocationsMap.values()) });
                }
                break;
              }

              case "TOOL_CALL_END": {
                const toolEndEvent = event as any;
                const invocation = toolInvocationsMap.get(toolEndEvent.toolCallId);
                if (invocation) {
                  invocation.status = invocation.status === "running" ? "succeeded" : invocation.status;
                  set({ toolInvocations: Array.from(toolInvocationsMap.values()) });
                }
                break;
              }

              case "MESSAGES_SNAPSHOT":
                const snapshotEvent = event as any;
                const convertedMessages = snapshotEvent.messages.map(convertAGUIMessageToChatMessage);
                set({ messages: convertedMessages });
                break;

              case "RUN_FINISHED":
                set({ loading: false });
                break;

              case "RUN_ERROR":
                const errorEvent = event as any;
                set({ 
                  loading: false, 
                  error: errorEvent.message || "An error occurred" 
                });
                break;
            }
          },
          error: (err: Error) => {
            console.error("Stream error:", err);
            set({ 
              loading: false, 
              error: err.message || "Failed to connect to agent" 
            });
          },
          complete: () => {
            set({ loading: false });
          },
        });
      } catch (error) {
        console.error("Failed to start stream:", error);
        set({ 
          loading: false, 
          error: (error as Error).message || "Failed to send message" 
        });
      }
    },

    stopStreaming: () => {
      if (subscription) {
        subscription.unsubscribe();
        subscription = null;
      }
      set({ loading: false });
    },

    reset: () => {
      if (subscription) {
        subscription.unsubscribe();
        subscription = null;
      }
      set({ ...initialState, threadId: `thread_${Date.now()}` });
    },
  };
};

export const useAGUIChatStore = create<AGUIChatState>()(store);
