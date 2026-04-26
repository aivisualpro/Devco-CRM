import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';

export const buildQueryString = (params: Record<string, any>) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            query.append(key, String(value));
        }
    });
    return query.toString();
};

function createResourceHooks<TParams extends { page?: number; limit?: number }>(endpoint: string) {
    const useResource = (params: TParams = {} as TParams, options?: any) => {
        const { page = 1, limit = 10 } = params;
        const currentParams = { ...params, page, limit };
        const queryString = buildQueryString(currentParams);
        const url = `${endpoint}?${queryString}`;
        
        const { data, error, isLoading, mutate } = useSWR(url, options);

        return {
            items: data?.items || [],
            total: data?.total || 0,
            counts: data?.counts || { all: data?.total || 0, active: 0, inactive: 0 },
            hasMore: data?.hasMore || false,
            isLoading,
            error,
            mutate
        };
    };

    const useInfiniteResource = (params: TParams = {} as TParams, options?: any) => {
        const { limit = 10 } = params;
        
        const getKey = (pageIndex: number, previousPageData: any) => {
            if (previousPageData && !previousPageData.hasMore) return null;
            
            const currentParams = { ...params, page: pageIndex + 1, limit };
            const queryString = buildQueryString(currentParams);
            const url = `${endpoint}?${queryString}`;
            
            return url;
        };

        // Separate fallbackData from other SWR options
        const { fallbackData, ...restOptions } = options || {};

        const { data, error, size, setSize, isValidating, mutate } = useSWRInfinite(getKey, {
            ...restOptions,
            fallbackData,
            revalidateFirstPage: false,
            revalidateAll: false,
            persistSize: true,
            revalidateOnFocus: false,
            dedupingInterval: 5000,
        });

        const items = data ? data.flatMap(pageData => pageData.items || []) : [];
        const isLoadingInitialData = !data && !error;
        const isLoadingMore = isLoadingInitialData || (size > 0 && data && typeof data[size - 1] === "undefined");
        const isEmpty = data?.[0]?.items?.length === 0;
        const isReachingEnd = isEmpty || (data && data[data.length - 1]?.items?.length < limit);

        return {
            items,
            total: data?.[0]?.total || 0,
            counts: data?.[0]?.counts || { all: data?.[0]?.total || 0, active: 0, inactive: 0 },
            hasMore: !isReachingEnd,
            isLoading: isLoadingInitialData,
            isValidating,
            error,
            mutate,
            size,
            setSize,
            loadMore: () => setSize(size + 1)
        };
    };

    return { useResource, useInfiniteResource };
}

export type BaseParams = { q?: string; page?: number; limit?: number; status?: string; };
export type TasksParams = BaseParams;
export type SchedulesParams = BaseParams & { from?: string; to?: string; };

const clientsHooks = createResourceHooks<BaseParams>('/api/clients');
export const useClients = clientsHooks.useResource;
export const useInfiniteClients = clientsHooks.useInfiniteResource;

const employeesHooks = createResourceHooks<BaseParams>('/api/employees');
export const useEmployees = employeesHooks.useResource;
export const useInfiniteEmployees = employeesHooks.useInfiniteResource;

const tasksHooks = createResourceHooks<TasksParams>('/api/tasks');
export const useTasks = tasksHooks.useResource;
export const useInfiniteTasks = tasksHooks.useInfiniteResource;

const schedulesHooks = createResourceHooks<SchedulesParams>('/api/schedules');
export const useSchedules = schedulesHooks.useResource;
export const useInfiniteSchedules = schedulesHooks.useInfiniteResource;

const estimatesHooks = createResourceHooks<BaseParams>('/api/estimates');
export const useEstimates = estimatesHooks.useResource;
export const useInfiniteEstimates = estimatesHooks.useInfiniteResource;

const catalogueHooks = createResourceHooks<BaseParams>('/api/catalogue');
export const useCatalogue = catalogueHooks.useResource;
export const useInfiniteCatalogue = catalogueHooks.useInfiniteResource;

const constantsHooks = createResourceHooks<BaseParams>('/api/constants');
export const useConstants = constantsHooks.useResource;
export const useInfiniteConstants = constantsHooks.useInfiniteResource;

const contactsHooks = createResourceHooks<BaseParams>('/api/contacts');
export const useContacts = contactsHooks.useResource;
export const useInfiniteContacts = contactsHooks.useInfiniteResource;

// ─── Global Employee Lookup Hook ──────────────────────────────────────
// Returns ALL active employees for lookup/dropdown/avatar use.
// Cached aggressively because employee list changes rarely.
import { useMemo } from 'react';

interface EmployeeLookup {
    _id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    profilePicture?: string;
    companyPosition?: string;
    status?: string;
    [key: string]: any;
}

const allEmployeesFetcher = async (url: string) => {
    const res = await fetch(url);
    const data = await res.json();
    return data.items || [];
};

export function useAllEmployees() {
    const { data, error, isLoading, mutate } = useSWR<EmployeeLookup[]>(
        '/api/employees?limit=100&status=Active',
        allEmployeesFetcher,
        {
            revalidateOnFocus: false,
            revalidateIfStale: false,
            dedupingInterval: 5 * 60 * 1000, // 5 minutes
            keepPreviousData: true,
        }
    );

    const employees = data || [];

    const getByEmail = useMemo(() => {
        const map = new Map<string, EmployeeLookup>();
        for (const emp of employees) {
            if (emp.email) map.set(emp.email.toLowerCase(), emp);
            if (emp._id && emp._id !== emp.email) map.set(emp._id.toLowerCase(), emp);
        }
        return (email: string) => {
            if (!email) return null;
            return map.get(email.toLowerCase()) || null;
        };
    }, [employees]);

    return { employees, getByEmail, isLoading, error, mutate };
}
