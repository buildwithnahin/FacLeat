import { notFound } from 'next/navigation';
import { getSession } from '@/server/auth/session';
import { authorize } from '@/server/auth/authorize';
import { hrService } from '@/server/services/hr.service';
import { prisma } from '@/server/db';
import { HrSectionShell } from '../_components/hr-section-shell';

export const metadata = { title: 'HR Section' };

const SECTION_CONFIG: Record<
  string,
  {
    title: string;
    description: string;
    category: string;
    workflow?: string[];
    highlights?: string[];
    links?: { label: string; href: string }[];
  }
> = {
  recruitment: {
    title: 'Recruitment',
    description: 'Start the hiring workflow from manpower request through candidate sourcing.',
    category: 'Employee Lifecycle',
    workflow: ['Recruitment Request', 'Candidate Pipeline', 'Interview Planning', 'Selection Decision'],
    highlights: ['Open positions and hiring needs', 'Candidate sourcing by department', 'Pre-joining recruitment control'],
    links: [{ label: 'Employees', href: '/hr/employees' }],
  },
  candidates: {
    title: 'Candidates',
    description: 'Maintain the pre-employee talent pool before a candidate becomes a staff record.',
    category: 'Employee Lifecycle',
    workflow: ['Application Received', 'Profile Screening', 'Shortlist', 'Move to Interview'],
    highlights: ['Talent pipeline', 'CV and contact tracking', 'Source and status visibility'],
  },
  interviews: {
    title: 'Interviews',
    description: 'Coordinate interview rounds, panels, and feedback in one place.',
    category: 'Employee Lifecycle',
    workflow: ['Interview Schedule', 'Panel Assignment', 'Evaluation', 'Selection Recommendation'],
    highlights: ['Round-wise evaluation', 'Interviewer comments', 'Hiring decision history'],
  },
  'job-offers': {
    title: 'Job Offers',
    description: 'Prepare, release, and track offer acceptance before joining.',
    category: 'Employee Lifecycle',
    workflow: ['Offer Draft', 'Approval', 'Candidate Acceptance', 'Prepare Joining'],
    highlights: ['Offered salary terms', 'Offer expiry tracking', 'Accepted vs declined visibility'],
  },
  joining: {
    title: 'Joining',
    description: 'Convert approved hires into employees through a structured onboarding flow.',
    category: 'Employee Lifecycle',
    workflow: ['Offer Accepted', 'Document Collection', 'Joining Checklist', 'Employee Created'],
    highlights: ['Joining date control', 'Onboarding documents', 'Final transition into employee master'],
    links: [{ label: 'Employees', href: '/hr/employees' }],
  },
  departments: {
    title: 'Departments',
    description: 'Define the organization structure used across employees, approvals, and reporting.',
    category: 'Organization',
    highlights: ['Department master', 'Reporting structure base', 'Cross-module grouping'],
  },
  designations: {
    title: 'Designations',
    description: 'Maintain grade, position, and title structure for HR and payroll operations.',
    category: 'Organization',
    highlights: ['Role hierarchy', 'Title standardization', 'Employee assignment consistency'],
  },
  'employment-types': {
    title: 'Employment Types',
    description: 'Configure whether employees are permanent, probationary, contract, or temporary.',
    category: 'Organization',
    highlights: ['Policy and benefit grouping', 'Contractual distinction', 'Payroll rule support'],
  },
  shifts: {
    title: 'Shifts',
    description: 'Set working shifts for attendance rules, late tracking, and overtime calculation.',
    category: 'Organization',
    highlights: ['Shift master', 'Attendance benchmark', 'Late and overtime rule base'],
    links: [{ label: 'Attendance', href: '/hr/attendance' }],
  },
  'holiday-calendar': {
    title: 'Holiday Calendar',
    description: 'Publish official holidays to align attendance, leave, and payroll calculations.',
    category: 'Organization',
    highlights: ['Public and company holidays', 'Shift-aware holiday rules', 'Payroll calculation support'],
  },
  transfers: {
    title: 'Transfer',
    description: 'Track employee transfers across branch, department, and reporting structure.',
    category: 'Employee Management',
    workflow: ['Transfer Request', 'Approval', 'Effective Date', 'Employee Record Update'],
    highlights: ['Department and branch movement', 'Transfer reason tracking', 'History preservation'],
    links: [{ label: 'Employees', href: '/hr/employees' }],
  },
  promotions: {
    title: 'Promotion',
    description: 'Manage promotion decisions with updated designation and salary impact.',
    category: 'Employee Management',
    workflow: ['Promotion Proposal', 'Review', 'Approval', 'Effective Promotion'],
    highlights: ['Promotion approval chain', 'Designation changes', 'History in employee profile'],
  },
  increments: {
    title: 'Increment',
    description: 'Record salary increments with effective dates and supporting remarks.',
    category: 'Employee Management',
    workflow: ['Increment Proposal', 'Review', 'Approve', 'Apply to Payroll'],
    highlights: ['Salary revision trail', 'Increment reason', 'Payroll sync'],
  },
  confirmations: {
    title: 'Confirmation',
    description: 'Handle probation review and employee confirmation workflow.',
    category: 'Employee Management',
    workflow: ['Probation Review', 'Manager Feedback', 'Confirmation Approval', 'Status Update'],
    highlights: ['Probation control', 'Pending confirmation visibility', 'Lifecycle compliance'],
  },
  contracts: {
    title: 'Contract',
    description: 'Maintain contract periods, renewals, and related employee obligations.',
    category: 'Employee Management',
    workflow: ['Contract Setup', 'Renewal Reminder', 'Extension or Closure'],
    highlights: ['Contract tenure tracking', 'Renewal scheduling', 'Expiry risk visibility'],
  },
  'attendance-adjustment': {
    title: 'Attendance Adjustment',
    description: 'Review and correct missed or inaccurate attendance punches.',
    category: 'Attendance',
    workflow: ['Request Raised', 'Review Evidence', 'Approve Adjustment', 'Update Attendance'],
    highlights: ['Missing punch correction', 'Manual override control', 'Audit-friendly change history'],
    links: [{ label: 'Daily Attendance', href: '/hr/attendance' }],
  },
  'late-early-report': {
    title: 'Late / Early Report',
    description: 'Analyze late arrivals, early exits, and policy exceptions.',
    category: 'Attendance',
    highlights: ['Late and early trend', 'Exception-based review', 'Attendance discipline visibility'],
    links: [{ label: 'Daily Attendance', href: '/hr/attendance' }],
  },
  overtime: {
    title: 'Overtime',
    description: 'Track overtime hours before they move into payroll calculation.',
    category: 'Attendance',
    workflow: ['Capture Extra Hours', 'Supervisor Check', 'Approval', 'Send to Payroll'],
    highlights: ['Overtime eligibility', 'Approval-based payout', 'Payroll integration point'],
    links: [{ label: 'Payroll Run', href: '/hr/payroll' }],
  },
  'attendance-summary': {
    title: 'Attendance Summary',
    description: 'Review attendance trends by employee, department, and branch.',
    category: 'Attendance',
    highlights: ['Monthly attendance summary', 'Present/absent/late mix', 'Department comparison'],
    links: [{ label: 'Daily Attendance', href: '/hr/attendance' }],
  },
  'leave-approval': {
    title: 'Leave Approval',
    description: 'Separate leave approval activity from application entry for cleaner HR operations.',
    category: 'Leave',
    workflow: ['Application Submitted', 'Manager Review', 'HR Approval', 'Balance Update'],
    highlights: ['Pending approval queue', 'Role-based decision layer', 'Approval history'],
    links: [{ label: 'Leave Application', href: '/hr/leaves' }],
  },
  'leave-balance': {
    title: 'Leave Balance',
    description: 'Track available leave by policy and employee.',
    category: 'Leave',
    highlights: ['Carry forward and usage', 'Employee-wise balances', 'Policy-linked entitlement'],
    links: [{ label: 'Leave Application', href: '/hr/leaves' }],
  },
  'leave-policy': {
    title: 'Leave Policy',
    description: 'Configure leave rules for annual, sick, maternity, and special leave.',
    category: 'Leave',
    highlights: ['Entitlement rules', 'Approval requirement setup', 'Policy-linked balance logic'],
  },
  kpi: {
    title: 'KPI',
    description: 'Define key performance indicators for employee and departmental evaluation.',
    category: 'Performance',
    highlights: ['KPI library', 'Target setting', 'Department-specific metrics'],
  },
  'performance-review': {
    title: 'Performance Review',
    description: 'Capture structured evaluation cycles for each employee.',
    category: 'Performance',
    workflow: ['Review Period', 'Manager Assessment', 'Employee Discussion', 'Final Rating'],
    highlights: ['Periodic review cycle', 'Comment and score history', 'Readiness for promotion and increment'],
  },
  appraisal: {
    title: 'Appraisal',
    description: 'Turn performance outcomes into appraisal and compensation decisions.',
    category: 'Performance',
    workflow: ['Review Closed', 'Appraisal Recommendation', 'Approval', 'Salary Impact'],
    highlights: ['Performance-linked rewards', 'Compensation revision input', 'Management visibility'],
  },
  'training-schedule': {
    title: 'Training Schedule',
    description: 'Plan upcoming training events by team, skill, or compliance need.',
    category: 'Training',
    workflow: ['Training Need', 'Schedule', 'Nomination', 'Completion'],
    highlights: ['Upcoming sessions', 'Trainer and venue details', 'Skill development planning'],
  },
  'training-history': {
    title: 'Training History',
    description: 'Preserve completed training records as part of the employee profile.',
    category: 'Training',
    highlights: ['Employee-wise learning history', 'Training completion evidence', 'Capability growth timeline'],
  },
  warnings: {
    title: 'Warning',
    description: 'Maintain formal warning records against employees with proper chronology.',
    category: 'Disciplinary',
    workflow: ['Issue Raised', 'Review', 'Warning Issued', 'Employee Acknowledgement'],
    highlights: ['Disciplinary documentation', 'Employee-wise warning history', 'Timeline visibility'],
  },
  suspensions: {
    title: 'Suspension',
    description: 'Track suspension periods, causes, and follow-up decisions.',
    category: 'Disciplinary',
    workflow: ['Incident Review', 'Suspension Decision', 'Effective Period', 'Reinstatement or Exit'],
    highlights: ['Serious disciplinary action', 'Effective-date control', 'Case outcome tracking'],
  },
  notices: {
    title: 'Notice',
    description: 'Maintain official HR notices relevant to employees and workforce policy.',
    category: 'Disciplinary',
    highlights: ['Notice issue log', 'Policy communication', 'Employee acknowledgement path'],
  },
  'salary-structure': {
    title: 'Salary Structure',
    description: 'Control fixed earnings and deductions before payroll processing begins.',
    category: 'Payroll',
    workflow: ['Define Components', 'Assign to Employee', 'Review', 'Use in Payroll'],
    highlights: ['Basic and allowance setup', 'Deduction control', 'Employee-level salary architecture'],
    links: [{ label: 'Employees', href: '/hr/employees' }, { label: 'Payroll Run', href: '/hr/payroll' }],
  },
  payslip: {
    title: 'Payslip',
    description: 'Review generated employee-wise payroll statements after each run.',
    category: 'Payroll',
    workflow: ['Payroll Run', 'Approve Payroll', 'Generate Payslip', 'Disburse'],
    highlights: ['Employee-wise net pay', 'Earning and deduction breakdown', 'Monthly salary record'],
    links: [{ label: 'Payroll Run', href: '/hr/payroll' }],
  },
  bonus: {
    title: 'Bonus',
    description: 'Configure festival and performance-linked bonus distribution before payroll.',
    category: 'Payroll',
    workflow: ['Bonus Setup', 'Eligibility Review', 'Approval', 'Payroll Inclusion'],
    highlights: ['Special bonus processing', 'Eligibility visibility', 'Payroll-linked payout'],
  },
  'increment-history': {
    title: 'Increment History',
    description: 'Review all salary increments in a single historical stream.',
    category: 'Payroll',
    highlights: ['Chronological increment trail', 'Audit support', 'Employee compensation history'],
  },
  resignations: {
    title: 'Resignation',
    description: 'Manage employee resignation with notice period and handover checkpoints.',
    category: 'Exit Management',
    workflow: ['Resignation Submitted', 'Review', 'Notice Period', 'Exit Preparation'],
    highlights: ['Resignation register', 'Notice period control', 'Pre-exit coordination'],
  },
  'exit-clearance': {
    title: 'Exit Clearance',
    description: 'Coordinate the departmental no-dues and clearance process before separation.',
    category: 'Exit Management',
    workflow: ['Initiate Clearance', 'Department Sign-off', 'Asset Return', 'Approved Exit'],
    highlights: ['Cross-department signoff', 'Asset and dues check', 'Final separation readiness'],
  },
  'final-settlement': {
    title: 'Final Settlement',
    description: 'Process last salary, dues, and recoveries for exiting employees.',
    category: 'Exit Management',
    workflow: ['Collect Final Data', 'Compute Dues', 'Approval', 'Release Settlement'],
    highlights: ['Final payable or recovery', 'Exit payroll closure', 'Separation record'],
  },
  'reports/employee': {
    title: 'Employee Report',
    description: 'Generate workforce reports by employee, branch, department, and status.',
    category: 'Reports',
    highlights: ['Employee list', 'Joining and resignation analysis', 'Department-wise reporting'],
    links: [{ label: 'Employees', href: '/hr/employees' }],
  },
  'reports/attendance': {
    title: 'Attendance Report',
    description: 'Analyze attendance, late records, overtime, and attendance exceptions.',
    category: 'Reports',
    highlights: ['Daily and monthly attendance', 'Late and early trends', 'Attendance exception review'],
    links: [{ label: 'Daily Attendance', href: '/hr/attendance' }],
  },
  'reports/leave': {
    title: 'Leave Report',
    description: 'Review leave usage, approvals, and balances across the workforce.',
    category: 'Reports',
    highlights: ['Leave summary', 'Leave approval backlog', 'Employee-wise leave history'],
    links: [{ label: 'Leave Application', href: '/hr/leaves' }],
  },
  'reports/payroll': {
    title: 'Payroll Report',
    description: 'Summarize payroll runs, salary totals, and employee payout history.',
    category: 'Reports',
    highlights: ['Salary register', 'Payroll summary', 'Monthly payout analysis'],
    links: [{ label: 'Payroll Run', href: '/hr/payroll' }],
  },
  'reports/performance': {
    title: 'Performance Report',
    description: 'Centralize KPI, review, and appraisal reporting for management.',
    category: 'Reports',
    highlights: ['Review completion status', 'Rating analysis', 'Promotion readiness insight'],
  },
};

const MASTER_SECTIONS = new Set([
  'departments',
  'designations',
  'employment-types',
  'shifts',
  'holiday-calendar',
  'leave-policy',
  'kpi',
  'salary-structure',
]);

export default async function HrSectionPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const key = slug.join('/');
  const config = SECTION_CONFIG[key];

  if (!config) notFound();

  const session = await getSession();
  await authorize(session, 'hr:read');
  const kind = MASTER_SECTIONS.has(key) ? 'master' : 'workflow';
  const canWrite = session?.permissions.includes('hr:write') ?? false;
  const path = `/hr/${key}`;

  const [branches, employees, masterRows, workflowRows] = await Promise.all([
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true },
    }),
    hrService.listEmployees(session, { status: 'ACTIVE' }),
    kind === 'master' ? hrService.listMasterData(session, { type: key, branchId: session?.activeBranchId ?? undefined }) : Promise.resolve([]),
    kind === 'workflow' ? hrService.listWorkflowRecords(session, { section: key, branchId: session?.activeBranchId ?? undefined }) : Promise.resolve([]),
  ]);

  return (
    <HrSectionShell
      {...config}
      slug={key}
      path={path}
      kind={kind}
      canWrite={canWrite}
      branches={branches.map((branch) => ({ id: branch.id, label: `${branch.code} · ${branch.name}` }))}
      employees={employees.map((employee) => ({
        id: employee.id,
        label: `${employee.code} · ${employee.firstName} ${employee.lastName}`,
      }))}
      masterRows={masterRows}
      workflowRows={workflowRows}
    />
  );
}
