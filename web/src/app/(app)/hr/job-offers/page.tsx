import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NewOfferForm } from './_components/new-offer-form';
import { decideJobOfferAction } from '@/server/actions/hr-recruitment';
import { MailOpen, FileCheck, CheckCircle2, XCircle, AlertCircle, Calendar } from 'lucide-react';
import { formatCurrency } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Job Offers Management' };

type OfferMetadata = Record<string, unknown>;

interface JobOfferRow {
  id: string;
  title: string;
  subject: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  amount: string | number | null;
  metadata: OfferMetadata | null;
}

interface CandidateRow {
  id: string;
  title: string;
  subject: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
}

const STATUS_VARIANT: Record<string, 'default' | 'outline' | 'success' | 'warning' | 'destructive'> = {
  'Job Offer Sent': 'warning',
  'Offer Accepted': 'success',
  Rejected: 'destructive',
  Joined: 'outline',
};

export default async function JobOffersPage() {
  const session = await getSession();
  const canWrite = session?.permissions.includes('hr:write') ?? false;

  const [offers, allCandidates] = await Promise.all([
    backendFetch<JobOfferRow[]>('/api/mobile/hr/recruitment/job-offers'),
    backendFetch<CandidateRow[]>('/api/mobile/hr/recruitment/candidates'),
  ]);

  const selectedCandidates = allCandidates.filter((c) => ['Selected', 'Passed'].includes(c.status));

  const totalOffersCount = offers.length;
  const pendingOffersCount = offers.filter((o) => o.status === 'Job Offer Sent').length;
  const acceptedOffersCount = offers.filter((o) => o.status === 'Offer Accepted').length;
  const rejectedOffersCount = offers.filter((o) => o.status === 'Rejected').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job Offers & Contracts"
        description="Release official offer letters, track candidate acceptances, and finalize employment terms."
      />

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Offers Issued</p>
              <p className="mt-2 text-2xl font-bold">{totalOffersCount}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <MailOpen className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Job Offer Sent</p>
              <p className="mt-2 text-2xl font-bold text-amber-600">{pendingOffersCount}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
              <AlertCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Offer Accepted</p>
              <p className="mt-2 text-2xl font-bold text-emerald-600">{acceptedOffersCount}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Declined Offers</p>
              <p className="mt-2 text-2xl font-bold text-rose-600">{rejectedOffersCount}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-600">
              <XCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {canWrite && (
        <Card className="shadow-sm border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-primary" />
              Prepare Job Offer Letter
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedCandidates.length === 0 ? (
              <div className="text-xs text-amber-600 bg-amber-50 p-4 rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                No passed or selected candidates are waiting for job offers.
              </div>
            ) : (
              <NewOfferForm
                selectedCandidates={selectedCandidates.map((c) => ({
                  id: c.id,
                  title: c.title,
                  subject: c.subject || '',
                  metadata: c.metadata,
                }))}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Offers Register */}
      <Card className="overflow-hidden">
        <div className="border-b px-6 py-4 bg-muted/20">
          <div className="font-semibold text-sm">Job Offers Register</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left font-semibold px-4 py-3">Offer No</th>
                <th className="text-left font-semibold px-4 py-3">Candidate</th>
                <th className="text-left font-semibold px-4 py-3">Position</th>
                <th className="text-right font-semibold px-4 py-3">Salary</th>
                <th className="text-left font-semibold px-4 py-3">Joining Date</th>
                <th className="text-left font-semibold px-4 py-3">Offer Expiry</th>
                <th className="text-left font-semibold px-4 py-3">Status</th>
                {canWrite && <th className="text-right font-semibold px-4 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {offers.length === 0 ? (
                <tr>
                  <td colSpan={canWrite ? 8 : 7} className="px-4 py-8 text-center text-muted-foreground">
                    No job offers registered yet.
                  </td>
                </tr>
              ) : (
                offers.map((offer) => {
                  const meta = (offer.metadata as OfferMetadata | null) || {};
                  return (
                    <tr key={offer.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-primary">
                        {(meta.offerNo as string) || offer.title}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {(meta.candidateName as string) || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{offer.subject}</div>
                        <div className="text-xs text-muted-foreground">{(meta.department as string) || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">
                        {offer.amount ? formatCurrency(offer.amount) : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {offer.startDate ? new Date(offer.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {offer.endDate ? new Date(offer.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[offer.status] || 'outline'}>{offer.status}</Badge>
                      </td>
                      {canWrite && (
                        <td className="px-4 py-3">
                          {offer.status === 'Job Offer Sent' ? (
                            <div className="flex items-center justify-end gap-2">
                              <DecideOfferForm id={offer.id} status="Offer Accepted" label="Accept" />
                              <DecideOfferForm id={offer.id} status="Rejected" label="Decline" danger />
                            </div>
                          ) : (
                            <div className="text-right text-xs text-muted-foreground italic">
                              {offer.status === 'Joined' ? 'Onboarded' : 'Processed'}
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function DecideOfferForm({ id, status, label, danger }: { id: string; status: 'Offer Accepted' | 'Rejected'; label: string; danger?: boolean }) {
  async function action() {
    'use server';
    await decideJobOfferAction(id, status);
  }
  return (
    <form action={action}>
      <Button type="submit" size="sm" variant={danger ? 'destructive' : 'outline'}>
        {label}
      </Button>
    </form>
  );
}
