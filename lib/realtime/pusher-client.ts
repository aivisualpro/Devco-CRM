'use client';
import Pusher from 'pusher-js';

let client: Pusher | null = null;
export function getPusherClient() {
  if (!client && typeof window !== 'undefined' && process.env.NEXT_PUBLIC_PUSHER_KEY) {
    client = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authEndpoint: '/api/pusher/auth',
    });
  }
  return client;
}
