import Link from 'next/link';
import { Plus, Pencil, Search, RotateCcw } from 'lucide-react';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Branches' };

interface BranchRow {
  id: string;
  code: string;
  name: string;
  type: string;
  currency: string;
  phone: string | null;
  isActive: boolean;
}

export default async function BranchesPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; type?: string; status?: string }>;
}) {
  const session = await getSession();
  const sp = (await searchParams) ?? {};
  const q = sp.q?.trim().toLowerCase() || '';
  const typeFilter = sp.type || '';
  const statusFilter = sp.status || '';

  const allBranches = await backendFetch<BranchRow[]>('/api/mobile/branches?full=1');
  const canWrite = session?.permissions.includes('branches:write') ?? false;

  const branches = allBranches.filter((b) => {
    if (q) {
      const match =
        b.code.toLowerCase().includes(q) ||
        b.name.toLowerCase().includes(q) ||
        (b.phone && b.phone.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (typeFilter && typeFilter !== 'ALL' && b.type !== typeFilter) {
      return false;
    }
    if (statusFilter && statusFilter !== 'ALL') {
      if (statusFilter === 'ACTIVE' && !b.isActive) return false;
      if (statusFilter === 'INACTIVE' && b.isActive) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Branches" description="Physical locations: head office, factories, showrooms, warehouses.">
        {canWrite && (
          <Button asChild>
            <Link href="/branches/new">
              <Plus className="h-4 w-4" />
              New branch
            </Link>
          </Button>
        )}
      </PageHeader>

      <Card>
        <CardContent className="p-4">
          <form method="GET" className="grid grid-cols-1 gap-3 md:grid-cols-4 items-end">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Search</label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  name="q"
                  placeholder="Code, name, phone…"
                  defaultValue={q}
                  className="pl-8 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <select
                name="type"
                defaultValue={typeFilter}
                aria-label="Filter by type"
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="ALL">All Types</option>
                <option value="MAIN">Main</option>
                <option value="FACTORY">Factory</option>
                <option value="SHOWROOM">Showroom</option>
                <option value="WAREHOUSE">Warehouse</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <select
                name="status"
                defaultValue={statusFilter}
                aria-label="Filter by status"
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                Filter
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/branches">
                  <RotateCcw className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left font-semibold px-4 py-3">Code</th>
                <th className="text-left font-semibold px-4 py-3">Name</th>
                <th className="text-left font-semibold px-4 py-3">Type</th>
                <th className="text-left font-semibold px-4 py-3">Currency</th>
                <th className="text-left font-semibold px-4 py-3">Phone</th>
                <th className="text-left font-semibold px-4 py-3">Status</th>
                <th className="text-right font-semibold px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {branches.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    No branches found matching the filters.
                  </td>
                </tr>
              )}
              {branches.map((b) => (
                <tr key={b.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{b.code}</td>
                  <td className="px-4 py-3 font-medium">{b.name}</td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{b.type.toLowerCase()}</td>
                  <td className="px-4 py-3 tabular">{b.currency}</td>
                  <td className="px-4 py-3 text-muted-foreground">{b.phone ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={b.isActive ? 'success' : 'outline'}>
                      {b.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {canWrite && (
                      <div className="flex items-center justify-end">
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/branches/${b.id}`}>
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
