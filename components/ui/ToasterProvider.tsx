'use client';

import { Toaster } from 'react-hot-toast';

export function ToasterProvider() {
    return (
        <Toaster
            position="bottom-right"
            reverseOrder={false}
            containerStyle={{
                zIndex: 100000,
            }}
            toastOptions={{
                duration: 4000,
                style: {
                    background: '#fff',
                    color: '#363636',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    borderRadius: '0.75rem',
                    padding: '12px 16px',
                    border: '1px solid #f3f4f6',
                },
                success: {
                    iconTheme: {
                        primary: '#10B981',
                        secondary: 'white',
                    },
                },
                error: {
                    iconTheme: {
                        primary: '#EF4444',
                        secondary: 'white',
                    },
                },
            }}
        />
    );
}
