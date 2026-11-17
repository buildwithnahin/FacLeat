import Link from 'next/link';
import { getSession } from '@/server/auth/session';
import { Plus, Pencil } from 'lucide-react';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WarehouseFilterBar } from './warehouse-filter-bar';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Warehouses' };

interface WarehouseRow {
  id: string;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
  branch: { name: string; code: string };
}

interface SearchParams {
  q?: string;
  type?: string;
  status?: string;
}

export default async function WarehousesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const session = await getSession();
  const params = (await searchParams) ?? {};
  const query = (params.q ?? '').trim().toLowerCase();
  const typeFilter = params.type && params.type !== 'ALL' ? params.type.toUpperCase() : undefined;
  const statusFilter = params.status && params.status !== 'ALL' ? params.status : undefined;

  const allWarehouses = await backendFetch<WarehouseRow[]>('/api/mobile/warehouse/warehouses');
  const canWrite = session?.permissions.includes('inventory:write') ?? false;

  const warehouses = allWarehouses.filter((w) => {
    if (query) {
      const matchName = w.name.toLowerCase().includes(query);
      const matchCode = w.code.toLowerCase().includes(query);
      const matchBranch = w.branch.name.toLowerCase().includes(query) || w.branch.code.toLowerCase().includes(query);
      if (!matchName && !matchCode && !matchBranch) return false;
    }
    if (typeFilter && w.type.toUpperCase() !== typeFilter) return false;
    if (statusFilter === 'active' && !w.isActive) return false;
    if (statusFilter === 'inactive' && w.isActive) return false;
    return true;
  });

  const hasFilter = Boolean(params.q || (params.type && params.type !== 'ALL') || (params.status && params.status !== 'ALL'));

  return (
    <div className="space-y-6">
      <PageHeader title="Warehouses" description="Physical stock locations. Goods flow through these for receive / issue / transfer.">
        {canWrite && (
          <Button asChild>
            <Link href="/warehouse/new">
              <Plus className="h-4 w-4" />
              New warehouse
            </Link>
          </Button>
        )}
      </PageHeader>

      {/* Real-time Reactive Filter bar */}
      <WarehouseFilterBar
        initialQuery={params.q ?? ''}
        initialType={params.type ?? 'ALL'}
        initialStatus={params.status ?? 'ALL'}
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left font-semibold px-4 py-3">Branch</th>
                <th className="text-left font-semibold px-4 py-3">Code</th>
                <th className="text-left font-semibold px-4 py-3">Name</th>
                <th className="text-left font-semibold px-4 py-3">Type</th>
                <th className="text-left font-semibold px-4 py-3">Status</th>
                <th className="text-right font-semibold px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {warehouses.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    {hasFilter ? 'No warehouses match the selected filters.' : 'No warehouses yet.'}
                  </td>
                </tr>
              )}
              {warehouses.map((w) => (
                <tr key={w.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <span className="font-medium">{w.branch.name}</span>{' '}
                    <span className="text-xs text-muted-foreground">({w.branch.code})</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{w.code}</td>
                  <td className="px-4 py-3 font-medium">{w.name}</td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{w.type.toLowerCase()}</td>
                  <td className="px-4 py-3">
                    <Badge variant={w.isActive ? 'success' : 'outline'}>
                      {w.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {canWrite && (
                      <div className="flex items-center justify-end">
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/warehouse/${w.id}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
