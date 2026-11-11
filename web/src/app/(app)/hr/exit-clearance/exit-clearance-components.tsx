'use client';

import Link from 'next/link';
import { useActionState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  changeExitClearanceStatusAction,
  saveExitClearanceAction,
  type ResignationFormState,
} from '@/server/actions/resignations';
import {
  EXIT_ASSET_CONDITION_LABELS,
  EXIT_ASSET_CONDITIONS,
  EXIT_CLEARANCE_REVIEW_LABELS,
  EXIT_CLEARANCE_REVIEW_STATUSES,
  EXIT_CLEARANCE_STATUS_LABELS,
  EXIT_TYPE_LABELS,
  EXIT_TYPES,
} from '@/server/validators/resignations';

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

type ExitDepartment = {
  departmentKey: string;
  departmentName: string;
  responsiblePerson: string;
  status: string;
  remarks: string;
};

type ExitAsset = {
  assetKey: string;
  assetName: string;
  returned: boolean;
  condition: string;
  deductionAmount: string;
  remarks: string;
};

type ExitClearanceRecord = {
  id: string;
  clearanceNumber: string;
  resignationId: string;
  resignationNumber: string;
  employeeName: string;
  employeeCode: string;
  branchName: string;
  department: string;
  designation: string;
  reportingManager: string;
  joiningDate: string;
  resignationDate: string;
  lastWorkingDate: string;
  exitType: string;
  status: string;
  reasonForExit: string;
  noticePeriodServed: boolean;
  handoverCompleted: boolean;
  replacementAssigned: boolean;
  exitInterviewCompleted: boolean;
  hrRemarks: string;
  departments: ExitDepartment[];
  assets: ExitAsset[];
  systemAccess: {
    erpAccountDisabled: boolean;
    emailDisabled: boolean;
    attendanceDeviceDisabled: boolean;
    vpnDisabled: boolean;
    fingerprintRemoved: boolean;
    doorAccessRemoved: boolean;
  };
  settlement: {
    pendingSalary: string;
    leaveEncashment: string;
    bonus: string;
    overtime: string;
    loanRecovery: string;
    advanceRecovery: string;
    assetDamageRecovery: string;
    noticePay: string;
    gratuity: string;
    taxDeduction: string;
    otherDeduction: string;
    netPayable: string;
    remarks: string;
    status: string;
  };
  interview: {
    reasonForLeaving: string;
    companyRating: string;
    managerRating: string;
    suggestions: string;
    rehireEligible: string;
    interviewConductedBy: string;
  };
};

function currency(value: string) {
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function statusVariant(status: string) {
  if (['COMPLETED', 'APPROVED'].includes(status)) return 'success' as const;
  if (['REJECTED', 'LOST', 'DAMAGED'].includes(status)) return 'destructive' as const;
  if (status.includes('PENDING') || status === 'HOLD' || status === 'SENT_BACK') return 'warning' as const;
  return 'outline' as const;
}

function YesNoField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <select id={name} name={name} defaultValue={defaultValue ? 'yes' : 'no'} className={selectClass}>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1 rounded-md border bg-muted/30 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm">{value || '-'}</p>
    </div>
  );
}

function ReadOnlyMoney({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <input type="hidden" name={name} value={value} />
      <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">{currency(value)}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border p-4">
      <div className="mb-4 text-sm font-semibold">{title}</div>
      {children}
    </section>
  );
}

function StatusForm({
  id,
  action,
  label,
  variant = 'default',
  departmentKey,
}: {
  id: string;
  action: string;
  label: string;
  variant?: 'default' | 'destructive' | 'outline';
  departmentKey?: string;
}) {
  return (
    <form action={changeExitClearanceStatusAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value={action} />
      {departmentKey ? <input type="hidden" name="departmentKey" value={departmentKey} /> : null}
      <Button type="submit" size="sm" variant={variant}>
        {label}
      </Button>
    </form>
  );
}

export function ExitClearanceForm({
  record,
  canHrWrite,
  canAccountsApprove,
  canDepartmentApprove,
}: {
  record: ExitClearanceRecord;
  canHrWrite: boolean;
  canAccountsApprove: boolean;
  canDepartmentApprove: boolean;
}) {
  const [state, formAction, pending] = useActionState<ResignationFormState, FormData>(saveExitClearanceAction, undefined);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="id" value={record.id} />
      <input type="hidden" name="resignationId" value={record.resignationId} />

      <Section title="Employee Information">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ReadOnlyField label="Exit Clearance No" value={record.clearanceNumber} />
          <ReadOnlyField label="Employee" value={`${record.employeeName} (${record.employeeCode})`} />
          <ReadOnlyField label="Branch" value={record.branchName} />
          <ReadOnlyField label="Department" value={record.department} />
          <ReadOnlyField label="Designation" value={record.designation} />
          <ReadOnlyField label="Reporting Manager" value={record.reportingManager} />
          <ReadOnlyField label="Joining Date" value={record.joiningDate} />
          <ReadOnlyField label="Resignation Date" value={record.resignationDate} />
          <ReadOnlyField label="Last Working Date" value={record.lastWorkingDate} />
          <div className="space-y-2">
            <Label htmlFor="exitType">Exit Type</Label>
            <select id="exitType" name="exitType" defaultValue={record.exitType} className={selectClass}>
              {EXIT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {EXIT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      <Section title="Exit Details">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <YesNoField label="Notice Period Served" name="noticePeriodServed" defaultValue={record.noticePeriodServed} />
          <YesNoField label="Handover Completed" name="handoverCompleted" defaultValue={record.handoverCompleted} />
          <YesNoField label="Replacement Assigned" name="replacementAssigned" defaultValue={record.replacementAssigned} />
          <YesNoField
            label="Exit Interview Completed"
            name="exitInterviewCompleted"
            defaultValue={record.exitInterviewCompleted}
          />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="reasonForExit">Reason for Exit</Label>
            <textarea
              id="reasonForExit"
              name="reasonForExit"
              rows={4}
              defaultValue={record.reasonForExit}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hrRemarks">HR Remarks</Label>
            <textarea
              id="hrRemarks"
              name="hrRemarks"
              rows={4}
              defaultValue={record.hrRemarks}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </Section>

      <Section title="Department Clearance">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-3">Department</th>
                <th className="py-2 pr-3">Responsible Person</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Remarks</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {record.departments.map((department) => {
                const canReviewThisRow =
                  canDepartmentApprove &&
                  record.status === 'PENDING_DEPARTMENT_CLEARANCE' &&
                  !['ACCOUNTS', 'HR'].includes(department.departmentKey);
                return (
                  <tr key={department.departmentKey} className="border-b align-top">
                    <td className="py-3 pr-3 font-medium">{department.departmentName}</td>
                    <td className="py-3 pr-3">
                      <Input
                        name={`dept_${department.departmentKey}_responsiblePerson`}
                        defaultValue={department.responsiblePerson}
                      />
                    </td>
                    <td className="py-3 pr-3">
                      {record.status === 'DRAFT' ? (
                        <select
                          name={`dept_${department.departmentKey}_status`}
                          defaultValue={department.status}
                          className={selectClass}
                        >
                          {EXIT_CLEARANCE_REVIEW_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {EXIT_CLEARANCE_REVIEW_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <>
                          <input type="hidden" name={`dept_${department.departmentKey}_status`} value={department.status} />
                          <Badge variant={statusVariant(department.status)}>
                            {EXIT_CLEARANCE_REVIEW_LABELS[department.status] ?? department.status}
                          </Badge>
                        </>
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      <textarea
                        name={`dept_${department.departmentKey}_remarks`}
                        rows={2}
                        defaultValue={department.remarks}
                        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </td>
                    <td className="py-3">
                      {canReviewThisRow ? (
                        <div className="flex flex-wrap gap-2">
                          <StatusForm id={record.id} action="department_approve" label="Approve" departmentKey={department.departmentKey} />
                          <StatusForm id={record.id} action="department_send_back" label="Send Back" variant="outline" departmentKey={department.departmentKey} />
                          <StatusForm id={record.id} action="department_reject" label="Reject" variant="destructive" departmentKey={department.departmentKey} />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No row actions</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Company Assets">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-3">Asset</th>
                <th className="py-2 pr-3">Returned</th>
                <th className="py-2 pr-3">Condition</th>
                <th className="py-2 pr-3">Deduction</th>
                <th className="py-2">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {record.assets.map((asset) => (
                <tr key={asset.assetKey} className="border-b align-top">
                  <td className="py-3 pr-3 font-medium">{asset.assetName}</td>
                  <td className="py-3 pr-3">
                    <select name={`asset_${asset.assetKey}_returned`} defaultValue={asset.returned ? 'yes' : 'no'} className={selectClass}>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </td>
                  <td className="py-3 pr-3">
                    <select name={`asset_${asset.assetKey}_condition`} defaultValue={asset.condition} className={selectClass}>
                      {EXIT_ASSET_CONDITIONS.map((condition) => (
                        <option key={condition} value={condition}>
                          {EXIT_ASSET_CONDITION_LABELS[condition]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 pr-3">
                    <Input
                      name={`asset_${asset.assetKey}_deductionAmount`}
                      type="number"
                      step="0.01"
                      defaultValue={asset.deductionAmount}
                    />
                  </td>
                  <td className="py-3">
                    <textarea
                      name={`asset_${asset.assetKey}_remarks`}
                      rows={2}
                      defaultValue={asset.remarks}
                      className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="System Access">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <YesNoField label="ERP Account Disabled" name="erpAccountDisabled" defaultValue={record.systemAccess.erpAccountDisabled} />
          <YesNoField label="Email Disabled" name="emailDisabled" defaultValue={record.systemAccess.emailDisabled} />
          <YesNoField
            label="Attendance Device Disabled"
            name="attendanceDeviceDisabled"
            defaultValue={record.systemAccess.attendanceDeviceDisabled}
          />
          <YesNoField label="VPN Disabled" name="vpnDisabled" defaultValue={record.systemAccess.vpnDisabled} />
          <YesNoField
            label="Fingerprint Removed"
            name="fingerprintRemoved"
            defaultValue={record.systemAccess.fingerprintRemoved}
          />
          <YesNoField
            label="Door Access Removed"
            name="doorAccessRemoved"
            defaultValue={record.systemAccess.doorAccessRemoved}
          />
        </div>
      </Section>

      <Section title="Accounts Clearance">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {canAccountsApprove ? (
            <>
              <MoneyField label="Pending Salary" name="pendingSalary" defaultValue={record.settlement.pendingSalary} />
              <MoneyField label="Leave Encashment" name="leaveEncashment" defaultValue={record.settlement.leaveEncashment} />
              <MoneyField label="Bonus" name="bonus" defaultValue={record.settlement.bonus} />
              <MoneyField label="Overtime" name="overtime" defaultValue={record.settlement.overtime} />
              <MoneyField label="Loan Recovery" name="loanRecovery" defaultValue={record.settlement.loanRecovery} />
              <MoneyField label="Advance Recovery" name="advanceRecovery" defaultValue={record.settlement.advanceRecovery} />
              <MoneyField label="Asset Damage Recovery" name="assetDamageRecovery" defaultValue={record.settlement.assetDamageRecovery} />
              <MoneyField label="Notice Pay" name="noticePay" defaultValue={record.settlement.noticePay} />
              <MoneyField label="Gratuity" name="gratuity" defaultValue={record.settlement.gratuity} />
              <MoneyField label="Tax Deduction" name="taxDeduction" defaultValue={record.settlement.taxDeduction} />
              <MoneyField label="Other Deduction" name="otherDeduction" defaultValue={record.settlement.otherDeduction} />
            </>
          ) : (
            <>
              <ReadOnlyMoney label="Pending Salary" name="pendingSalary" value={record.settlement.pendingSalary} />
              <ReadOnlyMoney label="Leave Encashment" name="leaveEncashment" value={record.settlement.leaveEncashment} />
              <ReadOnlyMoney label="Bonus" name="bonus" value={record.settlement.bonus} />
              <ReadOnlyMoney label="Overtime" name="overtime" value={record.settlement.overtime} />
              <ReadOnlyMoney label="Loan Recovery" name="loanRecovery" value={record.settlement.loanRecovery} />
              <ReadOnlyMoney label="Advance Recovery" name="advanceRecovery" value={record.settlement.advanceRecovery} />
              <ReadOnlyMoney label="Asset Damage Recovery" name="assetDamageRecovery" value={record.settlement.assetDamageRecovery} />
              <ReadOnlyMoney label="Notice Pay" name="noticePay" value={record.settlement.noticePay} />
              <ReadOnlyMoney label="Gratuity" name="gratuity" value={record.settlement.gratuity} />
              <ReadOnlyMoney label="Tax Deduction" name="taxDeduction" value={record.settlement.taxDeduction} />
              <ReadOnlyMoney label="Other Deduction" name="otherDeduction" value={record.settlement.otherDeduction} />
            </>
          )}
          <ReadOnlyField label="Net Payable" value={currency(record.settlement.netPayable)} />
        </div>
        <div className="mt-4 space-y-2">
          <Label htmlFor="settlementRemarks">Accounts Remarks</Label>
          {canAccountsApprove ? (
            <textarea
              id="settlementRemarks"
              name="settlementRemarks"
              rows={3}
              defaultValue={record.settlement.remarks}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          ) : (
            <>
              <input type="hidden" name="settlementRemarks" value={record.settlement.remarks} />
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">{record.settlement.remarks || '-'}</div>
            </>
          )}
        </div>
        {record.status === 'PENDING_ACCOUNTS_APPROVAL' && canAccountsApprove && (
          <div className="mt-4 flex flex-wrap gap-2">
            <StatusForm id={record.id} action="accounts_recalculate" label="Recalculate" variant="outline" />
            <StatusForm id={record.id} action="accounts_approve" label="Approve Settlement" />
            <StatusForm id={record.id} action="accounts_reject" label="Reject Settlement" variant="destructive" />
          </div>
        )}
      </Section>

      <Section title="Exit Interview">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextAreaField label="Reason for Leaving" name="reasonForLeaving" defaultValue={record.interview.reasonForLeaving} />
          <TextAreaField label="Suggestions" name="suggestions" defaultValue={record.interview.suggestions} />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MoneyLikeSelect label="Company Rating" name="companyRating" defaultValue={record.interview.companyRating} />
          <MoneyLikeSelect label="Manager Rating" name="managerRating" defaultValue={record.interview.managerRating} />
          <YesNoField
            label="Rehire Eligible"
            name="rehireEligible"
            defaultValue={record.interview.rehireEligible === 'yes'}
          />
          <div className="space-y-2">
            <Label htmlFor="interviewConductedBy">Interview Conducted By</Label>
            <Input id="interviewConductedBy" name="interviewConductedBy" defaultValue={record.interview.interviewConductedBy} />
          </div>
        </div>
      </Section>

      <Section title="HR Final Approval">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={statusVariant(record.status)}>
            {EXIT_CLEARANCE_STATUS_LABELS[record.status] ?? record.status}
          </Badge>
          {canHrWrite && (
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving...' : 'Save Draft'}
            </Button>
          )}
          {canHrWrite && ['DRAFT', 'REJECTED', 'CANCELLED'].includes(record.status) && (
            <StatusForm id={record.id} action="submit" label="Submit" />
          )}
          {canHrWrite && !['COMPLETED', 'CANCELLED'].includes(record.status) && (
            <StatusForm id={record.id} action="cancel" label="Cancel" variant="outline" />
          )}
          {record.status === 'PENDING_HR_APPROVAL' && canHrWrite && (
            <>
              <StatusForm id={record.id} action="hr_approve" label="Approve Exit" />
              <StatusForm id={record.id} action="hr_hold" label="Hold" variant="outline" />
              <StatusForm id={record.id} action="hr_reject" label="Reject" variant="destructive" />
            </>
          )}
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        </div>
      </Section>

      {record.status === 'COMPLETED' && canHrWrite && (
        <Section title="Generated Documents">
          <div className="flex flex-wrap gap-2">
            <StatusForm id={record.id} action="generate_exit_clearance_certificate" label="Exit Clearance Certificate" variant="outline" />
            <StatusForm id={record.id} action="generate_relieving_letter" label="Relieving Letter" variant="outline" />
            <StatusForm id={record.id} action="generate_experience_letter" label="Experience Letter" variant="outline" />
            <StatusForm id={record.id} action="generate_no_due_certificate" label="No Due Certificate" variant="outline" />
            <StatusForm id={record.id} action="generate_full_final_settlement" label="Full & Final Settlement" variant="outline" />
            <StatusForm id={record.id} action="generate_service_certificate" label="Service Certificate" variant="outline" />
            <StatusForm id={record.id} action="archive_employee" label="Archive Employee" variant="outline" />
          </div>
        </Section>
      )}
    </form>
  );
}

export function ExitClearanceTable({ records }: { records: ExitClearanceRecord[] }) {
  if (records.length === 0) {
    return <div className="px-6 py-12 text-center text-muted-foreground">No exit clearance records found.</div>;
  }

  return (
    <div className="space-y-3 p-4">
      {records.map((record) => {
        const deptComplete = record.departments.filter((item) => item.status === 'APPROVED').length;
        return (
          <div key={record.id} className="grid gap-4 rounded-lg border p-4 lg:grid-cols-[1.1fr_1.4fr_1fr_1fr_1fr_1.6fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Clearance No</p>
              <p className="text-sm font-semibold text-primary">{record.clearanceNumber}</p>
              <p className="text-xs text-muted-foreground">{record.resignationNumber}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Employee</p>
              <p className="text-sm font-semibold">{record.employeeName}</p>
              <p className="text-xs text-muted-foreground">{record.employeeCode}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Last Working Date</p>
              <p className="text-sm">{record.lastWorkingDate}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Department Clearance</p>
              <p className="text-sm">{deptComplete}/{record.departments.length} approved</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Accounts</p>
              <p className="text-sm">{EXIT_CLEARANCE_REVIEW_LABELS[record.settlement.status] ?? record.settlement.status}</p>
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant(record.status)}>
                  {EXIT_CLEARANCE_STATUS_LABELS[record.status] ?? record.status}
                </Badge>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/hr/exit-clearance?id=${record.id}`}>Open</Link>
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MoneyField({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type="number" step="0.01" defaultValue={defaultValue} />
    </div>
  );
}

function TextAreaField({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <textarea
        id={name}
        name={name}
        rows={3}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

function MoneyLikeSelect({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <select id={name} name={name} defaultValue={defaultValue || ''} className={selectClass}>
        <option value="">Select</option>
        {[1, 2, 3, 4, 5].map((value) => (
          <option key={value} value={String(value)}>
            {value}
          </option>
        ))}
      </select>
    </div>
  );
}
