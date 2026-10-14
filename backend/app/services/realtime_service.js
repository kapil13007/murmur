// File: app/services/realtime_service.js
// Server-Sent Events hub. Every open hub window (browser or desktop) keeps one
// stream; when a dictation lands from any device the history refreshes live,
// the role Wispr Flow's `/api/v1/sync/ws` socket plays.
import { getLogger } from '../core/logger.js';

const logger = getLogger('realtime');
const channels = new Map(); // userId -> Set<Response>
const HEARTBEAT_MS = 25_000;

export function subscribe(userId, res) {
  if (!channels.has(userId)) channels.set(userId, new Set());
  channels.get(userId).add(res);
  res.write(`event: ready\ndata: {}\n\n`);
  return () => {
    const set = channels.get(userId);
    if (!set) return;
    set.delete(res);
    if (set.size === 0) channels.delete(userId);
  };
}

export function publish(userId, type, payload = {}) {
  const set = channels.get(userId);
  if (!set) return;
  const frame = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) {
    try {
      res.write(frame);
    } catch (err) {
      logger.warn(`Dropping dead SSE stream: ${err.message}`);
      set.delete(res);
    }
  }
}

export function connectionCount() {
  let n = 0;
  for (const set of channels.values()) n += set.size;
  return n;
}

// Comment frames keep proxies from closing idle streams.
const heartbeat = setInterval(() => {
  for (const set of channels.values()) {
    for (const res of set) {
      try {
        res.write(': ping\n\n');
      } catch {
        set.delete(res);
      }
    }
  }
}, HEARTBEAT_MS);
heartbeat.unref();
