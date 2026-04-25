'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ComponentProps } from 'react';

type PrefetchLinkProps = ComponentProps<typeof Link>;

export default function PrefetchLink({ children, href, onMouseEnter, onFocus, ...props }: PrefetchLinkProps) {
    const router = useRouter();

    const handlePrefetch = () => {
        if (typeof href === 'string') {
            router.prefetch(href);
        } else if (href && typeof href === 'object' && href.pathname) {
            router.prefetch(href.pathname);
        }
    };

    return (
        <Link
            href={href}
            prefetch={true}
            onMouseEnter={(e) => {
                handlePrefetch();
                if (onMouseEnter) onMouseEnter(e);
            }}
            onFocus={(e) => {
                handlePrefetch();
                if (onFocus) onFocus(e);
            }}
            {...props}
        >
            {children}
        </Link>
    );
}
