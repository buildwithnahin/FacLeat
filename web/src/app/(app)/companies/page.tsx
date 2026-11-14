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

export const metadata = { title: 'Companies' };

interface CompanyRow {
  id: string;
  code: string;
  name: string;
  currency: string;
  phone: string | null;
  isActive: boolean;
}

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string }>;
}) {
  const session = await getSession();
  const sp = (await searchParams) ?? {};
  const q = sp.q?.trim().toLowerCase() || '';
  const statusFilter = sp.status || '';

  const allCompanies = await backendFetch<CompanyRow[]>('/api/mobile/companies?full=1');
  const canWrite = session?.permissions.includes('companies:write') ?? false;
  const isSuperAdmin = session?.roles.some((role) => role.toLowerCase().includes('super admin')) ?? false;

  const companies = allCompanies.filter((c) => {
    if (q) {
      const match =
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (statusFilter && statusFilter !== 'ALL') {
      if (statusFilter === 'ACTIVE' && !c.isActive) return false;
      if (statusFilter === 'INACTIVE' && c.isActive) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Companies" description="Operating entities that own branches, products, and master data.">
        {canWrite && isSuperAdmin && (
          <Button asChild>
            <Link href="/companies/new">
              <Plus className="h-4 w-4" />
              New company
            </Link>
          </Button>
        )}
      </PageHeader>

      <Card>
        <CardContent className="p-4">
          <form method="GET" className="grid grid-cols-1 gap-3 md:grid-cols-3 items-end">
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
                <Link href="/companies">
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
                <th className="text-left font-semibold px-4 py-3">Currency</th>
                <th className="text-left font-semibold px-4 py-3">Phone</th>
                <th className="text-left font-semibold px-4 py-3">Status</th>
                <th className="text-right font-semibold px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {companies.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    No companies found matching the filters.
                  </td>
                </tr>
              )}
              {companies.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{c.code}</td>
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 tabular">{c.currency}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.phone ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={c.isActive ? 'success' : 'outline'}>
                      {c.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {canWrite && (
                      <div className="flex items-center justify-end">
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/companies/${c.id}`}>
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
