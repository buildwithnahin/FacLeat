import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NewCandidateForm } from './_components/new-candidate-form';
import { PositionFilter } from './_components/position-filter';
import { decideCandidateAction } from '@/server/actions/hr-recruitment';
import { Users, FileText, UserCheck, AlertCircle, Phone, Mail, Link as LinkIcon, Download, Filter } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Candidate Talent Pool' };

type CandidateMetadata = Record<string, unknown>;

interface RecruitmentRequestRow {
  id: string;
  title: string;
  subject: string | null;
  status: string;
  metadata: unknown;
}

interface CandidateRow {
  id: string;
  title: string;
  subject: string | null;
  status: string;
  amount: string | number | null;
  owner: string | null;
  metadata: CandidateMetadata | null;
}

const STATUS_VARIANT: Record<string, 'default' | 'outline' | 'success' | 'warning' | 'destructive'> = {
  Applied: 'default',
  Shortlisted: 'warning',
  'Interview Scheduled': 'outline',
  'Interview Completed': 'outline',
  Passed: 'success',
  Selected: 'success',
  Hold: 'outline',
  'Job Offer Sent': 'success',
  'Offer Accepted': 'success',
  'Contract Signed': 'warning',
  Joined: 'outline',
  'Employee Created': 'outline',
  Rejected: 'destructive',
};

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; reqId?: string }>;
}) {
  const { status: filterStatus, reqId: filterReqId } = await searchParams;
  const session = await getSession();
  const canWrite = session?.permissions.includes('hr:write') ?? false;

  const [allRecruitmentRequests, candidates] = await Promise.all([
    backendFetch<RecruitmentRequestRow[]>('/api/mobile/hr/recruitment/requests'),
    backendFetch<CandidateRow[]>(`/api/mobile/hr/recruitment/candidates${filterStatus ? `?status=${encodeURIComponent(filterStatus)}` : ''}`),
  ]);

  const recruitmentRequests = allRecruitmentRequests.filter((r) => r.status === 'Approved');

  const filteredCandidates = candidates.filter((cand) => {
    if (!filterReqId) return true;
    const meta = (cand.metadata as CandidateMetadata | null) || {};
    return meta.recruitmentRequestId === filterReqId;
  });

  const totalCount = candidates.length;
  const shortlistedCount = candidates.filter((c) => c.status === 'Shortlisted').length;
  const selectedCount = candidates.filter((c) => c.status === 'Passed').length;
  const rejectedCount = candidates.filter((c) => c.status === 'Rejected').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidate Pipeline"
        description="Store applicant profiles, track hiring progress, and review qualification documents."
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Applicants</p>
              <p className="mt-2 text-2xl font-bold">{totalCount}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Shortlisted</p>
              <p className="mt-2 text-2xl font-bold text-amber-600">{shortlistedCount}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
              <Filter className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Passed Interview</p>
              <p className="mt-2 text-2xl font-bold text-emerald-600">{selectedCount}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <UserCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Rejected</p>
              <p className="mt-2 text-2xl font-bold text-rose-600">{rejectedCount}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-600">
              <AlertCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {canWrite && (
        <Card className="shadow-sm border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Register New Candidate Application
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recruitmentRequests.length === 0 ? (
              <div className="text-sm text-amber-600 bg-amber-50 p-4 rounded-lg flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                No approved recruitment requests are currently active. Please create and approve a recruitment request first before adding candidates.
              </div>
            ) : (
              <NewCandidateForm
                recruitmentRequests={recruitmentRequests.map((r) => ({
                  id: r.id,
                  title: r.title,
                  subject: r.subject || '',
                  metadata: r.metadata,
                }))}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg border bg-muted/20">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase">Filter Pipeline:</span>
          <div className="flex flex-wrap gap-1.5">
            <Link href="/hr/candidates">
              <Badge variant={!filterStatus ? 'default' : 'outline'} className="cursor-pointer">
                All ({candidates.length})
              </Badge>
            </Link>
            {['Applied', 'Shortlisted', 'Interview Scheduled', 'Interview Completed', 'Passed', 'Selected', 'Job Offer Sent', 'Offer Accepted', 'Contract Signed', 'Joined', 'Employee Created', 'Hold', 'Rejected'].map((st) => {
              const count = candidates.filter((c) => c.status === st).length;
              return (
                <Link key={st} href={`/hr/candidates?status=${st}${filterReqId ? `&reqId=${filterReqId}` : ''}`}>
                  <Badge variant={filterStatus === st ? 'default' : 'outline'} className="cursor-pointer">
                    {st} ({count})
                  </Badge>
                </Link>
              );
            })}
          </div>
        </div>

        {recruitmentRequests.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-xs text-muted-foreground font-medium">Position:</span>
            <PositionFilter
              defaultValue={filterReqId || ''}
              filterStatus={filterStatus}
              recruitmentRequests={recruitmentRequests.map((r) => ({
                id: r.id,
                title: r.title,
              }))}
            />
          </div>
        )}
      </div>

      {/* Candidate Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredCandidates.length === 0 ? (
          <Card className="col-span-full py-12 text-center text-muted-foreground text-sm">
            No candidates matching the current filters.
          </Card>
        ) : (
          filteredCandidates.map((cand) => {
            const meta = (cand.metadata as CandidateMetadata | null) || {};
            return (
              <Card key={cand.id} className="relative hover:shadow-md transition-shadow">
                <CardHeader className="pb-3 flex flex-row items-start justify-between">
                  <div>
                    <span className="text-xs font-mono font-semibold text-muted-foreground">
                      {(meta.candidateId as string) || 'CAN-XXXXX'}
                    </span>
                    <CardTitle className="text-lg font-bold mt-1 text-card-foreground">
                      {cand.title}
                    </CardTitle>
                    <p className="text-xs font-medium text-primary mt-0.5">
                      Applied for: {cand.subject}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[cand.status] || 'outline'}>{cand.status}</Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Contact row */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground border-b pb-3">
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {(meta.phone as string) || '—'}
                    </div>
                    <div className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {(meta.email as string) || '—'}
                    </div>
                    <div className="flex items-center gap-1">
                      <LinkIcon className="h-3 w-3" />
                      Source: {(meta.source as string) || cand.owner || '—'}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="font-semibold text-muted-foreground block mb-0.5">Education</span>
                      <p className="text-card-foreground line-clamp-2">{(meta.education as string) || '—'}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-muted-foreground block mb-0.5">Work Experience</span>
                      <p className="text-card-foreground line-clamp-2">{(meta.experience as string) || '—'}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t text-xs">
                    <div>
                      <span className="font-semibold text-muted-foreground block">Expected Salary</span>
                      <span className="font-bold text-sm text-card-foreground">
                        {cand.amount ? `${Number(cand.amount).toLocaleString()} BDT` : '—'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {typeof meta.cvName === 'string' && meta.cvName && (
                        <a
                          href={`/api/hr/candidates/${cand.id}/cv`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 px-2 py-1 bg-muted/40 rounded text-muted-foreground text-[10px] font-mono border hover:border-primary/40 hover:text-primary transition-colors"
                          title={`Open ${meta.cvName}`}
                        >
                          <Download className="h-3 w-3" />
                          {meta.cvName}
                        </a>
                      )}
                    </div>
                  </div>

                  {canWrite && (
                    <div className="flex justify-end gap-2 pt-2 border-t">
                      {cand.status === 'Applied' && (
                        <DecideCandidateForm id={cand.id} status="Shortlisted" label="Shortlist" />
                      )}
                      {cand.status === 'Passed' && (
                        <DecideCandidateForm id={cand.id} status="Selected" label="Select" />
                      )}
                      {['Applied', 'Shortlisted'].includes(cand.status) && (
                        <DecideCandidateForm id={cand.id} status="Rejected" label="Reject" danger />
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

function DecideCandidateForm({ id, status, label, danger }: { id: string; status: 'Shortlisted' | 'Selected' | 'Rejected'; label: string; danger?: boolean }) {
  async function action() {
    'use server';
    await decideCandidateAction(id, status);
  }
  return (
    <form action={action}>
      <Button type="submit" size="sm" variant={danger ? 'destructive' : 'outline'}>
        {label}
      </Button>
    </form>
  );
}
