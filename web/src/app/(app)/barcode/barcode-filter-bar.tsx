'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback, useTransition } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export interface CompanyDto {
  id: string;
  name: string;
  code: string;
}

export interface BranchDto {
  id: string;
  name: string;
  code: string;
  companyId: string;
}

interface BarcodeFilterBarProps {
  companies: CompanyDto[];
  branches: BranchDto[];
  initialSearch?: string;
  initialCompanyId?: string;
  initialBranchId?: string;
  initialStatus?: string;
  defaultCompanyId?: string | null;
  defaultBranchId?: string | null;
}

export function BarcodeFilterBar({
  companies,
  branches,
  initialSearch = '',
  initialCompanyId = 'ALL',
  initialBranchId = 'ALL',
  initialStatus = 'ALL',
  defaultCompanyId,
  defaultBranchId,
}: BarcodeFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [selectedCompanyId, setSelectedCompanyId] = useState(initialCompanyId);
  const [selectedBranchId, setSelectedBranchId] = useState(initialBranchId);
  const [selectedStatus, setSelectedStatus] = useState(initialStatus);

  // Sync state if URL params change externally
  useEffect(() => {
    setSearchTerm(searchParams.get('search') ?? '');
    setSelectedCompanyId(searchParams.get('companyId') ?? initialCompanyId ?? 'ALL');
    setSelectedBranchId(searchParams.get('branchId') ?? initialBranchId ?? 'ALL');
    setSelectedStatus(searchParams.get('status') ?? 'ALL');
  }, [searchParams, initialCompanyId, initialBranchId]);

  const updateFilters = useCallback(
    (overrides: {
      search?: string;
      companyId?: string;
      branchId?: string;
      status?: string;
    }) => {
      const current = new URLSearchParams(searchParams.toString());

      const nextSearch = overrides.search !== undefined ? overrides.search : searchTerm;
      const nextCompany = overrides.companyId !== undefined ? overrides.companyId : selectedCompanyId;
      const nextBranch = overrides.branchId !== undefined ? overrides.branchId : selectedBranchId;
      const nextStatus = overrides.status !== undefined ? overrides.status : selectedStatus;

      if (nextSearch && nextSearch.trim()) {
        current.set('search', nextSearch.trim());
      } else {
        current.delete('search');
      }

      if (nextCompany && nextCompany !== 'ALL') {
        current.set('companyId', nextCompany);
      } else {
        current.delete('companyId');
      }

      if (nextBranch && nextBranch !== 'ALL') {
        current.set('branchId', nextBranch);
      } else {
        current.delete('branchId');
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
    [router, pathname, searchParams, searchTerm, selectedCompanyId, selectedBranchId, selectedStatus],
  );

  // Debounced search update
  useEffect(() => {
    const currentParamSearch = searchParams.get('search') ?? '';
    if (searchTerm === currentParamSearch) return;

    const timer = setTimeout(() => {
      updateFilters({ search: searchTerm });
    }, 350);

    return () => clearTimeout(timer);
  }, [searchTerm, searchParams, updateFilters]);

  const handleCompanyChange = (newCompanyId: string) => {
    setSelectedCompanyId(newCompanyId);

    // If branch doesn't belong to newly selected company, reset branch to ALL
    let nextBranchId = selectedBranchId;
    if (newCompanyId !== 'ALL') {
      const branchMatches = branches.some(
        (b) => b.id === selectedBranchId && b.companyId === newCompanyId,
      );
      if (!branchMatches) {
        nextBranchId = 'ALL';
        setSelectedBranchId('ALL');
      }
    }

    updateFilters({ companyId: newCompanyId, branchId: nextBranchId });
  };

  const handleBranchChange = (newBranchId: string) => {
    setSelectedBranchId(newBranchId);
    updateFilters({ branchId: newBranchId });
  };

  const handleStatusChange = (newStatus: string) => {
    setSelectedStatus(newStatus);
    updateFilters({ status: newStatus });
  };

  const handleClear = () => {
    setSearchTerm('');
    setSelectedCompanyId(defaultCompanyId || 'ALL');
    setSelectedBranchId(defaultBranchId || 'ALL');
    setSelectedStatus('ALL');

    startTransition(() => {
      router.push(pathname);
    });
  };

  // Filter available branches based on company selection
  const availableBranches =
    selectedCompanyId && selectedCompanyId !== 'ALL'
      ? branches.filter((b) => b.companyId === selectedCompanyId)
      : branches;

  const hasFilter = Boolean(
    searchParams.get('search') ||
      (searchParams.get('status') && searchParams.get('status') !== 'ALL') ||
      (searchParams.get('companyId') && searchParams.get('companyId') !== defaultCompanyId) ||
      (searchParams.get('branchId') && searchParams.get('branchId') !== defaultBranchId),
  );

  return (
    <Card className="p-4">
      <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-3 items-end">
        {/* Search Input */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Search</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by SKU, product name, or barcode…"
              className="pl-8"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  updateFilters({ search: '' });
                }}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Company Dropdown */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Company</label>
          <select
            value={selectedCompanyId}
            onChange={(e) => handleCompanyChange(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="ALL">All Companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>

        {/* Branch Dropdown */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Branch</label>
          <select
            value={selectedBranchId}
            onChange={(e) => handleBranchChange(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="ALL">All Branches</option>
            {availableBranches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>
        </div>

        {/* Status Dropdown */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Barcode Status</label>
          <select
            value={selectedStatus}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="ALL">All Statuses</option>
            <option value="BARCODED">Barcoded only</option>
            <option value="MISSING">Missing barcode only</option>
          </select>
        </div>

        {/* Actions / Loading State */}
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
              className="text-xs h-9"
            >
              <X className="h-3.5 w-3.5 mr-1" /> Clear
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
