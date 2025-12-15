import { useEffect } from 'react';

export function useAddShortcut(onAdd: () => void) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check for Command+Shift+A (Mac) or Control+Shift+A (Windows/Linux)
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === 'KeyA') {
                e.preventDefault();
                onAdd();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onAdd]);
}
