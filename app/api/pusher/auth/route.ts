import { NextRequest, NextResponse } from 'next/server';
import Pusher from 'pusher';
import { getUserFromRequest } from '@/lib/permissions/middleware';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY || process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER || process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user?.email) return new NextResponse('Unauthorized', { status: 401 });

  const formData = await req.formData();
  const socketId = formData.get('socket_id') as string;
  const channel = formData.get('channel_name') as string;

  // Allow access to org-wide and per-user channels.
  const sanitizedEmail = user.email.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const allowedChannels = new Set([
    'private-org-tasks',
    'private-org-chat',
    'private-org-followups',
    `private-notifications-${sanitizedEmail}`,
    `private-user-${sanitizedEmail}`,
  ]);

  if (!allowedChannels.has(channel)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const authResponse = pusher.authorizeChannel(socketId, channel);
  return NextResponse.json(authResponse);
}
