import 'server-only';

import type { Prisma } from '@prisma/client';
import { authorize } from '@/server/auth/authorize';
import type { AppSession } from '@/server/auth/session';
import { prisma } from '@/server/db';

export const RECRUITMENT_REPORT_TYPES = [
  'RECRUITMENT_REQUEST',
  'VACANCY',
  'CANDIDATE',
  'INTERVIEW_SCHEDULE',
  'INTERVIEW_RESULT',
  'JOB_OFFER',
  'JOINING',
  'PIPELINE',
  'SUMMARY',
] as const;

export type RecruitmentReportType = (typeof RECRUITMENT_REPORT_TYPES)[number];

export type RecruitmentReportFilters = {
  reportType?: RecruitmentReportType;
  branchId?: string;
  department?: string;
  jobPosition?: string;
  recruitmentRequestId?: string;
  recruiterId?: string;
  interviewer?: string;
  candidateStatus?: string;
  dateFrom?: string;
  dateTo?: string;
};

type WorkflowRecord = Prisma.HrWorkflowRecordGetPayload<Prisma.HrWorkflowRecordDefaultArgs>;
type UserRecord = { id: string; name: string };

function formatDate(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : '—';
}

function asObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeDateStart(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function normalizeDateEnd(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function stageFromCandidateStatus(status: string) {
  if (['Applied', 'Shortlisted'].includes(status)) return 'Screening';
  if (['Interview Scheduled', 'Interview Completed', 'Passed', 'Hold', 'Selected'].includes(status)) return 'Interview';
  if (['Job Offer Sent', 'Offer Accepted', 'Contract Signed'].includes(status)) return 'Offer';
  if (['Joined', 'Employee Created'].includes(status)) return 'Joining';
  if (status === 'Rejected') return 'Closed';
  return 'Pipeline';
}

function countBy<T extends string>(items: T[]) {
  const map = new Map<string, number>();
  for (const item of items) {
    map.set(item, (map.get(item) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function recordDateForReport(reportType: RecruitmentReportType, record: WorkflowRecord) {
  if (reportType === 'INTERVIEW_SCHEDULE' || reportType === 'INTERVIEW_RESULT' || reportType === 'JOINING') {
    return record.startDate ?? record.createdAt;
  }
  return record.createdAt;
}

function matchesCommonFilters(
  reportType: RecruitmentReportType,
  record: WorkflowRecord,
  filters: RecruitmentReportFilters,
  candidateById: Map<string, WorkflowRecord>,
  requestById: Map<string, WorkflowRecord>,
) {
  const meta = asObject(record.metadata);
  const candidateId = typeof meta.candidateId === 'string' ? meta.candidateId : '';
  const candidate = candidateId ? candidateById.get(candidateId) ?? null : null;
  const candidateMeta = candidate ? asObject(candidate.metadata) : {};
  const requestId =
    typeof meta.recruitmentRequestId === 'string'
      ? meta.recruitmentRequestId
      : typeof candidateMeta.recruitmentRequestId === 'string'
        ? candidateMeta.recruitmentRequestId
        : '';
  const request = requestId ? requestById.get(requestId) ?? null : null;

  const department =
    (typeof meta.department === 'string' && meta.department) ||
    (typeof candidateMeta.department === 'string' && candidateMeta.department) ||
    request?.subject ||
    record.subject ||
    '';
  const jobPosition =
    request?.title ||
    candidate?.subject ||
    record.subject ||
    record.title ||
    '';

  if (filters.branchId && record.branchId !== filters.branchId) return false;
  if (filters.department && department !== filters.department) return false;
  if (filters.jobPosition && jobPosition !== filters.jobPosition) return false;
  if (filters.recruitmentRequestId && requestId !== filters.recruitmentRequestId) return false;
  if (filters.recruiterId && record.createdById !== filters.recruiterId) return false;
  if (filters.interviewer && record.owner !== filters.interviewer) return false;
  if (filters.candidateStatus && candidate && candidate.status !== filters.candidateStatus) return false;

  const from = normalizeDateStart(filters.dateFrom);
  const to = normalizeDateEnd(filters.dateTo);
  const recordDate = recordDateForReport(reportType, record);
  if (from && recordDate < from) return false;
  if (to && recordDate > to) return false;

  return true;
}

function buildReportRows(
  reportType: RecruitmentReportType,
  requests: WorkflowRecord[],
  candidates: WorkflowRecord[],
  interviews: WorkflowRecord[],
  offers: WorkflowRecord[],
  joining: WorkflowRecord[],
  usersById: Map<string, string>,
) {
  const candidateById = new Map(candidates.map((record) => [record.id, record]));

  switch (reportType) {
    case 'RECRUITMENT_REQUEST':
      return {
        title: 'Recruitment Request Report',
        description: 'All manpower requests that match the selected filters.',
        columns: ['Request No', 'Department', 'Position', 'Requested By', 'Vacancies', 'Status', 'Approved Date'],
        rows: requests.map((record) => {
          const meta = asObject(record.metadata);
          const approvals = Array.isArray(meta.approvals) ? meta.approvals : [];
          const lastApproval = approvals.at(-1);
          const approvedDate = lastApproval && typeof lastApproval.decidedAt === 'string' ? lastApproval.decidedAt.slice(0, 10) : '—';
          return [
            typeof meta.requestNo === 'string' ? meta.requestNo : record.id,
            record.subject ?? '—',
            record.title,
            record.createdById ? usersById.get(record.createdById) ?? 'System' : 'System',
            Number(record.amount ?? 0),
            record.status,
            approvedDate,
          ];
        }),
      };
    case 'VACANCY': {
      const joinedByRequest = new Map<string, number>();
      for (const record of joining) {
        const meta = asObject(record.metadata);
        const candidateId = typeof meta.candidateId === 'string' ? meta.candidateId : '';
        const candidate = candidateId ? candidateById.get(candidateId) : null;
        const candidateMeta = candidate ? asObject(candidate.metadata) : {};
        const requestId = typeof candidateMeta.recruitmentRequestId === 'string' ? candidateMeta.recruitmentRequestId : '';
        if (!requestId) continue;
        joinedByRequest.set(requestId, (joinedByRequest.get(requestId) ?? 0) + 1);
      }
      return {
        title: 'Vacancy Report',
        description: 'Approved vacancies, filled headcount, and remaining openings.',
        columns: ['Position', 'Department', 'Approved Vacancies', 'Filled', 'Remaining'],
        rows: requests
          .filter((record) => record.status === 'Approved')
          .map((record) => {
            const approved = Number(record.amount ?? 0);
            const filled = joinedByRequest.get(record.id) ?? 0;
            return [record.title, record.subject ?? '—', approved, filled, Math.max(approved - filled, 0)];
          }),
      };
    }
    case 'CANDIDATE':
      return {
        title: 'Candidate Report',
        description: 'Candidate applications and their latest stage in the hiring process.',
        columns: ['Candidate', 'Applied Position', 'Department', 'Application Date', 'Current Stage', 'Status'],
        rows: candidates.map((record) => {
          const meta = asObject(record.metadata);
          return [
            record.title,
            record.subject ?? '—',
            typeof meta.department === 'string' ? meta.department : '—',
            formatDate(record.createdAt),
            stageFromCandidateStatus(record.status),
            record.status,
          ];
        }),
      };
    case 'INTERVIEW_SCHEDULE':
      return {
        title: 'Interview Schedule Report',
        description: 'Scheduled interview rounds and assigned panels.',
        columns: ['Interview Date', 'Candidate', 'Position', 'Interviewer', 'Status'],
        rows: interviews.map((record) => {
          const meta = asObject(record.metadata);
          const candidateId = typeof meta.candidateId === 'string' ? meta.candidateId : '';
          const candidate = candidateId ? candidateById.get(candidateId) : null;
          return [
            formatDate(record.startDate),
            (typeof meta.candidateName === 'string' && meta.candidateName) || candidate?.title || '—',
            candidate?.subject ?? '—',
            record.owner ?? '—',
            record.status,
          ];
        }),
      };
    case 'INTERVIEW_RESULT':
      return {
        title: 'Interview Result Report',
        description: 'Completed interviews with scores and recommendations.',
        columns: ['Candidate', 'Position', 'Result', 'Score', 'Recommendation'],
        rows: interviews
          .filter((record) => record.status === 'Interview Completed')
          .map((record) => {
            const meta = asObject(record.metadata);
            const candidateId = typeof meta.candidateId === 'string' ? meta.candidateId : '';
            const candidate = candidateId ? candidateById.get(candidateId) : null;
            const recommendation = typeof meta.recommendation === 'string' ? meta.recommendation : '—';
            return [
              (typeof meta.candidateName === 'string' && meta.candidateName) || candidate?.title || '—',
              candidate?.subject ?? '—',
              recommendation === 'Passed' ? 'Passed' : recommendation,
              record.amount ? Number(record.amount) : '—',
              recommendation,
            ];
          }),
      };
    case 'JOB_OFFER':
      return {
        title: 'Job Offer Report',
        description: 'Offer letters, joining dates, and acceptance outcomes.',
        columns: ['Offer No', 'Candidate', 'Position', 'Salary', 'Joining Date', 'Expiry Date', 'Status'],
        rows: offers.map((record) => {
          const meta = asObject(record.metadata);
          return [
            (typeof meta.offerNo === 'string' && meta.offerNo) || record.title,
            (typeof meta.candidateName === 'string' && meta.candidateName) || '—',
            record.subject ?? '—',
            record.amount ? Number(record.amount) : '—',
            formatDate(record.startDate),
            formatDate(record.endDate),
            record.status,
          ];
        }),
      };
    case 'JOINING':
      return {
        title: 'Joining Report',
        description: 'Candidates successfully converted into employee records.',
        columns: ['Employee Code', 'Employee Name', 'Position', 'Department', 'Joining Date', 'Status'],
        rows: joining.map((record) => {
          const meta = asObject(record.metadata);
          const department =
            (typeof meta.department === 'string' && meta.department) ||
            record.notes?.match(/ in (.+?)\. Employment Type:/)?.[1] ||
            '—';
          return [
            typeof meta.employeeCode === 'string' ? meta.employeeCode : '—',
            record.title.replace('Joining - ', ''),
            record.subject || (typeof meta.designation === 'string' ? meta.designation : '—'),
            department,
            formatDate(record.startDate),
            record.status,
          ];
        }),
      };
    case 'PIPELINE':
      return {
        title: 'Recruitment Pipeline Report',
        description: 'Candidate counts by current hiring stage.',
        columns: ['Stage', 'Candidates'],
        rows: countBy(candidates.map((record) => stageFromCandidateStatus(record.status))).map((row) => [row.label, row.count]),
      };
    case 'SUMMARY':
    default:
      return {
        title: 'Recruitment Summary Report',
        description: 'High-level counts across the end-to-end recruitment workflow.',
        columns: ['Metric', 'Count'],
        rows: [
          ['Recruitment Requests', requests.length],
          ['Approved Requests', requests.filter((record) => record.status === 'Approved').length],
          ['Candidates', candidates.length],
          ['Interviews Scheduled', interviews.filter((record) => record.status === 'Scheduled').length],
          ['Interviews Completed', interviews.filter((record) => record.status === 'Interview Completed').length],
          ['Offers Sent', offers.filter((record) => record.status === 'Job Offer Sent').length],
          ['Offers Accepted', offers.filter((record) => record.status === 'Offer Accepted').length],
          ['Employees Joined', joining.length],
        ],
      };
  }
}

export const recruitmentReportsService = {
  async getReportCenter(session: AppSession | null, filters: RecruitmentReportFilters = {}) {
    await authorize(session, 'hr:read');

    const reportType = filters.reportType ?? 'SUMMARY';

    const [branches, requestsRaw, candidatesRaw, interviewsRaw, offersRaw, joiningRaw] = await Promise.all([
      prisma.branch.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true },
        orderBy: [{ code: 'asc' }],
      }),
      prisma.hrWorkflowRecord.findMany({ where: { section: 'recruitment' }, orderBy: [{ createdAt: 'desc' }] }),
      prisma.hrWorkflowRecord.findMany({ where: { section: 'candidates' }, orderBy: [{ createdAt: 'desc' }] }),
      prisma.hrWorkflowRecord.findMany({ where: { section: 'interviews' }, orderBy: [{ createdAt: 'desc' }] }),
      prisma.hrWorkflowRecord.findMany({ where: { section: 'job-offers' }, orderBy: [{ createdAt: 'desc' }] }),
      prisma.hrWorkflowRecord.findMany({ where: { section: 'joining' }, orderBy: [{ createdAt: 'desc' }] }),
    ]);

    const requestById = new Map(requestsRaw.map((record) => [record.id, record]));
    const candidateById = new Map(candidatesRaw.map((record) => [record.id, record]));

    const userIds = Array.from(
      new Set(
        [...requestsRaw, ...candidatesRaw, ...interviewsRaw, ...offersRaw, ...joiningRaw]
          .map((record) => record.createdById)
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const users: UserRecord[] = userIds.length
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
      : [];
    const usersById = new Map(users.map((user) => [user.id, user.name]));

    const applyFilters = (records: WorkflowRecord[]) =>
      records.filter((record) => matchesCommonFilters(reportType, record, filters, candidateById, requestById));

    const requests = applyFilters(requestsRaw);
    const candidates = applyFilters(candidatesRaw);
    const interviews = applyFilters(interviewsRaw);
    const offers = applyFilters(offersRaw);
    const joining = applyFilters(joiningRaw);
    const interviewResults = interviews.filter((record) => record.status === 'Interview Completed');
    const approvedRequests = requests.filter((record) => record.status === 'Approved');
    const pipelineRows = countBy(candidates.map((record) => stageFromCandidateStatus(record.status)));

    const allDepartments = Array.from(
      new Set(
        requestsRaw
          .map((record) => record.subject)
          .concat(
            candidatesRaw.map((record) => {
              const meta = asObject(record.metadata);
              return typeof meta.department === 'string' ? meta.department : null;
            }),
          )
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort((a, b) => a.localeCompare(b));

    const allPositions = Array.from(
      new Set(
        requestsRaw
          .map((record) => record.title)
          .concat(candidatesRaw.map((record) => record.subject ?? ''))
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort((a, b) => a.localeCompare(b));

    const requestOptions = requestsRaw
      .map((record) => {
        const meta = asObject(record.metadata);
        return {
          value: record.id,
          label: `${typeof meta.requestNo === 'string' ? meta.requestNo : record.id} · ${record.title}`,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));

    const interviewerOptions = Array.from(
      new Set(interviewsRaw.map((record) => record.owner).filter((value): value is string => Boolean(value))),
    ).sort((a, b) => a.localeCompare(b));

    const dashboard = {
      recruitmentRequests: requestsRaw.length,
      openVacancies: requestsRaw
        .filter((record) => record.status === 'Approved')
        .reduce((sum, record) => sum + Number(record.amount ?? 0), 0) - joiningRaw.length,
      candidates: candidatesRaw.length,
      interviewsScheduled: interviewsRaw.filter((record) => record.status === 'Scheduled').length,
      offersSent: offersRaw.filter((record) => record.status === 'Job Offer Sent').length,
      employeesJoined: joiningRaw.length,
    };

    return {
      filters: {
        reportType,
        branchId: filters.branchId ?? '',
        department: filters.department ?? '',
        jobPosition: filters.jobPosition ?? '',
        recruitmentRequestId: filters.recruitmentRequestId ?? '',
        recruiterId: filters.recruiterId ?? '',
        interviewer: filters.interviewer ?? '',
        candidateStatus: filters.candidateStatus ?? '',
        dateFrom: filters.dateFrom ?? '',
        dateTo: filters.dateTo ?? '',
      },
      options: {
        branches,
        departments: allDepartments,
        positions: allPositions,
        recruitmentRequests: requestOptions,
        recruiters: users.map((user) => ({ value: user.id, label: user.name })),
        interviewers: interviewerOptions.map((value) => ({ value, label: value })),
        candidateStatuses: Array.from(new Set(candidatesRaw.map((record) => record.status))).sort((a, b) => a.localeCompare(b)),
      },
      dashboard,
      report: buildReportRows(reportType, requests, candidates, interviews, offers, joining, usersById),
      meta: {
        rowCount:
          reportType === 'RECRUITMENT_REQUEST'
            ? requests.length
            : reportType === 'VACANCY'
              ? approvedRequests.length
              : reportType === 'CANDIDATE'
                ? candidates.length
                : reportType === 'INTERVIEW_SCHEDULE'
                  ? interviews.length
                  : reportType === 'INTERVIEW_RESULT'
                    ? interviewResults.length
                  : reportType === 'JOB_OFFER'
                    ? offers.length
                    : reportType === 'JOINING'
                      ? joining.length
                      : reportType === 'PIPELINE'
                        ? pipelineRows.length
                        : 8,
      },
    };
  },
};
