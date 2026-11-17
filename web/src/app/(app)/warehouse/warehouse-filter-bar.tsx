'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback, useTransition } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface WarehouseFilterBarProps {
  initialQuery?: string;
  initialType?: string;
  initialStatus?: string;
}

export function WarehouseFilterBar({
  initialQuery = '',
  initialType = 'ALL',
  initialStatus = 'ALL',
}: WarehouseFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [selectedType, setSelectedType] = useState(initialType);
  const [selectedStatus, setSelectedStatus] = useState(initialStatus);

  // Sync state if URL params change externally
  useEffect(() => {
    setSearchTerm(searchParams.get('q') ?? '');
    setSelectedType(searchParams.get('type') ?? 'ALL');
    setSelectedStatus(searchParams.get('status') ?? 'ALL');
  }, [searchParams]);

  const updateFilters = useCallback(
    (overrides: { q?: string; type?: string; status?: string }) => {
      const current = new URLSearchParams(searchParams.toString());

      const nextQuery = overrides.q !== undefined ? overrides.q : searchTerm;
      const nextType = overrides.type !== undefined ? overrides.type : selectedType;
      const nextStatus = overrides.status !== undefined ? overrides.status : selectedStatus;

      if (nextQuery && nextQuery.trim()) {
        current.set('q', nextQuery.trim());
      } else {
        current.delete('q');
      }

      if (nextType && nextType !== 'ALL') {
        current.set('type', nextType);
      } else {
        current.delete('type');
      }

      if (nextStatus && nextStatus !== 'ALL') {
        current.set('status', nextStatus);
      } else {
        current.delete('status');
      }

      startTransition(() => {
        const query = current.toString();
        router.push(query ? `${pathname}?${query}` : pathname);
      });
    },
    [router, pathname, searchParams, searchTerm, selectedType, selectedStatus],
  );

  // Debounced search input sync
  useEffect(() => {
    const currentParamQ = searchParams.get('q') ?? '';
    if (searchTerm === currentParamQ) return;

    const timer = setTimeout(() => {
      updateFilters({ q: searchTerm });
    }, 350);

    return () => clearTimeout(timer);
  }, [searchTerm, searchParams, updateFilters]);

  const handleTypeChange = (newType: string) => {
    setSelectedType(newType);
    updateFilters({ type: newType });
  };

  const handleStatusChange = (newStatus: string) => {
    setSelectedStatus(newStatus);
    updateFilters({ status: newStatus });
  };

  const handleClear = () => {
    setSearchTerm('');
    setSelectedType('ALL');
    setSelectedStatus('ALL');

    startTransition(() => {
      router.push(pathname);
    });
  };

  const hasFilter = Boolean(
    searchTerm.trim() ||
      (selectedType && selectedType !== 'ALL') ||
      (selectedStatus && selectedStatus !== 'ALL') ||
      searchParams.get('q') ||
      (searchParams.get('type') && searchParams.get('type') !== 'ALL') ||
      (searchParams.get('status') && searchParams.get('status') !== 'ALL'),
  );

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by code, name, branch…"
            className="pl-9 pr-8 h-9"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                updateFilters({ q: '' });
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Warehouse Type Dropdown */}
        <select
          value={selectedType}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="flex h-9 w-44 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="ALL">All types</option>
          <option value="MAIN">Main</option>
          <option value="STORE">Store</option>
          <option value="WIP">Work-in-progress</option>
          <option value="QUARANTINE">Quarantine</option>
          <option value="DAMAGED">Damaged</option>
          <option value="SHOWROOM">Showroom</option>
        </select>

        {/* Status Dropdown */}
        <select
          value={selectedStatus}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="flex h-9 w-36 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="ALL">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        {/* Loading Spinner & Clear Action */}
        <div className="flex items-center gap-2">
          {isPending && (
            <div className="flex items-center text-xs text-muted-foreground gap-1.5 px-2 py-1.5">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Updating…</span>
            </div>
          )}
          {hasFilter && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="gap-1 h-9 text-xs"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
