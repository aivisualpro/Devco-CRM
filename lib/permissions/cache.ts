import { unstable_cache } from 'next/cache';

export async function getCachedPermissions<T>(
    userId: string,
    loader: () => Promise<T>
): Promise<T> {
    const cachedLoader = unstable_cache(
        async () => {
            console.time(`permissions-loader-${userId}`);
            const data = await loader();
            console.timeEnd(`permissions-loader-${userId}`);
            return data;
        },
        [`permissions-${userId}`],
        { tags: [`permissions-${userId}`, 'permissions-all'], revalidate: 300 }
    );
    
    return cachedLoader();
}
