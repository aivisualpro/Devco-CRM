'use client';

import { useState, useEffect, useRef } from 'react';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { Search, Loader2 } from 'lucide-react';

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    clients: any[];
    employees: any[];
    estimates: any[];
    schedules: any[];
  }>({
    clients: [],
    employees: [],
    estimates: [],
    schedules: [],
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const router = useRouter();

  // Toggle the menu when Ctrl/Cmd + K is pressed
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Clear results when closed
  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults({ clients: [], employees: [], estimates: [], schedules: [] });
    }
  }, [open]);

  // Debounced search logic with AbortController
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults({ clients: [], employees: [], estimates: [], schedules: [] });
      setLoading(false);
      return;
    }

    setLoading(true);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: abortControllerRef.current?.signal,
        });
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        if (data.success) {
          setResults(data.results);
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error(error);
        }
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const onSelect = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]">
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
        onClick={() => setOpen(false)} 
      />
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 relative z-10 animate-in fade-in zoom-in-95 duration-200">
        <Command label="Global Command Menu" shouldFilter={false} loop>
          <div className="flex items-center border-b border-slate-100 px-4">
            <Search className="w-5 h-5 text-slate-400 mr-3" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search clients, employees, estimates, schedules..."
              className="w-full h-14 bg-transparent outline-none text-slate-700 placeholder:text-slate-400 text-lg"
            />
            {loading && <Loader2 className="w-5 h-5 text-slate-400 animate-spin ml-2" />}
          </div>

          <Command.List className="max-h-[60vh] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
            {!loading && query.length >= 2 && 
             results.clients.length === 0 && 
             results.employees.length === 0 && 
             results.estimates.length === 0 && 
             results.schedules.length === 0 && (
              <Command.Empty className="py-12 text-center text-sm text-slate-500 flex flex-col items-center">
                <Search className="w-8 h-8 mb-4 text-slate-300" />
                No results found for &quot;{query}&quot;
              </Command.Empty>
            )}

            {results.clients.length > 0 && (
              <Command.Group heading={`Clients (${results.clients.length})`} className="px-2 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {results.clients.map((client) => (
                  <Command.Item
                    key={client._id}
                    onSelect={() => onSelect(`/clients/${client._id}`)}
                    className="flex flex-col px-4 py-3 text-sm text-slate-700 rounded-xl cursor-pointer transition-colors aria-selected:bg-indigo-50 aria-selected:text-indigo-900 mb-1"
                  >
                    <div className="font-medium text-base">{client.name}</div>
                    {client.businessEmail && <div className="text-sm text-slate-500 mt-0.5">{client.businessEmail}</div>}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {results.employees.length > 0 && (
              <Command.Group heading={`Employees (${results.employees.length})`} className="px-2 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {results.employees.map((emp) => (
                  <Command.Item
                    key={emp._id}
                    onSelect={() => onSelect(`/employees/${emp._id}`)}
                    className="flex items-center px-4 py-3 text-sm text-slate-700 rounded-xl cursor-pointer transition-colors aria-selected:bg-indigo-50 aria-selected:text-indigo-900 mb-1 gap-3"
                  >
                    {emp.profilePicture ? (
                      <img src={emp.profilePicture} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                        {emp.firstName?.[0]}{emp.lastName?.[0]}
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-base">{emp.firstName} {emp.lastName}</div>
                      <div className="text-sm text-slate-500 mt-0.5">{emp.companyPosition || emp.appRole}</div>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {results.estimates.length > 0 && (
              <Command.Group heading={`Estimates (${results.estimates.length})`} className="px-2 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {results.estimates.map((est) => (
                  <Command.Item
                    key={est._id}
                    onSelect={() => onSelect(`/estimates/${est._id}`)}
                    className="flex flex-col px-4 py-3 text-sm text-slate-700 rounded-xl cursor-pointer transition-colors aria-selected:bg-indigo-50 aria-selected:text-indigo-900 mb-1"
                  >
                    <div className="font-medium text-base flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-mono">{est.estimate}</span>
                      {est.projectName || est.projectTitle}
                    </div>
                    <div className="text-sm text-slate-500 mt-1">{est.customerName}</div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {results.schedules.length > 0 && (
              <Command.Group heading={`Schedules (${results.schedules.length})`} className="px-2 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {results.schedules.map((sch) => (
                  <Command.Item
                    key={sch._id}
                    onSelect={() => onSelect(`/jobs/schedules/${sch._id}`)}
                    className="flex flex-col px-4 py-3 text-sm text-slate-700 rounded-xl cursor-pointer transition-colors aria-selected:bg-indigo-50 aria-selected:text-indigo-900 mb-1"
                  >
                    <div className="font-medium text-base">{sch.title}</div>
                    <div className="text-sm text-slate-500 mt-1">{sch.customerName || sch.description}</div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
