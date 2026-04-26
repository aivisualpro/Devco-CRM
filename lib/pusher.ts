import Pusher from 'pusher';

export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID || 'dummy',
  key: process.env.PUSHER_KEY || 'dummy',
  secret: process.env.PUSHER_SECRET || 'dummy',
  cluster: process.env.PUSHER_CLUSTER || 'mt1',
  useTLS: true,
});

export async function pushNotification(recipientEmail: string, payload: {
  title: string;
  message: string;
  link?: string;
  type: string;
  notificationId: string;
}) {
  if (!process.env.PUSHER_APP_ID || process.env.PUSHER_APP_ID === 'dummy' || !process.env.PUSHER_KEY || process.env.PUSHER_KEY === 'dummy') return; // Skip if not configured
  
  const channelName = `private-notifications-${recipientEmail.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  return pusherServer.trigger(channelName, 'new-notification', payload).catch(err => {
    console.error('[Pusher] trigger failed', err);
  });
}
