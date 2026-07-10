'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { decideLeaveAction, withdrawLeaveAction, bulkDecideLeaveAction } from '@/server/actions/leaves';
import { Calendar, User, FileText, CheckCircle2, XCircle, ArrowLeft, Printer, ShieldAlert } from 'lucide-react';

interface LeaveRequestItem {
  id: string;
  leaveRequestNo: string;
  employeeId: string;
  type: string;
  fromDate: string;
  toDate: string;
  days: number;
  halfDay: boolean;
  halfDayType: string | null;
  reason: string;
  attachmentPath: string | null;
  emergencyContact: string | null;
  handoverEmployeeId: string | null;
  status: string;
  managerStatus: string;
  managerRemarks: string | null;
  managerId: string | null;
  managerApprovedAt: string | null;
  hrStatus: string;
  hrRemarks: string | null;
  hrId: string | null;
  hrApprovedAt: string | null;
  createdAt: string;
  employee: {
    id: string;
    code: string;
    firstName: string;
    lastName: string;
    department: string | null;
    designation: string | null;
    joiningDate: string | null;
    employmentType: string | null;
    branch: {
      name: string;
    } | null;
  };
  handoverEmployee: {
    code: string;
    firstName: string;
    lastName: string;
  } | null;
  balanceSummary?: {
    entitled: number;
    used: number;
    pending: number;
    carryForward: number;
    encashed: number;
    available: number;
    isUnlimited: boolean;
    requested: number;
    balanceAfterApproval: number;
  } | null;
}

interface Props {
  leaves: LeaveRequestItem[];
  mode?: 'application' | 'approval' | 'history';
  canManagerDecide?: boolean;
  canHrDecide?: boolean;
  allowWithdraw?: boolean;
}

const STATUS_VARIANT: Record<string, 'default' | 'outline' | 'success' | 'warning' | 'destructive'> = {
  DRAFT: 'outline',
  PENDING_MANAGER: 'warning',
  PENDING_HR: 'warning',
  APPROVED: 'success',
  REJECTED: 'destructive',
  RETURNED: 'warning',
  CANCELLED: 'destructive',
  WITHDRAWN: 'outline',
};

export function LeaveTable({
  leaves,
  mode = 'application',
  canManagerDecide = false,
  canHrDecide = false,
  allowWithdraw = false,
}: Props) {
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequestItem | null>(null);
  const [remarks, setRemarks] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const showDepartment = mode !== 'application';
  const showBalance = mode === 'approval';
  const showApprovalActions = mode === 'approval';

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ');
  };

  const handlePrint = (l: LeaveRequestItem) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Leave Request - ${l.leaveRequestNo}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; line-height: 1.6; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: bold; margin: 0; }
            .subtitle { font-size: 14px; color: #666; margin-top: 5px; }
            .section { margin-bottom: 25px; }
            .section-title { font-size: 16px; font-weight: bold; background: #f3f4f6; padding: 6px 12px; margin-bottom: 15px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
            .field { margin-bottom: 8px; }
            .label { font-weight: bold; color: #555; display: inline-block; width: 180px; }
            .value { display: inline-block; }
            .footer { margin-top: 80px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 30px; text-align: center; }
            .signature { border-top: 1px solid #999; padding-top: 8px; font-size: 13px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">ANNEX LEATHER</div>
            <div class="subtitle">Official Leave Application Form</div>
          </div>
          
          <div class="section">
            <div class="section-title">Leave Request Information</div>
            <div class="grid">
              <div class="field"><span class="label">Leave Request No:</span><span class="value">${l.leaveRequestNo}</span></div>
              <div class="field"><span class="label">Status:</span><span class="value">${l.status}</span></div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Employee Details</div>
            <div class="grid">
              <div class="field"><span class="label">Employee Name:</span><span class="value">${l.employee.firstName} ${l.employee.lastName}</span></div>
              <div class="field"><span class="label">Employee ID:</span><span class="value">${l.employee.code}</span></div>
              <div class="field"><span class="label">Branch:</span><span class="value">${l.employee.branch?.name || '—'}</span></div>
              <div class="field"><span class="label">Department:</span><span class="value">${l.employee.department || '—'}</span></div>
              <div class="field"><span class="label">Designation:</span><span class="value">${l.employee.designation || '—'}</span></div>
              <div class="field"><span class="label">Employment Type:</span><span class="value">${l.employee.employmentType || '—'}</span></div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Leave Period & Details</div>
            <div class="grid">
              <div class="field"><span class="label">Leave Type:</span><span class="value">${l.type}</span></div>
              <div class="field"><span class="label">Total Days Applied:</span><span class="value">${Number(l.days)} Day(s)</span></div>
              <div class="field"><span class="label">From Date:</span><span class="value">${new Date(l.fromDate).toLocaleDateString()}</span></div>
              <div class="field"><span class="label">To Date:</span><span class="value">${new Date(l.toDate).toLocaleDateString()}</span></div>
              <div class="field"><span class="label">Half Day:</span><span class="value">${l.halfDay ? `Yes (${l.halfDayType})` : 'No'}</span></div>
              <div class="field"><span class="label">Handover Employee:</span><span class="value">${l.handoverEmployee ? `${l.handoverEmployee.firstName} ${l.handoverEmployee.lastName}` : '—'}</span></div>
            </div>
            <div style="margin-top: 15px;">
              <span class="label" style="display: block; margin-bottom: 5px;">Reason:</span>
              <div style="padding: 10px; border: 1px solid #ddd; background: #fafafa; border-radius: 4px;">${l.reason}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Approval & Decisions</div>
            <div class="grid">
              <div class="field">
                <span class="label">Manager Status:</span><span class="value">${l.managerStatus}</span><br/>
                <span class="label">Manager Remarks:</span><span class="value">${l.managerRemarks || '—'}</span>
              </div>
              <div class="field">
                <span class="label">HR Status:</span><span class="value">${l.hrStatus}</span><br/>
                <span class="label">HR Remarks:</span><span class="value">${l.hrRemarks || '—'}</span>
              </div>
            </div>
          </div>

          <div class="footer">
            <div class="signature"><br/><br/>Applicant Signature</div>
            <div class="signature"><br/><br/>Departmental Manager</div>
            <div class="signature"><br/><br/>HR Department</div>
          </div>

          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-4">
      {showApprovalActions && selectedIds.size > 0 && (
        <div className="bg-slate-50 border border-slate-200 dark:bg-slate-900/50 dark:border-slate-800 p-3 rounded-md flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="font-mono text-sm bg-white dark:bg-slate-950">
              {selectedIds.size} Selected
            </Badge>
            <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">Bulk Actions:</span>
          </div>
          <div className="flex items-center gap-2">
            <form action={bulkDecideLeaveAction} onSubmit={() => setSelectedIds(new Set())}>
              <input type="hidden" name="ids" value={JSON.stringify(Array.from(selectedIds))} />
              <input type="hidden" name="stage" value={leaves.find(l => selectedIds.has(l.id))?.status === 'PENDING_MANAGER' ? 'manager' : 'hr'} />
              <input type="hidden" name="action" value="approve" />
              <Button type="submit" size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                Approve Selected
              </Button>
            </form>
            <form action={bulkDecideLeaveAction} onSubmit={() => setSelectedIds(new Set())}>
              <input type="hidden" name="ids" value={JSON.stringify(Array.from(selectedIds))} />
              <input type="hidden" name="stage" value={leaves.find(l => selectedIds.has(l.id))?.status === 'PENDING_MANAGER' ? 'manager' : 'hr'} />
              <input type="hidden" name="action" value="reject" />
              <Button type="submit" size="sm" variant="destructive" className="h-8 font-semibold">
                Reject Selected
              </Button>
            </form>
          </div>
        </div>
      )}

      <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
              <tr>
                {showApprovalActions && (
                  <th className="text-left px-4 py-3 w-10">
                    <Checkbox
                      checked={leaves.length > 0 && selectedIds.size === leaves.length}
                      onCheckedChange={(c) => {
                        if (c) setSelectedIds(new Set(leaves.map((l) => l.id)));
                        else setSelectedIds(new Set());
                      }}
                    />
                  </th>
                )}
                <th className="text-left px-4 py-3">Leave No</th>
                <th className="text-left px-4 py-3">Employee</th>
                {showDepartment && <th className="text-left px-4 py-3">Department</th>}
                <th className="text-left px-4 py-3">Leave Type</th>
                <th className="text-left px-4 py-3">From Date</th>
                <th className="text-left px-4 py-3">To Date</th>
                <th className="text-right px-4 py-3">Days</th>
                {showBalance && <th className="text-right px-4 py-3">Balance</th>}
                <th className="text-left px-4 py-3">Manager Status</th>
                <th className="text-left px-4 py-3">HR Status</th>
                <th className="text-left px-4 py-3">Final Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {leaves.length === 0 && (
                <tr>
                  <td colSpan={showDepartment && showBalance ? 12 : showDepartment || showBalance ? 11 : 10} className="px-4 py-12 text-center text-muted-foreground font-medium">
                    No leave requests found.
                  </td>
                </tr>
              )}
              {leaves.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                  {showApprovalActions && (
                    <td className="px-4 py-3.5">
                      <Checkbox
                        checked={selectedIds.has(l.id)}
                        onCheckedChange={(c) => {
                          const next = new Set(selectedIds);
                          if (c) next.add(l.id);
                          else next.delete(l.id);
                          setSelectedIds(next);
                        }}
                      />
                    </td>
                  )}
                  <td className="px-4 py-3.5 font-semibold text-slate-800 dark:text-slate-200 font-mono text-xs">
                    {l.leaveRequestNo}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {l.employee.firstName} {l.employee.lastName}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">{l.employee.code}</div>
                  </td>
                  {showDepartment && (
                    <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300">
                      {l.employee.department || '—'}
                    </td>
                  )}
                  <td className="px-4 py-3.5">
                    <Badge variant="outline" className="capitalize text-xs font-semibold tracking-wide">
                      {l.type.replace('_', ' ').toLowerCase()}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground">
                    {new Date(l.fromDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground">
                    {new Date(l.toDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3.5 text-right font-bold tabular-nums text-slate-800 dark:text-slate-100">
                    {Number(l.days)}
                  </td>
                  {showBalance && (
                    <td className="px-4 py-3.5 text-right">
                      <div className="font-bold tabular-nums text-slate-800 dark:text-slate-100">
                        {l.balanceSummary?.isUnlimited ? 'Unlimited' : (l.balanceSummary?.available ?? '—')}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        After: {l.balanceSummary?.isUnlimited ? 'Unlimited' : (l.balanceSummary?.balanceAfterApproval ?? '—')}
                      </div>
                    </td>
                  )}
                  <td className="px-4 py-3.5">
                    <Badge
                      variant={
                        l.managerStatus === 'APPROVED'
                          ? 'success'
                          : l.managerStatus === 'REJECTED'
                          ? 'destructive'
                          : 'warning'
                      }
                      className="text-[10px] uppercase font-bold"
                    >
                      {l.managerStatus}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge
                      variant={
                        l.hrStatus === 'APPROVED'
                          ? 'success'
                          : l.hrStatus === 'REJECTED'
                          ? 'destructive'
                          : 'warning'
                      }
                      className="text-[10px] uppercase font-bold"
                    >
                      {l.hrStatus}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge variant={STATUS_VARIANT[l.status] || 'default'} className="text-xs font-semibold">
                      {formatStatus(l.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs font-semibold"
                        onClick={() => {
                          setSelectedLeave(l);
                          setRemarks('');
                        }}
                      >
                        View
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Print Request"
                        className="h-8 w-8 text-muted-foreground hover:text-slate-900"
                        onClick={() => handlePrint(l)}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Leave Detail & Decision Dialog */}
      <Dialog open={selectedLeave !== null} onOpenChange={(open) => !open && setSelectedLeave(null)}>
        <DialogContent className="max-w-2xl bg-white dark:bg-slate-950 p-6 rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
          {selectedLeave && (
            <>
              <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      Leave Application Details
                    </DialogTitle>
                    <DialogDescription className="text-xs font-mono font-bold text-indigo-500 mt-1">
                      Reference: {selectedLeave.leaveRequestNo}
                    </DialogDescription>
                  </div>
                  <Badge variant={STATUS_VARIANT[selectedLeave.status] || 'default'} className="text-xs uppercase font-bold px-3 py-1">
                    {formatStatus(selectedLeave.status)}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="py-4 space-y-5 text-sm">
                {/* Employee Card */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-xs text-muted-foreground block uppercase font-bold">Employee</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      {selectedLeave.employee.firstName} {selectedLeave.employee.lastName}
                    </span>
                    <span className="text-xs text-muted-foreground block font-mono mt-0.5">ID: {selectedLeave.employee.code}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block uppercase font-bold">Organization</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100 block">
                      {selectedLeave.employee.branch?.name || '—'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {selectedLeave.employee.department} · {selectedLeave.employee.designation}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground block font-semibold">Joining Date</span>
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      {selectedLeave.employee.joiningDate ? new Date(selectedLeave.employee.joiningDate).toLocaleDateString() : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-semibold">Employment Type</span>
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      {selectedLeave.employee.employmentType || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-semibold">Department</span>
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      {selectedLeave.employee.department || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-semibold">Designation</span>
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      {selectedLeave.employee.designation || '—'}
                    </span>
                  </div>
                </div>

                {/* Details Section */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground block font-semibold">Leave Type</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100 capitalize">
                      {selectedLeave.type.replace('_', ' ').toLowerCase()}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-semibold">Leave Period</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      {new Date(selectedLeave.fromDate).toLocaleDateString()} - {new Date(selectedLeave.toDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-semibold">Duration</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      {Number(selectedLeave.days)} Day{Number(selectedLeave.days) !== 1 ? 's' : ''}
                      {selectedLeave.halfDay && ' (Half Day)'}
                    </span>
                  </div>
                  {selectedLeave.emergencyContact && (
                    <div>
                      <span className="text-xs text-muted-foreground block font-semibold">Emergency Contact</span>
                      <span className="font-medium text-slate-800 dark:text-slate-100">{selectedLeave.emergencyContact}</span>
                    </div>
                  )}
                  {selectedLeave.handoverEmployee && (
                    <div>
                      <span className="text-xs text-muted-foreground block font-semibold">Handover Duties To</span>
                      <span className="font-medium text-slate-800 dark:text-slate-100">
                        {selectedLeave.handoverEmployee.firstName} {selectedLeave.handoverEmployee.lastName}
                      </span>
                    </div>
                  )}
                  {selectedLeave.attachmentPath && (
                    <div>
                      <span className="text-xs text-muted-foreground block font-semibold">Attachment</span>
                      <a
                        href={selectedLeave.attachmentPath}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-indigo-600 hover:underline font-semibold block mt-0.5"
                      >
                        View Attached File
                      </a>
                    </div>
                  )}
                </div>

                <div className="space-y-1 bg-slate-50/50 dark:bg-slate-900/20 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-muted-foreground block font-semibold">Reason for Leave</span>
                  <p className="text-slate-700 dark:text-slate-300 italic">"{selectedLeave.reason}"</p>
                </div>

                {selectedLeave.balanceSummary && (
                  <div className="space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                      Leave Balance
                    </span>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <BalanceCard
                        label="Entitled"
                        value={selectedLeave.balanceSummary.isUnlimited ? 'Unlimited' : selectedLeave.balanceSummary.entitled}
                      />
                      <BalanceCard label="Used" value={selectedLeave.balanceSummary.used} />
                      <BalanceCard label="Pending" value={selectedLeave.balanceSummary.pending} />
                      <BalanceCard label="Carry Forward" value={selectedLeave.balanceSummary.carryForward} />
                      <BalanceCard
                        label="Available"
                        value={selectedLeave.balanceSummary.isUnlimited ? 'Unlimited' : selectedLeave.balanceSummary.available}
                      />
                      <BalanceCard label="Requested" value={selectedLeave.balanceSummary.requested} />
                      <BalanceCard
                        label="After Approval"
                        value={
                          selectedLeave.balanceSummary.isUnlimited ? 'Unlimited' : selectedLeave.balanceSummary.balanceAfterApproval
                        }
                      />
                    </div>
                  </div>
                )}

                <hr className="border-slate-100 dark:border-slate-800" />

                {/* Workflow Info */}
                <div className="space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    Approval History / Workflow Status
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Manager approval */}
                    <div className="p-3 border border-slate-100 dark:border-slate-800 rounded-lg bg-slate-50/30">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Manager Decision</span>
                        <Badge
                          variant={
                            selectedLeave.managerStatus === 'APPROVED'
                              ? 'success'
                              : selectedLeave.managerStatus === 'REJECTED'
                              ? 'destructive'
                              : 'warning'
                          }
                          className="text-[10px] uppercase font-bold"
                        >
                          {selectedLeave.managerStatus}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-950 p-2 rounded border border-slate-100 dark:border-slate-900 min-h-[40px] italic">
                        {selectedLeave.managerRemarks ? `"${selectedLeave.managerRemarks}"` : 'No remarks.'}
                      </p>
                      {selectedLeave.managerApprovedAt && (
                        <span className="text-[10px] text-muted-foreground block mt-1.5">
                          Decided on {new Date(selectedLeave.managerApprovedAt).toLocaleString()}
                        </span>
                      )}
                    </div>

                    {/* HR Approval */}
                    <div className="p-3 border border-slate-100 dark:border-slate-800 rounded-lg bg-slate-50/30">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">HR Decision</span>
                        <Badge
                          variant={
                            selectedLeave.hrStatus === 'APPROVED'
                              ? 'success'
                              : selectedLeave.hrStatus === 'REJECTED'
                              ? 'destructive'
                              : 'warning'
                          }
                          className="text-[10px] uppercase font-bold"
                        >
                          {selectedLeave.hrStatus}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-950 p-2 rounded border border-slate-100 dark:border-slate-900 min-h-[40px] italic">
                        {selectedLeave.hrRemarks ? `"${selectedLeave.hrRemarks}"` : 'No remarks.'}
                      </p>
                      {selectedLeave.hrApprovedAt && (
                        <span className="text-[10px] text-muted-foreground block mt-1.5">
                          Decided on {new Date(selectedLeave.hrApprovedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Context-aware Actions Panel */}
                <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-6">
                  {/* Option 1: Manager actions */}
                  {showApprovalActions && selectedLeave.status === 'PENDING_MANAGER' && canManagerDecide && (
                    <div className="space-y-3">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Manager Approval Action</Label>
                      <Textarea
                        placeholder="Add remarks or justification..."
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        className="text-sm min-h-[60px]"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <form action={decideLeaveAction} onSubmit={() => setSelectedLeave(null)}>
                          <input type="hidden" name="id" value={selectedLeave.id} />
                          <input type="hidden" name="stage" value="manager" />
                          <input type="hidden" name="action" value="approve" />
                          <input type="hidden" name="remarks" value={remarks} />
                          <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                            Approve
                          </Button>
                        </form>

                        <form action={decideLeaveAction} onSubmit={() => setSelectedLeave(null)}>
                          <input type="hidden" name="id" value={selectedLeave.id} />
                          <input type="hidden" name="stage" value="manager" />
                          <input type="hidden" name="action" value="reject" />
                          <input type="hidden" name="remarks" value={remarks} />
                          <Button type="submit" size="sm" variant="destructive" className="font-semibold">
                            Reject
                          </Button>
                        </form>

                        <form action={decideLeaveAction} onSubmit={() => setSelectedLeave(null)}>
                          <input type="hidden" name="id" value={selectedLeave.id} />
                          <input type="hidden" name="stage" value="manager" />
                          <input type="hidden" name="action" value="return" />
                          <input type="hidden" name="remarks" value={remarks} />
                          <Button type="submit" size="sm" variant="outline" className="font-semibold text-amber-600 border-amber-200 hover:bg-amber-50">
                            Return for Correction
                          </Button>
                        </form>
                      </div>
                    </div>
                  )}

                  {/* Option 2: HR actions */}
                  {showApprovalActions && selectedLeave.status === 'PENDING_HR' && canHrDecide && (
                    <div className="space-y-3">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">HR Approval Action</Label>
                      <Textarea
                        placeholder="Add remarks or justification..."
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        className="text-sm min-h-[60px]"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <form action={decideLeaveAction} onSubmit={() => setSelectedLeave(null)}>
                          <input type="hidden" name="id" value={selectedLeave.id} />
                          <input type="hidden" name="stage" value="hr" />
                          <input type="hidden" name="action" value="approve" />
                          <input type="hidden" name="remarks" value={remarks} />
                          <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                            Approve Leave
                          </Button>
                        </form>

                        <form action={decideLeaveAction} onSubmit={() => setSelectedLeave(null)}>
                          <input type="hidden" name="id" value={selectedLeave.id} />
                          <input type="hidden" name="stage" value="hr" />
                          <input type="hidden" name="action" value="reject" />
                          <input type="hidden" name="remarks" value={remarks} />
                          <Button type="submit" size="sm" variant="destructive" className="font-semibold">
                            Reject Leave
                          </Button>
                        </form>

                        <form action={decideLeaveAction} onSubmit={() => setSelectedLeave(null)}>
                          <input type="hidden" name="id" value={selectedLeave.id} />
                          <input type="hidden" name="stage" value="hr" />
                          <input type="hidden" name="action" value="return" />
                          <input type="hidden" name="remarks" value={remarks} />
                          <Button type="submit" size="sm" variant="outline" className="font-semibold text-amber-600 border-amber-200 hover:bg-amber-50">
                            Return for Correction
                          </Button>
                        </form>

                        <form action={decideLeaveAction} onSubmit={() => setSelectedLeave(null)}>
                          <input type="hidden" name="id" value={selectedLeave.id} />
                          <input type="hidden" name="stage" value="hr" />
                          <input type="hidden" name="action" value="cancel" />
                          <input type="hidden" name="remarks" value={remarks} />
                          <Button type="submit" size="sm" variant="ghost" className="text-rose-500 font-semibold border border-rose-200 hover:bg-rose-50">
                            Cancel Leave
                          </Button>
                        </form>
                      </div>
                    </div>
                  )}

                  {allowWithdraw && ['PENDING_MANAGER', 'PENDING_HR', 'DRAFT', 'RETURNED'].includes(selectedLeave.status) && (
                    <div className="flex justify-end pt-2 border-t border-dashed border-slate-100 dark:border-slate-800 mt-4">
                      <form action={withdrawLeaveAction} onSubmit={() => setSelectedLeave(null)}>
                        <input type="hidden" name="id" value={selectedLeave.id} />
                        <Button type="submit" variant="ghost" className="text-muted-foreground hover:text-rose-500 text-xs font-semibold">
                          Withdraw Request
                        </Button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BalanceCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/30">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">{label}</span>
      <span className="text-base font-bold text-slate-800 dark:text-slate-100">{value}</span>
    </div>
  );
}
