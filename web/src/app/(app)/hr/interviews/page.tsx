import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { InterviewList } from './_components/interview-list';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Interview Scheduling & Evaluation' };

interface InterviewRow {
  id: string;
  title: string;
  subject: string | null;
  status: string;
  priority: string;
  startDate: string | null;
  endDate: string | null;
  amount: string | number | null;
  owner: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
}

interface CandidateRow {
  id: string;
  title: string;
  subject: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
}

export default async function InterviewsPage() {
  const session = await getSession();
  const canWrite = session?.permissions.includes('hr:write') ?? false;

  const [interviews, shortlistedCandidatesAll] = await Promise.all([
    backendFetch<InterviewRow[]>('/api/mobile/hr/recruitment/interviews'),
    backendFetch<CandidateRow[]>('/api/mobile/hr/recruitment/candidates?status=Shortlisted'),
  ]);

  const scheduledCandidateIds = new Set(
    interviews
      .filter((item) => item.status === 'Scheduled')
      .map((item) => {
        const candidateId = item.metadata?.candidateId;
        return typeof candidateId === 'string' ? candidateId : null;
      })
      .filter((candidateId): candidateId is string => Boolean(candidateId))
  );

  const eligibleCandidates = shortlistedCandidatesAll.filter((candidate) => !scheduledCandidateIds.has(candidate.id));

  const serializedInterviews = interviews.map((item) => ({
    id: item.id,
    title: item.title,
    subject: item.subject,
    status: item.status,
    priority: item.priority,
    startDate: item.startDate ? new Date(item.startDate) : null,
    endDate: item.endDate ? new Date(item.endDate) : null,
    amount: item.amount ? Number(item.amount) : null,
    owner: item.owner,
    notes: item.notes,
    metadata: item.metadata,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Interviews & Evaluations"
        description="Schedule interview rounds, configure assessment panels, and submit candidate scores."
      />

      <InterviewList
        interviews={serializedInterviews}
        shortlistedCandidates={eligibleCandidates.map((c) => ({
          id: c.id,
          title: c.title,
          subject: c.subject || '',
          metadata: c.metadata,
        }))}
        canWrite={canWrite}
      />
    </div>
  );
}
