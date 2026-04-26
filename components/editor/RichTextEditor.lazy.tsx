import dynamic from 'next/dynamic';
import React from 'react';

export const RichTextEditor = dynamic(() => import('./RichTextEditor').then(mod => mod.RichTextEditor), {
  ssr: false,
  loading: () => <div className="h-[150px] bg-slate-50 animate-pulse rounded border border-border" />,
});
