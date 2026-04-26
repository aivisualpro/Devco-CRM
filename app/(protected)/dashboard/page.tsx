import { Suspense } from 'react';
import DashboardClient from './DashboardClient';

export default async function DashboardPage({ searchParams }: { 
  searchParams: Promise<{ week?: string; scope?: string }> 
}) {
  const sp = await searchParams;
  let week = sp.week;
  
  if (!week) {
      const now = new Date();
      const currentDay = now.getDay();
      const monOffset = currentDay === 0 ? -6 : 1 - currentDay;
      const monday = new Date(now);
      monday.setDate(now.getDate() + monOffset);
      const sunOffset = 7 - monday.getDay();
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + sunOffset);

      const pad = (n: number) => String(n).padStart(2, '0');
      week = `${pad(monday.getMonth() + 1)}/${pad(monday.getDate())}-${pad(sunday.getMonth() + 1)}/${pad(sunday.getDate())}`;
  }

  const scope = sp.scope || 'self';
  
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const initialSchedules = await fetch(
    `${baseUrl}/api/dashboard?week=${week}&scope=${scope}&section=schedules`,
    { cache: 'no-store' }
  ).then(r => r.json()).catch(() => null);
  
  return (
    <Suspense fallback={<div className="p-8">Loading dashboard...</div>}>
      <DashboardClient 
        initialWeek={week}
        initialScope={scope}
        initialSchedulesData={initialSchedules}
      />
    </Suspense>
  );
}
