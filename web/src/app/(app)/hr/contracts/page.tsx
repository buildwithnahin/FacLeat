import Link from 'next/link';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { deleteContractAction } from '@/server/actions/contracts';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/money';
import { AlertCircle, FileText, Calendar, PlusCircle, Search, ExternalLink } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Employee Contracts' };

interface ContractRow {
  id: string;
  contractNo: string;
  contractType: string;
  startDate: string;
  endDate: string | null;
  basicSalary: string;
  allowances: string;
  status: string;
  attachmentUrl: string | null;
  department: string | null;
  designation: string | null;
  employee: { firstName: string; lastName: string; code: string } | null;
  branch: { name: string } | null;
}

interface BranchRow {
  id: string;
  code: string;
  name: string;
}

const CONTRACT_TYPE_BADGES: Record<string, 'default' | 'secondary' | 'outline' | 'success'> = {
  CONTRACT: 'secondary',
  PROBATION: 'outline',
  INTERNSHIP: 'default',
  PERMANENT: 'success',
};

const STATUS_BADGES: Record<string, 'default' | 'success' | 'destructive' | 'outline' | 'warning'> = {
  ACTIVE: 'success',
  EXPIRING: 'warning',
  EXPIRED: 'destructive',
  RENEWED: 'default',
  TERMINATED: 'warning',
};

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; status?: string; search?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();

  const listParams = new URLSearchParams({ scope: 'employee' });
  if (params.branchId) listParams.set('branchId', params.branchId);
  if (params.status) listParams.set('status', params.status);
  if (params.search) listParams.set('search', params.search);

  const [contracts, branches] = await Promise.all([
    backendFetch<ContractRow[]>(`/api/mobile/hr/contracts?${listParams.toString()}`),
    backendFetch<BranchRow[]>('/api/mobile/branches?activeOnly=true'),
  ]);

  const today = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(today.getDate() + 30);

  const expiringSoon = contracts.filter((c) => {
    if (c.status !== 'ACTIVE' || !c.endDate) return false;
    const end = new Date(c.endDate);
    return end >= today && end <= thirtyDaysFromNow;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <PageHeader
          title="Employment Contracts"
          description="Create, manage, renew, and terminate employee employment contracts and track expirations."
        />
        {session?.permissions.includes('hr:write') && (
          <Button asChild className="w-fit">
            <Link href="/hr/contracts/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              New Contract
            </Link>
          </Button>
        )}
      </div>

      {/* Expiry Notifications */}
      {expiringSoon.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-500" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                Contracts Expiring in 30 Days ({expiringSoon.length})
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-500">
                The following active contracts are nearing expiration. Please review them for renewal, conversion, or termination.
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                {expiringSoon.map((c) => {
                  const daysLeft = Math.ceil((new Date(c.endDate!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-md border border-amber-200/60 bg-amber-100/30 px-3 py-2 text-xs dark:border-amber-900/40 dark:bg-amber-950/40"
                    >
                      <div>
                        <span className="font-semibold text-amber-900 dark:text-amber-300">
                          {c.employee?.firstName} {c.employee?.lastName}
                        </span>
                        <div className="text-[10px] text-amber-700 dark:text-amber-500">
                          {c.contractNo} · Expires in {daysLeft} days
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" asChild className="h-6 px-2 text-[10px] text-amber-900 hover:bg-amber-200 dark:text-amber-300 dark:hover:bg-amber-900">
                        <Link href={`/hr/contracts/${c.id}/edit`}>Manage</Link>
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters & Search */}
      <Card>
        <CardContent className="p-4">
          <form method="GET" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  name="search"
                  defaultValue={params.search || ''}
                  placeholder="Search Contract No or Employee..."
                  className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>

            <div>
              <select
                name="branchId"
                defaultValue={params.branchId || ''}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} · {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <select
                name="status"
                defaultValue={params.status || ''}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="EXPIRING">EXPIRING</option>
                <option value="EXPIRED">EXPIRED</option>
                <option value="RENEWED">RENEWED</option>
                <option value="TERMINATED">TERMINATED</option>
              </select>
              <Button type="submit" size="sm" className="h-9">Filter</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Contracts Table */}
      <Card>
        <CardContent className="p-0">
          {contracts.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No contracts found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Contract No</th>
                    <th className="px-4 py-3 text-left">Employee</th>
                    <th className="px-4 py-3 text-left">Branch & Role</th>
                    <th className="px-4 py-3 text-left">Contract Type</th>
                    <th className="px-4 py-3 text-left">Dates</th>
                    <th className="px-4 py-3 text-right">Compensation</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    {session?.permissions.includes('hr:write') && <th className="px-4 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {contracts.map((contract) => (
                    <tr key={contract.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">
                        {contract.contractNo}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold">
                          {contract.employee ? `${contract.employee.firstName} ${contract.employee.lastName}` : 'Unassigned employee'}
                        </div>
                        <div className="text-xs text-muted-foreground">ID: {contract.employee?.code || '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-medium">
                          {contract.branch?.name || 'All Branches'}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {contract.department || 'No Dept'} · {contract.designation || 'No Role'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={CONTRACT_TYPE_BADGES[contract.contractType] || 'outline'}>
                          {contract.contractType}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span>{new Date(contract.startDate).toISOString().slice(0, 10)}</span>
                        </div>
                        {contract.endDate ? (
                          <div className="mt-0.5 text-[10px] text-muted-foreground">
                            to {new Date(contract.endDate).toISOString().slice(0, 10)}
                          </div>
                        ) : (
                          <div className="mt-0.5 text-[10px] text-muted-foreground">Permanent</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                        <div>Basic: {formatCurrency(contract.basicSalary)}</div>
                        <div className="text-[10px] text-muted-foreground">Allow: {formatCurrency(contract.allowances)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <Badge variant={STATUS_BADGES[contract.status] || 'outline'} className="w-fit">
                            {contract.status}
                          </Badge>
                          {contract.attachmentUrl && (
                            <a
                              href={`/api/hr/contracts/${contract.id}/attachment`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-0.5 text-[10px] text-primary hover:underline"
                            >
                              <FileText className="h-3 w-3" />
                              View signed PDF
                              <ExternalLink className="h-2 w-2" />
                            </a>
                          )}
                        </div>
                      </td>
                      {session?.permissions.includes('hr:write') && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/hr/contracts/${contract.id}/edit`}>Edit</Link>
                            </Button>
                            <form
                              action={async () => {
                                'use server';
                                await deleteContractAction(contract.id);
                              }}
                            >
                              <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10">
                                Delete
                              </Button>
                            </form>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
