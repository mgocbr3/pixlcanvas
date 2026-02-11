import WebSocket from 'ws';

const MESSENGER_URL = process.env.MESSENGER_WS_URL || 'ws://localhost:3003';

let ws: WebSocket | null = null;
let connectTimer: ReturnType<typeof setTimeout> | null = null;

const connect = () => {
  try {
    ws = new WebSocket(MESSENGER_URL);

    ws.on('open', () => {
      // Authenticate as server
      ws?.send(JSON.stringify({ name: 'authenticate', accessToken: 'server' }));
    });

    ws.on('close', () => {
      ws = null;
      connectTimer = setTimeout(connect, 3000);
    });

    ws.on('error', () => {
      ws = null;
      if (!connectTimer) {
        connectTimer = setTimeout(connect, 3000);
      }
    });
  } catch {
    ws = null;
    connectTimer = setTimeout(connect, 3000);
  }
};

/**
 * Broadcast an event through the messenger WebSocket to all connected editor clients.
 */
export const broadcastMessenger = (name: string, payload: Record<string, unknown>) => {
  if (ws?.readyState === WebSocket.OPEN) {
    // Editor messenger expects: { name: "event.name", data: { ...payload } }
    ws.send(JSON.stringify({ name, data: payload }));
  }
};

// Connect on import
connect();
