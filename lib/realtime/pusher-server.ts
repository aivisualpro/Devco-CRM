import Pusher from 'pusher';

let pusherServer: Pusher | null = null;
function getServer() {
  if (!pusherServer && process.env.PUSHER_APP_ID) {
    pusherServer = new Pusher({
      appId: process.env.PUSHER_APP_ID!,
      key: process.env.PUSHER_KEY || process.env.NEXT_PUBLIC_PUSHER_KEY!,
      secret: process.env.PUSHER_SECRET!,
      cluster: process.env.PUSHER_CLUSTER || process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      useTLS: true,
    });
  }
  return pusherServer;
}

/** Fire-and-forget broadcast — never throws, never blocks the request */
export function broadcast(channel: string, event: string, payload: any) {
  const server = getServer();
  if (!server) {
    console.warn('[Pusher] not configured, skipping broadcast');
    return;
  }
  server.trigger(channel, event, payload).catch(err =>
    console.error('[Pusher] trigger failed', err)
  );
}
