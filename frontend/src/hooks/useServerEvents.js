// File: src/hooks/useServerEvents.js
// Live updates from the API's Server-Sent Events stream. fetch() is used
// instead of EventSource so the bearer token travels in a header, not the URL.
// Events are re-broadcast on `serverEvents` for any component to listen to.
import { useEffect } from 'react';
import { API_BASE_URL, getToken } from '../api/apiClient';

export const serverEvents = new EventTarget();

export function onServerEvent(type, handler) {
  const listener = (e) => handler(e.detail);
  serverEvents.addEventListener(type, listener);
  return () => serverEvents.removeEventListener(type, listener);
}

export function useServerEvents(enabled) {
  useEffect(() => {
    if (!enabled) return undefined;
    let stopped = false;
    let controller = null;
    let retryMs = 1000;

    async function connect() {
      while (!stopped) {
        controller = new AbortController();
        try {
          const res = await fetch(`${API_BASE_URL}/sync/events`, {
            headers: { Authorization: `Bearer ${getToken()}`, Accept: 'text/event-stream' },
            signal: controller.signal,
          });
          if (res.status === 401) return;
          if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
          retryMs = 1000;
          const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
          let buffer = '';
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += value;
            let split;
            while ((split = buffer.indexOf('\n\n')) !== -1) {
              const frame = buffer.slice(0, split);
              buffer = buffer.slice(split + 2);
              let type = 'message';
              let data = '';
              for (const line of frame.split('\n')) {
                if (line.startsWith('event:')) type = line.slice(6).trim();
                else if (line.startsWith('data:')) data += line.slice(5).trim();
              }
              if (!data) continue;
              let detail = null;
              try {
                detail = JSON.parse(data);
              } catch {
                detail = data;
              }
              serverEvents.dispatchEvent(new CustomEvent(type, { detail }));
            }
          }
        } catch {
          // fall through to reconnect
        }
        if (stopped) return;
        await new Promise((r) => setTimeout(r, retryMs));
        retryMs = Math.min(retryMs * 2, 30_000);
      }
    }

    connect();
    return () => {
      stopped = true;
      controller?.abort();
    };
  }, [enabled]);
}
