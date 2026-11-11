import Link from 'next/link';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Calendar, ExternalLink, FileText, Search } from 'lucide-react';
import { formatCurrency } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Offer Contracts' };

interface ContractRow {
  id: string;
  contractNo: string;
  candidateName: string | null;
  offerId: string | null;
  designation: string | null;
  department: string | null;
  startDate: string;
  endDate: string | null;
  basicSalary: string;
  allowances: string;
  status: string;
  attachmentUrl: string | null;
}

interface BranchRow {
  id: string;
  code: string;
  name: string;
}

const STATUS_BADGES: Record<string, 'default' | 'success' | 'destructive' | 'outline' | 'warning'> = {
  DRAFT: 'outline',
  PENDING_APPROVAL: 'warning',
  SENT: 'default',
  SIGNED: 'success',
  WAITING_FOR_JOINING: 'warning',
};

export default async function OfferContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; status?: string; search?: string }>;
}) {
  const params = await searchParams;
  await getSession();

  const listParams = new URLSearchParams({ scope: 'offer' });
  if (params.branchId) listParams.set('branchId', params.branchId);
  if (params.status) listParams.set('status', params.status);
  if (params.search) listParams.set('search', params.search);

  const [contracts, branches] = await Promise.all([
    backendFetch<ContractRow[]>(`/api/mobile/hr/contracts?${listParams.toString()}`),
    backendFetch<BranchRow[]>('/api/mobile/branches?activeOnly=true'),
  ]);

  const waitingForJoining = contracts.filter((contract) => contract.status === 'WAITING_FOR_JOINING').length;
  const signedCount = contracts.filter((contract) => contract.status === 'SIGNED').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offer Contracts"
        description="Manage pre-employment contracts tied to recruitment offers before candidates officially join."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Pre-Join Contracts</p>
            <p className="mt-2 text-2xl font-bold">{contracts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Signed</p>
            <p className="mt-2 text-2xl font-bold text-emerald-600">{signedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Waiting For Joining</p>
            <p className="mt-2 text-2xl font-bold text-amber-600">{waitingForJoining}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <form method="GET" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                name="search"
                defaultValue={params.search || ''}
                placeholder="Search contract no or candidate..."
                className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

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

            <div className="flex gap-2">
              <select
                name="status"
                defaultValue={params.status || ''}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">All Statuses</option>
                <option value="DRAFT">DRAFT</option>
                <option value="PENDING_APPROVAL">PENDING_APPROVAL</option>
                <option value="SENT">SENT</option>
                <option value="SIGNED">SIGNED</option>
                <option value="WAITING_FOR_JOINING">WAITING_FOR_JOINING</option>
              </select>
              <Button type="submit" size="sm" className="h-9">Filter</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {contracts.length === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Offer-accepted candidates will create draft offer contracts here automatically.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Contract No</th>
                    <th className="px-4 py-3 text-left">Candidate</th>
                    <th className="px-4 py-3 text-left">Role</th>
                    <th className="px-4 py-3 text-left">Dates</th>
                    <th className="px-4 py-3 text-right">Compensation</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {contracts.map((contract) => (
                    <tr key={contract.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{contract.contractNo}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold">{contract.candidateName || 'Unknown Candidate'}</div>
                        <div className="text-xs text-muted-foreground">{contract.offerId ? `Offer Ref: ${contract.offerId}` : 'Offer link unavailable'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{contract.designation || 'Pending role'}</div>
                        <div className="text-xs text-muted-foreground">{contract.department || 'Pending department'}</div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span>{new Date(contract.startDate).toISOString().slice(0, 10)}</span>
                        </div>
                        <div className="text-muted-foreground">
                          {contract.endDate ? `to ${new Date(contract.endDate).toISOString().slice(0, 10)}` : 'Open-ended'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div>{formatCurrency(contract.basicSalary)}</div>
                        <div className="text-[10px] text-muted-foreground">Allow: {formatCurrency(contract.allowances)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_BADGES[contract.status] || 'outline'}>{contract.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {contract.attachmentUrl && (
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/api/hr/contracts/${contract.id}/attachment`} target="_blank">
                                <ExternalLink className="mr-1 h-3.5 w-3.5" />
                                File
                              </Link>
                            </Button>
                          )}
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/hr/offer-contracts/${contract.id}/edit`}>
                              <FileText className="mr-1 h-3.5 w-3.5" />
                              Manage
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
