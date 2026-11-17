'use client';

import { useState, useMemo, useEffect, useCallback, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Plus, Pencil, Tag, Layers, Search, FolderTree, X, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { CreateTypeDialog, type CategoryTypeDto } from './create-type-dialog';

export interface CategoryRow {
  id: string;
  name: string;
  type?: string | null;
  description: string | null;
  parent: { id: string; name: string } | null;
  _count: { products: number; children: number };
}

interface CategoriesViewProps {
  categories: CategoryRow[];
  types: CategoryTypeDto[];
  canWrite: boolean;
  initialSearch?: string;
  initialType?: string;
}

export function CategoriesView({
  categories,
  types: initialTypes,
  canWrite,
  initialSearch = '',
  initialType = 'ALL',
}: CategoriesViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [types, setTypes] = useState<CategoryTypeDto[]>(initialTypes);
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [selectedType, setSelectedType] = useState<string>(initialType);

  // Sync state if URL search parameters change externally
  useEffect(() => {
    const urlSearch = searchParams.get('search') ?? '';
    const urlType = searchParams.get('type') ?? 'ALL';
    setSearchTerm(urlSearch);
    setSelectedType(urlType);
  }, [searchParams]);

  const updateUrl = useCallback(
    (overrides: { search?: string; type?: string }) => {
      const current = new URLSearchParams(searchParams.toString());

      const nextSearch = overrides.search !== undefined ? overrides.search : searchTerm;
      const nextType = overrides.type !== undefined ? overrides.type : selectedType;

      if (nextSearch && nextSearch.trim()) {
        current.set('search', nextSearch.trim());
      } else {
        current.delete('search');
      }

      if (nextType && nextType !== 'ALL') {
        current.set('type', nextType);
      } else {
        current.delete('type');
      }

      startTransition(() => {
        const query = current.toString();
        router.push(query ? `${pathname}?${query}` : pathname);
      });
    },
    [router, pathname, searchParams, searchTerm, selectedType],
  );

  // Debounced search sync to URL
  useEffect(() => {
    const urlSearch = searchParams.get('search') ?? '';
    if (searchTerm === urlSearch) return;

    const timer = setTimeout(() => {
      updateUrl({ search: searchTerm });
    }, 350);

    return () => clearTimeout(timer);
  }, [searchTerm, searchParams, updateUrl]);

  const handleTypeCreated = (newType: CategoryTypeDto) => {
    setTypes((prev) => {
      if (prev.some((t) => t.code === newType.code)) return prev;
      return [...prev, newType].sort((a, b) => a.name.localeCompare(b.name));
    });
    setSelectedType(newType.code);
    updateUrl({ type: newType.code });
  };

  const handleTypeChange = (newType: string) => {
    setSelectedType(newType);
    updateUrl({ type: newType });
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedType('ALL');
    startTransition(() => {
      router.push(pathname);
    });
  };

  // Map for fast label lookup by code or name
  const typeMap = useMemo(() => {
    const map = new Map<string, string>();
    types.forEach((t) => {
      map.set(t.code.toUpperCase(), t.name);
      map.set(t.name.toUpperCase(), t.name);
    });
    return map;
  }, [types]);

  // Count categories per type
  const typeCategoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    categories.forEach((c) => {
      if (c.type) {
        const key = c.type.toUpperCase();
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    });
    return counts;
  }, [categories]);

  // Robust, real-time client filter
  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      // 1. Filter by category type
      if (selectedType !== 'ALL') {
        if (selectedType === 'UNASSIGNED') {
          if (cat.type && cat.type.trim()) return false;
        } else {
          const selUpper = selectedType.toUpperCase();
          const catUpper = (cat.type ?? '').toUpperCase();
          if (catUpper !== selUpper) {
            // Also match if selected is type name vs code
            const typeObj = types.find(
              (t) => t.code.toUpperCase() === selUpper || t.name.toUpperCase() === selUpper,
            );
            const matchesCodeOrName =
              typeObj &&
              (catUpper === typeObj.code.toUpperCase() || catUpper === typeObj.name.toUpperCase());
            if (!matchesCodeOrName) {
              return false;
            }
          }
        }
      }

      // 2. Filter by search input
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const typeLabel = cat.type ? (typeMap.get(cat.type.toUpperCase()) || cat.type).toLowerCase() : '';
        const nameMatches = cat.name.toLowerCase().includes(q);
        const parentMatches = (cat.parent?.name ?? '').toLowerCase().includes(q);
        const descMatches = (cat.description ?? '').toLowerCase().includes(q);
        const typeMatches = typeLabel.includes(q) || (cat.type ?? '').toLowerCase().includes(q);

        if (!nameMatches && !parentMatches && !descMatches && !typeMatches) {
          return false;
        }
      }

      return true;
    });
  }, [categories, selectedType, searchTerm, typeMap, types]);

  const hasFilterActive = Boolean(
    searchTerm.trim() ||
      (selectedType !== 'ALL' && selectedType !== '') ||
      searchParams.get('search') ||
      (searchParams.get('type') && searchParams.get('type') !== 'ALL'),
  );

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Product Categories & Types</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Organize inventory products by category and dynamic classification types (raw materials, finished goods, WIP, consumables).
          </p>
        </div>

        {canWrite && (
          <div className="flex items-center gap-2">
            <CreateTypeDialog onTypeCreated={handleTypeCreated} />
            <Button asChild>
              <Link href="/inventory/categories/new">
                <Plus className="h-4 w-4 mr-1.5" />
                New Category
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <FolderTree className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Categories</p>
            <p className="text-2xl font-semibold mt-0.5 tabular-nums">{categories.length}</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
            <Tag className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Classification Types</p>
            <p className="text-2xl font-semibold mt-0.5 tabular-nums text-emerald-600">{types.length}</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Mapped Products</p>
            <p className="text-2xl font-semibold mt-0.5 tabular-nums text-blue-600">
              {categories.reduce((acc, c) => acc + (c._count?.products || 0), 0)}
            </p>
          </div>
        </Card>
      </div>

      {/* Filters & Search Toolbar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_auto] gap-3 items-end">
          {/* Search Box */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Search Categories</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by category name, parent, description, or type…"
                className="pl-8 pr-8"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    updateUrl({ search: '' });
                  }}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Type Filter */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Filter by Classification Type</label>
            <select
              value={selectedType}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="ALL">All Types ({categories.length})</option>
              <option value="UNASSIGNED">Unassigned Type</option>
              {types.map((t) => {
                const count = typeCategoryCounts.get(t.code.toUpperCase()) || 0;
                return (
                  <option key={t.id || t.code} value={t.code}>
                    {t.name} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {isPending && (
              <div className="flex items-center text-xs text-muted-foreground gap-1.5 px-2 py-1.5">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>Updating…</span>
              </div>
            )}
            {hasFilterActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-9 text-xs"
              >
                <X className="h-3.5 w-3.5 mr-1" /> Clear Filters
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Categories Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left font-semibold px-4 py-3">Category Name</th>
                <th className="text-left font-semibold px-4 py-3">Type</th>
                <th className="text-left font-semibold px-4 py-3">Parent</th>
                <th className="text-left font-semibold px-4 py-3">Description</th>
                <th className="text-right font-semibold px-4 py-3">Products</th>
                <th className="text-right font-semibold px-4 py-3">Sub-categories</th>
                <th className="text-right font-semibold px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredCategories.map((c) => {
                const typeLabel = c.type
                  ? typeMap.get(c.type.toUpperCase()) || c.type.replace(/_/g, ' ')
                  : null;
                return (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                    <td className="px-4 py-3">
                      {typeLabel ? (
                        <Badge variant="outline" className="font-normal text-xs bg-muted/60">
                          <Tag className="h-3 w-3 mr-1 text-primary" />
                          {typeLabel}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs italic">— Unassigned —</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.parent?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                      {c.description ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {c._count?.products ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {c._count?.children ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      {canWrite && (
                        <div className="flex items-center justify-end">
                          <Button size="sm" variant="ghost" asChild>
                            <Link href={`/inventory/categories/${c.id}`}>
                              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                            </Link>
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredCategories.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <p className="font-medium">No categories match the filter criteria.</p>
                    <p className="text-xs mt-1">Try selecting a different type or clearing search filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
