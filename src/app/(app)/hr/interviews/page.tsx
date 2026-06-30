import { getSession } from '@/server/auth/session';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';
import { PageHeader } from '@/components/shared/page-header';
import { InterviewList } from './_components/interview-list';

export const metadata = { title: 'Interview Scheduling & Evaluation' };

export default async function InterviewsPage() {
  const session = await getSession();
  await authorize(session, 'hr:read');
  const canWrite = session?.permissions.includes('hr:write') ?? false;

  // Fetch interviews
  const interviews = await prisma.hrWorkflowRecord.findMany({
    where: { section: 'interviews' },
    orderBy: { startDate: 'desc' },
  });

  // Fetch only shortlisted candidates who are eligible for interview scheduling
  const shortlistedCandidates = await prisma.hrWorkflowRecord.findMany({
    where: { section: 'candidates', status: 'Shortlisted' },
    orderBy: { createdAt: 'desc' },
  });

  const serializedInterviews = interviews.map((item) => ({
    id: item.id,
    title: item.title,
    subject: item.subject,
    status: item.status,
    priority: item.priority,
    startDate: item.startDate,
    endDate: item.endDate,
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
        shortlistedCandidates={shortlistedCandidates.map((c) => ({
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
