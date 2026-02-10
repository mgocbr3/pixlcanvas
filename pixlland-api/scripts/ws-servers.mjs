import 'dotenv/config';
import { WebSocketServer } from 'ws';
import ShareDB from 'sharedb';
import { createClient } from '@supabase/supabase-js';
import { Duplex } from 'stream';

const REALTIME_PORT = 3001;
const RELAY_PORT = 3002;
const MESSENGER_PORT = 3003;

const toText = (data) => (typeof data === 'string' ? data : data.toString());

const createSupabaseClient = () => {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return null;
  }

  return createClient(url, serviceKey, { auth: { persistSession: false } });
};

const ensureDoc = (connection, collection, id, data) => new Promise((resolve) => {
  const doc = connection.get(collection, id.toString());
  doc.fetch((err) => {
    if (err) {
      console.error(`[realtime] fetch error ${collection}:${id}`, err);
      resolve();
      return;
    }
    if (doc.type) {
      resolve();
      return;
    }
    doc.create(data, 'json0', (createErr) => {
      if (createErr) {
        console.error(`[realtime] create error ${collection}:${id}`, createErr);
      }
      resolve();
    });
  });
});

const seedDocsFromSupabase = async (backend) => {
  const client = createSupabaseClient();
  if (!client) {
    console.log('[realtime] Supabase not configured, skipping seed');
    return;
  }

  const connection = backend.connect();
  const [scenes, assets] = await Promise.all([
    client.from('scenes').select('*').limit(200),
    client.from('assets').select('*').limit(500)
  ]);

  if (scenes.error) {
    console.error('[realtime] failed to load scenes', scenes.error);
  } else if (scenes.data) {
    await Promise.all(scenes.data.map((scene) => ensureDoc(connection, 'scenes', scene.unique_id || scene.id, {
      item_id: scene.id,
      branch_id: scene.branch_id,
      name: scene.name || 'Main Scene',
      entities: {},
      settings: {
        physics: {},
        render: {}
      }
    })));
  }

  if (assets.error) {
    console.error('[realtime] failed to load assets', assets.error);
  } else if (assets.data) {
    await Promise.all(assets.data.map((asset) => ensureDoc(connection, 'assets', asset.id, {
      item_id: asset.id,
      branch_id: asset.branch_id,
      name: asset.name,
      type: asset.type,
      file: asset.file || {},
      data: asset.data || {},
      tags: [],
      path: [],
      preload: true,
      has_thumbnail: false,
      source: true,
      source_asset_id: null
    })));
  }
};

const createShareDbStream = (socket) => {
  const stream = new Duplex({ objectMode: true });

  stream._read = () => {};
  stream._write = (data, _encoding, callback) => {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(data));
    }
    callback();
  };

  socket.on('close', () => {
    stream.push(null);
  });

  return stream;
};

const createRealtimeServer = async (port) => {
  const backend = new ShareDB();
  await seedDocsFromSupabase(backend);

  const wss = new WebSocketServer({ port });
  const clients = new Set();

  wss.on('connection', (socket) => {
    clients.add(socket);

    const stream = createShareDbStream(socket);
    backend.listen(stream);

    socket.on('message', async (raw) => {
      const data = toText(raw);

      if (data.startsWith('auth')) {
        socket.send(`auth${JSON.stringify({ ok: true })}`);
        return;
      }

      if (data.startsWith('selection')) {
        for (const client of clients) {
          if (client !== socket && client.readyState === client.OPEN) {
            client.send(data);
          }
        }
        return;
      }

      if (!data.startsWith('{') && !data.startsWith('[')) {
        return;
      }

      let msg;
      try {
        msg = JSON.parse(data);
      } catch (err) {
        return;
      }

      if (!msg || typeof msg !== 'object' || Array.isArray(msg) || !msg.a) {
        return;
      }

      const allowedActions = new Set([
        'hs', 'qf', 'qs', 'qu', 'bf', 'bs', 'bu', 'f', 's', 'u', 'op', 'nf', 'nt', 'p', 'ps', 'pu'
      ]);
      if (!allowedActions.has(msg.a)) {
        return;
      }

      if (msg && (msg.a === 's' || msg.a === 'f') && msg.c && msg.d) {
        if (msg.c === 'scenes') {
          await ensureDoc(backend.connect(), 'scenes', msg.d, {
            item_id: msg.d,
            branch_id: 'local',
            name: `Scene ${msg.d}`,
            entities: {},
            settings: {
              physics: {},
              render: {}
            }
          });
        }
        if (msg.c === 'assets') {
          await ensureDoc(backend.connect(), 'assets', msg.d, {
            item_id: msg.d,
            branch_id: 'local',
            name: `Asset ${msg.d}`,
            type: 'unknown',
            file: {},
            data: {}
          });
        }
      }

      stream.push(msg);
    });

    socket.on('close', () => {
      clients.delete(socket);
    });
  });

  wss.on('listening', () => {
    console.log(`[ws] realtime listening on ws://localhost:${port}`);
  });
};

const createRelayServer = (port) => {
  const wss = new WebSocketServer({ port });
  const rooms = new Map();
  const clients = new Map();
  let nextUserId = 1;

  const joinRoom = (socket, roomName) => {
    let room = rooms.get(roomName);
    if (!room) {
      room = new Set();
      rooms.set(roomName, room);
    }

    room.add(socket);
    clients.get(socket)?.rooms.add(roomName);

    const users = Array.from(room)
      .map((client) => clients.get(client)?.id)
      .filter((id) => typeof id === 'number');

    socket.send(JSON.stringify({ t: 'room:join', name: roomName, users }));

    for (const client of room) {
      if (client !== socket && client.readyState === client.OPEN) {
        client.send(JSON.stringify({ t: 'room:join', name: roomName, userId: clients.get(socket)?.id }));
      }
    }
  };

  const leaveRoom = (socket, roomName) => {
    const room = rooms.get(roomName);
    if (!room) {
      return;
    }

    room.delete(socket);
    clients.get(socket)?.rooms.delete(roomName);
    const userId = clients.get(socket)?.id;

    for (const client of room) {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify({ t: 'room:leave', name: roomName, userId }));
      }
    }

    if (room.size === 0) {
      rooms.delete(roomName);
    }
  };

  const broadcastRoom = (socket, roomName, msg) => {
    const room = rooms.get(roomName);
    if (!room) {
      return;
    }

    for (const client of room) {
      if (client !== socket && client.readyState === client.OPEN) {
        client.send(JSON.stringify(msg));
      }
    }
  };

  wss.on('connection', (socket) => {
    const id = nextUserId++;
    clients.set(socket, { id, rooms: new Set() });

    socket.send(JSON.stringify({ t: 'welcome', userId: id }));

    socket.on('message', (raw) => {
      const data = toText(raw);
      if (data === 'ping') {
        socket.send('pong');
        return;
      }

      let msg;
      try {
        msg = JSON.parse(data);
      } catch (err) {
        return;
      }

      if (!msg || !msg.t) {
        return;
      }

      if (msg.t === 'room:join' && msg.name) {
        joinRoom(socket, msg.name);
        return;
      }

      if (msg.t === 'room:leave' && msg.name) {
        leaveRoom(socket, msg.name);
        return;
      }

      if (msg.t === 'room:msg' && msg.name) {
        if (msg.to) {
          for (const [client, info] of clients.entries()) {
            if (info.id === msg.to && client.readyState === client.OPEN) {
              client.send(JSON.stringify(msg));
              return;
            }
          }
          return;
        }
        broadcastRoom(socket, msg.name, msg);
      }
    });

    socket.on('close', () => {
      const info = clients.get(socket);
      if (info) {
        for (const roomName of info.rooms) {
          leaveRoom(socket, roomName);
        }
      }
      clients.delete(socket);
    });
  });

  wss.on('listening', () => {
    console.log(`[ws] relay listening on ws://localhost:${port}`);
  });
};

const createMessengerServer = (port) => {
  const wss = new WebSocketServer({ port });
  const clients = new Set();
  let nextUserId = 1;

  wss.on('connection', (socket) => {
    clients.add(socket);
    const id = nextUserId++;
    socket.send(JSON.stringify({ name: 'welcome', userId: id }));

    socket.on('message', (raw) => {
      const data = toText(raw);
      if (data === 'ping') {
        socket.send('pong');
        return;
      }

      let msg;
      try {
        msg = JSON.parse(data);
      } catch (err) {
        return;
      }

      if (!msg || !msg.name) {
        return;
      }

      if (msg.name === 'authenticate') {
        socket.send(JSON.stringify({ name: 'welcome', userId: id }));
        return;
      }

      for (const client of clients) {
        if (client.readyState === client.OPEN) {
          client.send(JSON.stringify(msg));
        }
      }
    });

    socket.on('close', () => {
      clients.delete(socket);
    });
  });

  wss.on('listening', () => {
    console.log(`[ws] messenger listening on ws://localhost:${port}`);
  });
};

await createRealtimeServer(REALTIME_PORT);
createRelayServer(RELAY_PORT);
createMessengerServer(MESSENGER_PORT);
