import React, { ReactNode, useCallback, useRef } from 'react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/shadcn-table";
import { SkeletonTable } from '@/components/ui';

export interface ColumnDef<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  width?: string;
  sortable?: boolean;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  emptyState: { icon: ReactNode; title: string; description?: string; cta?: ReactNode };
  onRowClick?: (row: T) => void;
  onRowMouseEnter?: (row: T) => void;
  selection?: { selected: Set<string>; onChange: (next: Set<string>) => void; rowKey: (row: T) => string };
  toolbar?: ReactNode;
  mobileCard?: (row: T) => ReactNode;
  sortConfig?: { key: string; direction: 'asc' | 'desc' } | null;
  onSort?: (key: string) => void;
}

export function DataTable<T>({
  columns,
  data,
  isLoading,
  isLoadingMore,
  hasMore,
  onLoadMore,
  emptyState,
  onRowClick,
  onRowMouseEnter,
  selection,
  toolbar,
  mobileCard,
  sortConfig,
  onSort
}: DataTableProps<T>) {
  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback((node: HTMLDivElement | null) => {
    if (isLoading || isLoadingMore) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        onLoadMore();
      }
    }, { threshold: 0.1 });
    
    if (node) observer.current.observe(node);
  }, [isLoading, isLoadingMore, hasMore, onLoadMore]);

  return (
    <div className="flex flex-col h-full w-full">
      {toolbar && <div className="flex-none">{toolbar}</div>}
      
      <div className="flex-1 flex flex-col min-h-0 pt-2 px-4 pb-0">
        <div className="flex-1 min-h-0 pb-4 overflow-y-auto">
          {isLoading && data.length === 0 ? (
            <>
                <div className="md:hidden grid grid-cols-2 gap-2">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-48 bg-white rounded-2xl border border-slate-100 animate-pulse" />
                    ))}
                </div>
                <div className="hidden md:block h-full">
                    <SkeletonTable rows={10} columns={columns.length} className="h-full" />
                </div>
            </>
          ) : (
            <>
              {/* Mobile View */}
              <div className="md:hidden grid grid-cols-2 gap-2 pb-8">
                {data.length === 0 ? (
                  <div className="col-span-2 text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
                    <div className="flex justify-center mb-4 text-slate-400">{emptyState.icon}</div>
                    <p className="text-slate-900 font-medium">{emptyState.title}</p>
                    {emptyState.description && <p className="text-slate-500 text-sm">{emptyState.description}</p>}
                    {emptyState.cta && <div className="mt-4">{emptyState.cta}</div>}
                  </div>
                ) : (
                  data.map((row, i) => {
                    const key = selection?.rowKey ? selection.rowKey(row) : i;
                    return (
                      <div key={key}>
                        {mobileCard ? mobileCard(row) : null}
                      </div>
                    );
                  })
                )}
                <div ref={lastElementRef} className="h-4 col-span-2" />
              </div>

              {/* Desktop View */}
              <div className="hidden md:flex md:flex-col md:flex-1 md:min-h-0 h-full">
                <div className="rounded-xl border border-gray-200 bg-white flex flex-col overflow-hidden h-full">
                  <Table className="table-fixed w-full">
                    <TableHeader className="sticky top-0 z-10 bg-white shadow-sm">
                      <TableRow>
                        {columns.map(col => (
                          <TableHead 
                            key={col.key} 
                            style={{ width: col.width }}
                            className={col.sortable && sortConfig && onSort ? 'cursor-pointer select-none hover:bg-slate-50 transition-colors group' : ''}
                            onClick={() => col.sortable && onSort && onSort(col.key)}
                          >
                            <div className="flex items-center gap-1">
                                {col.header}
                                {col.sortable && sortConfig && onSort && (
                                    <div className="flex flex-col opacity-0 group-hover:opacity-50 transition-opacity aria-[sort=ascending]:opacity-100 aria-[sort=descending]:opacity-100" aria-sort={sortConfig.key === col.key ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`mb-[-4px] ${sortConfig.key === col.key && sortConfig.direction === 'asc' ? 'text-indigo-600' : ''}`}><path d="m18 15-6-6-6 6"/></svg>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${sortConfig.key === col.key && sortConfig.direction === 'desc' ? 'text-indigo-600' : ''}`}><path d="m6 9 6 6 6-6"/></svg>
                                    </div>
                                )}
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={columns.length} className="text-center py-8 text-gray-500">
                            <div className="flex flex-col items-center justify-center">
                              <div className="mb-2 text-slate-400">{emptyState.icon}</div>
                              <p className="text-base font-medium text-gray-900">{emptyState.title}</p>
                              {emptyState.description && <p className="text-sm text-gray-500 mt-1">{emptyState.description}</p>}
                              {emptyState.cta && <div className="mt-4">{emptyState.cta}</div>}
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.map((row, i) => {
                          const key = selection?.rowKey ? selection.rowKey(row) : i;
                          return (
                            <TableRow
                              key={key}
                              className={`transition-colors ${(onRowClick || onRowMouseEnter) ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                              onClick={() => onRowClick && onRowClick(row)}
                              onMouseEnter={() => onRowMouseEnter && onRowMouseEnter(row)}
                            >
                              {columns.map(col => (
                                <TableCell key={col.key}>
                                  {col.cell(row)}
                                </TableCell>
                              ))}
                            </TableRow>
                          );
                        })
                      )}
                      {data.length > 0 && (
                        <TableRow className="border-none hover:bg-transparent">
                          <TableCell colSpan={columns.length} className="p-0">
                            <div ref={lastElementRef} className="h-1" />
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
