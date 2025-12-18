import Pusher from 'pusher';

const isDev = process.env.NODE_ENV === 'development';

export const pusherServer = new Pusher({
    appId: (isDev ? process.env.DEV_PUSHER_APP_ID : process.env.PUSHER_APP_ID)!,
    key: (isDev ? process.env.NEXT_PUBLIC_DEV_PUSHER_KEY : process.env.NEXT_PUBLIC_PUSHER_KEY)!,
    secret: (isDev ? process.env.DEV_PUSHER_SECRET : process.env.PUSHER_SECRET)!,
    cluster: (isDev ? process.env.NEXT_PUBLIC_DEV_PUSHER_CLUSTER : process.env.NEXT_PUBLIC_PUSHER_CLUSTER)!,
    useTLS: true,
});
