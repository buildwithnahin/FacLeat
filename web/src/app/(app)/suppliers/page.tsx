import Link from 'next/link';
import { Mail, Phone, MapPin, Plus, Eye, CreditCard, BookOpen } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/shared/data-table';
import { Pill } from '@/components/shared/pill';
import { KpiCard } from '@/components/shared/kpi-card';
import { backendFetch } from '@/lib/backend-client';
import { getSession } from '@/server/auth/session';
import { d, formatCurrency } from '@/lib/money';
import type { CurrencyCode } from '@/lib/money';
import { SupplierExportButton } from './supplier-export-button';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Suppliers' };

interface Search {
  status?: string;
  search?: string;
}

interface SupplierRow {
  id: string;
  code: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  country: string | null;
  currency: string;
  status: string;
  totalPurchase: string;
  dueAmount: string;
}

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const session = await getSession();
  const sp = await searchParams;
  const branchId =
    session?.activeBranchId ??
    session?.defaultBranchId ??
    session?.allowedBranchIds?.[0] ??
    undefined;

  const params = new URLSearchParams();
  if (branchId) params.set('branchId', branchId);
  if (sp.status && sp.status !== 'ALL') params.set('status', sp.status);
  if (sp.search) params.set('search', sp.search);

  const suppliers = await backendFetch<SupplierRow[]>(`/api/mobile/suppliers?${params.toString()}`);
  const hasFilter = Boolean(sp.search || (sp.status && sp.status !== 'ALL'));

  // Calculate summary metrics
  const activeCount = suppliers.filter((s) => s.status === 'ACTIVE').length;
  const totalPurchaseAll = suppliers.reduce((sum, s) => sum.plus(d(s.totalPurchase || 0)), d(0));
  const totalDueAll = suppliers.reduce(
    (sum, s) => (d(s.dueAmount).gt(0) ? sum.plus(d(s.dueAmount)) : sum),
    d(0),
  );
  const suppliersWithDue = suppliers.filter((s) => d(s.dueAmount).gt(0));

  return (
    <div className="space-y-6">
      <PageHeader title="Supplier Management" description="Manage vendors, track procurement value, and monitor accounts payable">
        <div className="flex items-center gap-2">
          <SupplierExportButton suppliers={suppliers} />
          <Button variant="outline" asChild>
            <Link href="/suppliers/payments">
              <CreditCard className="h-4 w-4 mr-1.5" />
              Payment Register
            </Link>
          </Button>
          <Button variant="dark" asChild>
            <Link href="/suppliers/new">
              <Plus className="h-4 w-4 mr-1.5" />
              Add Supplier
            </Link>
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Active Suppliers"
          value={activeCount}
          description={`${suppliers.length} total registered`}
        />
        <KpiCard
          label="Total Procurement"
          value={formatCurrency(totalPurchaseAll, 'BDT')}
          description="Cumulative purchase volume"
        />
        <KpiCard
          label="Total Accounts Payable"
          value={formatCurrency(totalDueAll, 'BDT')}
          tone={totalDueAll.gt(0) ? 'danger' : 'success'}
          description="Pending vendor liabilities"
        />
        <KpiCard
          label="Vendors with Due"
          value={suppliersWithDue.length}
          tone={suppliersWithDue.length > 0 ? 'warning' : 'neutral'}
          description={suppliersWithDue.length > 0 ? 'Require payment settlement' : 'All accounts settled'}
        />
      </div>

      <Card className="p-4">
        <form className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-3 items-end">
          <div>
            <Input
              name="search"
              placeholder="Search by code, supplier name, contact, phone or email…"
              defaultValue={sp.search ?? ''}
            />
          </div>
          <div>
            <select
              name="status"
              defaultValue={sp.status ?? 'ALL'}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="BLOCKED">Blocked</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="outline">
              Filter
            </Button>
            {hasFilter && (
              <Button variant="ghost" asChild>
                <Link href="/suppliers">Clear</Link>
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card className="p-0">
        <div className="px-4 py-3 border-b text-sm font-medium flex items-center justify-between">
          <span>{suppliers.length} Supplier{suppliers.length === 1 ? '' : 's'}</span>
          <span className="text-xs text-muted-foreground">Sorted alphabetically by supplier code</span>
        </div>
        <DataTable
          rows={suppliers}
          rowKey={(r) => r.id}
          empty="No suppliers found. Click 'Add Supplier' to register your first vendor."
          columns={[
            {
              key: 'code',
              header: 'Supplier Code',
              cell: (r) => (
                <Link href={`/suppliers/${r.id}`} className="font-mono text-xs font-semibold hover:underline">
                  {r.code}
                </Link>
              ),
            },
            {
              key: 'name',
              header: 'Supplier Name',
              cell: (r) => (
                <div>
                  <Link href={`/suppliers/${r.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
                    {r.name}
                  </Link>
                  {r.contactPerson && (
                    <div className="text-xs text-muted-foreground">Attn: {r.contactPerson}</div>
                  )}
                </div>
              ),
            },
            {
              key: 'contact',
              header: 'Phone / Email',
              cell: (r) => (
                <div className="space-y-0.5 text-xs">
                  {r.phone && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      <span>{r.phone}</span>
                    </div>
                  )}
                  {r.email && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      <span>{r.email}</span>
                    </div>
                  )}
                  {!r.phone && !r.email && <span className="text-muted-foreground">—</span>}
                </div>
              ),
            },
            {
              key: 'location',
              header: 'Location',
              cell: (r) => (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span>{r.city ?? r.country ?? '—'}</span>
                </div>
              ),
            },
            {
              key: 'totalPurchase',
              header: 'Total Procured',
              align: 'right',
              cell: (r) => (
                <span className="tabular font-medium">
                  {formatCurrency(r.totalPurchase, (r.currency || 'BDT') as CurrencyCode)}
                </span>
              ),
            },
            {
              key: 'due',
              header: 'Outstanding Due',
              align: 'right',
              cell: (r) => {
                const isDue = d(r.dueAmount).gt(0);
                return (
                  <span className={`tabular font-bold ${isDue ? 'text-destructive' : 'text-emerald-600'}`}>
                    {formatCurrency(r.dueAmount, (r.currency || 'BDT') as CurrencyCode)}
                  </span>
                );
              },
            },
            {
              key: 'status',
              header: 'Status',
              cell: (r) => (
                <Pill tone={r.status === 'ACTIVE' ? 'green' : r.status === 'BLOCKED' ? 'red' : 'neutral'}>
                  {r.status.toLowerCase()}
                </Pill>
              ),
            },
            {
              key: 'actions',
              header: 'Actions',
              align: 'right',
              cell: (r) => {
                const isDue = d(r.dueAmount).gt(0);
                return (
                  <div className="flex items-center justify-end gap-1.5">
                    <Button variant="ghost" size="sm" asChild className="h-8 px-2">
                      <Link href={`/suppliers/${r.id}`} title="View Details">
                        <Eye className="h-3.5 w-3.5" />
                        <span className="sr-only">View</span>
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild className="h-8 px-2">
                      <Link href={`/suppliers/${r.id}/ledger`} title="Statement of Account / Ledger">
                        <BookOpen className="h-3.5 w-3.5" />
                        <span className="sr-only">Ledger</span>
                      </Link>
                    </Button>
                    {isDue && (
                      <Button variant="outline" size="sm" asChild className="h-8 px-2.5 text-xs font-semibold">
                        <Link href={`/suppliers/${r.id}/pay`}>
                          Pay
                        </Link>
                      </Button>
                    )}
                  </div>
                );
              },
            },
          ]}
        />
      </Card>
    </div>
  );
}
