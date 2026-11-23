import {CityRoomDO} from './CityRoomDO';

export {CityRoomDO};

export interface Env {
  CITY_ROOM: DurableObjectNamespace;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_DATABASE_ID?: string;
  OWNER_UID?: string;
}

const ROOM_LIST = [
  {id: 'city-alpha', name: 'Starlight Alpha', region: 'Global-Edge', description: 'Primary bustling metropolis shard'},
  {id: 'city-beta', name: 'Pacific Beta', region: 'Global-Edge', description: 'Coastal boardwalk & racing community shard'},
  {id: 'city-gamma', name: 'Expressway Gamma', region: 'Global-Edge', description: 'Overflow & event meetups shard'},
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {status: 204, headers: CORS_HEADERS});
    }

    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return Response.json({ok: true, runtime: 'cloudflare-workers-durable-objects'}, {headers: CORS_HEADERS});
    }

    if (url.pathname === '/api/multiplayer/servers') {
      const summaries = await Promise.all(
        ROOM_LIST.map(async (meta) => {
          const id = env.CITY_ROOM.idFromName(meta.id);
          const stub = env.CITY_ROOM.get(id);
          const resp = await stub.fetch('https://internal/stats');
          const stats = (await resp.json()) as {players: number; maxPlayers: number};
          return {
            ...meta,
            players: stats.players,
            maxPlayers: stats.maxPlayers,
            status: stats.players >= stats.maxPlayers ? 'full' : 'online',
          };
        }),
      );
      return Response.json({maxPlayersPerRoom: 12, servers: summaries}, {headers: CORS_HEADERS});
    }

    if (url.pathname === '/ws') {
      const upgradeHeader = request.headers.get('Upgrade');
      if (upgradeHeader !== 'websocket') {
        return new Response('Expected Upgrade: websocket', {status: 426, headers: CORS_HEADERS});
      }
      const roomId = url.searchParams.get('room') || 'city-alpha';
      const valid = ROOM_LIST.some((r) => r.id === roomId) ? roomId : 'city-alpha';
      const id = env.CITY_ROOM.idFromName(valid);
      const stub = env.CITY_ROOM.get(id);
      return stub.fetch(request);
    }

    return new Response('CHAOS CITY Multiplayer Edge Worker', {status: 200, headers: CORS_HEADERS});
  },
};
