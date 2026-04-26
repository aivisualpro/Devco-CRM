import { NextRequest, NextResponse } from 'next/server';
import { pusherServer } from '@/lib/pusher';
import { getUserFromRequest } from '@/lib/permissions/middleware';

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user?.email) return new NextResponse('Unauthorized', { status: 401 });
  
  const formData = await req.formData();
  const socketId = formData.get('socket_id') as string;
  const channel = formData.get('channel_name') as string;
  
  const userChannel = `private-notifications-${user.email.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  if (channel !== userChannel) return new NextResponse('Forbidden', { status: 403 });
  
  const authResponse = pusherServer.authorizeChannel(socketId, channel);
  return NextResponse.json(authResponse);
}
