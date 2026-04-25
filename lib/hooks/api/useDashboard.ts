import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useDashboard(week: string, scope: 'self' | 'all', section: string = 'all', initialData?: any, estimateFilter: string = 'this_month') {
  return useSWR(
    ['/api/dashboard', week, scope, section, estimateFilter], 
    ([url, w, s, sec, ef]) => fetcher(`${url}?week=${w}&scope=${s}&section=${sec}&estimateFilter=${ef}`),
    {
      fallbackData: initialData,
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      keepPreviousData: true,
    }
  );
}
