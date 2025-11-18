/**
 * AG UI Protocol client for connecting to backend agents
 */
import type { RunAgentInput, BaseEvent } from "@ag-ui/core";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

type AGUIStreamCallbacks = {
  next: (event: BaseEvent) => void;
  error: (error: Error) => void;
  complete: () => void;
};

/**
 * Create a simple AG UI compatible client using fetch and SSE
 */
export function runAGUIAgent(input: RunAgentInput): {
  subscribe: (callbacks: AGUIStreamCallbacks) => { unsubscribe: () => void };
} {
  return {
    subscribe: (callbacks: AGUIStreamCallbacks) => {
      const abortController = new AbortController();

      // Start SSE connection with a resilient SSE parser that handles partial chunks
      const connectSSE = async () => {
        try {
          const response = await fetch(`${API_BASE}/ag-ui/run`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'text/event-stream',
            },
            body: JSON.stringify(input),
            signal: abortController.signal,
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();

          if (!reader) {
            throw new Error('No response body');
          }

          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              // Flush any remaining buffered data before completing
              buffer += decoder.decode().replace(/\r\n/g, '\n');
              processBuffer(buffer, callbacks);
              callbacks.complete();
              break;
            }

            // Decode the chunk
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk.replace(/\r\n/g, '\n');
            buffer = processBuffer(buffer, callbacks);
          }
        } catch (error) {
          if (error instanceof Error && error.name !== 'AbortError') {
            callbacks.error(error);
          }
        }
      };

      const processBuffer = (incomingBuffer: string, streamCallbacks: AGUIStreamCallbacks): string => {
        let workingBuffer = incomingBuffer;
        let separatorIndex = workingBuffer.indexOf('\n\n');

        while (separatorIndex !== -1) {
          const rawEvent = workingBuffer.slice(0, separatorIndex);
          workingBuffer = workingBuffer.slice(separatorIndex + 2);

          const dataLines = rawEvent
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trimStart());

          if (dataLines.length > 0) {
            const dataPayload = dataLines.join('\n');
            if (dataPayload) {
              try {
                const event = JSON.parse(dataPayload) as BaseEvent;
                streamCallbacks.next(event);
              } catch (parseError) {
                console.error('Failed to parse SSE event payload:', parseError);
              }
            }
          }

          separatorIndex = workingBuffer.indexOf('\n\n');
        }

        return workingBuffer;
      };

      connectSSE();

      return {
        unsubscribe: () => {
          abortController.abort();
        },
      };
    },
  };
}

