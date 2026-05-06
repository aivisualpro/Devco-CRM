'use client';

import { useState, useEffect, useRef } from 'react';

interface AnimatedNumberProps {
    value: number;
    duration?: number;
    formatter?: (n: number) => string;
}

export function AnimatedNumber({ value, duration = 400, formatter }: AnimatedNumberProps) {
    const [display, setDisplay] = useState(value);
    const prevRef = useRef(value);

    useEffect(() => {
        const start = prevRef.current;
        const diff = value - start;
        if (diff === 0) return;

        const startTime = performance.now();
        let raf: number;

        const tick = (now: number) => {
            const elapsed = now - startTime;
            const t = Math.min(1, elapsed / duration);
            // Ease-out cubic
            const eased = 1 - Math.pow(1 - t, 3);
            const current = start + diff * eased;
            setDisplay(current);

            if (t < 1) {
                raf = requestAnimationFrame(tick);
            } else {
                prevRef.current = value;
            }
        };

        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [value, duration]);

    return <>{formatter ? formatter(display) : display.toFixed(0)}</>;
}

export default AnimatedNumber;
