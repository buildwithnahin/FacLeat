'use client';

import { useActionState, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { applyLeaveAction, getLeavePolicyPreviewAction, type LeaveFormState } from '@/server/actions/leaves';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, FileText } from 'lucide-react';

interface EmployeeDetail {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  department: string | null;
  designation: string | null;
  joiningDate: string | null;
  employmentType: string | null;
  branch: {
    id: string;
    name: string;
  } | null;
}

interface Props {
  employees: EmployeeDetail[];
  types: string[];
}

export function NewLeaveForm({ employees, types }: Props) {
  const [selectedEmpId, setSelectedEmpId] = useState<string>(employees[0]?.id || '');
  const [selectedType, setSelectedType] = useState<string>(types[0] || 'CASUAL');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [halfDay, setHalfDay] = useState<boolean>(false);
  const [halfDayType, setHalfDayType] = useState<string>('FIRST_HALF');

  const [balances, setBalances] = useState<Record<string, { entitled: number; taken: number; pending: number; available: number }> | null>(null);
  const [policyName, setPolicyName] = useState<string>('Loading...');
  const [availableTypes, setAvailableTypes] = useState<string[]>(types);
  const [loadingBalance, setLoadingBalance] = useState<boolean>(false);

  const [state, formAction, pending] = useActionState<LeaveFormState, FormData>(applyLeaveAction, undefined);

  // Auto-lookup details of selected employee
  const emp = employees.find((e) => e.id === selectedEmpId);

  // Fetch leave balances and policy rules when employee changes
  useEffect(() => {
    if (!selectedEmpId) return;
    setLoadingBalance(true);
    getLeavePolicyPreviewAction(selectedEmpId, new Date().getFullYear()).then((res) => {
      if (res) {
        setBalances(res.balance as any);
        setPolicyName(res.policy.policyName);
        const policyTypes = res.policy.rules.map((rule) => rule.leaveType);
        setAvailableTypes(policyTypes.length ? policyTypes : types);
        if (!policyTypes.includes(selectedType) && policyTypes[0]) {
          setSelectedType(policyTypes[0]);
        }
      } else {
        setAvailableTypes(types);
        setPolicyName('Standard Leave Policy');
      }
      setLoadingBalance(false);
    });
  }, [selectedEmpId, types]);

  // Calculate requested days (client-side estimate)
  const getRequestedDays = () => {
    if (halfDay) return 0.5;
    if (!fromDate || !toDate) return 0;
    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) return 0;
    const diffTime = to.getTime() - from.getTime();
    if (diffTime < 0) return 0;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const reqDays = getRequestedDays();
  const currentBalance = balances?.[selectedType];
  const balanceAfterApproval = currentBalance ? Math.max(0, currentBalance.available - reqDays) : 0;

  // Handle submit validation
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (reqDays <= 0) {
      e.preventDefault();
      alert('Invalid date range');
      return;
    }
    if (selectedType !== 'UNPAID' && currentBalance && currentBalance.available < reqDays) {
      e.preventDefault();
      alert('Insufficient leave balance for this type.');
      return;
    }
  };

  // If half day is toggled, sync toDate with fromDate
  useEffect(() => {
    if (halfDay && fromDate) {
      setToDate(fromDate);
    }
  }, [halfDay, fromDate]);

  return (
    <div className="space-y-6">
      <Card className="border border-slate-200 dark:border-slate-800 shadow-md">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-500" />
            New Leave Request
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form action={formAction} onSubmit={handleSubmit} className="space-y-6">
            {/* Section 1: Employee Info */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="employeeId" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Employee <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <select
                    id="employeeId"
                    name="employeeId"
                    value={selectedEmpId}
                    onChange={(e) => setSelectedEmpId(e.target.value)}
                    required
                    className="flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="" disabled>Select Employee</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>{e.code} · {e.firstName} {e.lastName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Branch</Label>
                <Input value={emp?.branch?.name || '—'} readOnly className="h-9 bg-muted text-muted-foreground font-medium" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Department</Label>
                <Input value={emp?.department || '—'} readOnly className="h-9 bg-muted text-muted-foreground font-medium" />
              </div>
            </div>

            {/* Readonly extra employee stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-900/30 p-3.5 rounded-lg border border-slate-100 dark:border-slate-800 text-xs">
              <div>
                <span className="text-muted-foreground block">Employee ID:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{emp?.code || '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Designation:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{emp?.designation || '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Joining Date:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {emp?.joiningDate ? new Date(emp.joiningDate).toLocaleDateString() : '—'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Employment Type:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{emp?.employmentType || '—'}</span>
              </div>
            </div>
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/70 px-3 py-2 text-xs text-indigo-700 dark:border-indigo-950 dark:bg-indigo-950/20 dark:text-indigo-300">
              Active policy: <span className="font-semibold">{policyName}</span>
            </div>

            <hr className="border-slate-200 dark:border-slate-800" />

            {/* Section 2: Leave Details */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="type" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Leave Type <span className="text-destructive">*</span></Label>
                <select
                  id="type"
                  name="type"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {availableTypes.map((t) => (
                    <option key={t} value={t}>{t.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fromDate" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">From Date <span className="text-destructive">*</span></Label>
                <Input
                  id="fromDate"
                  name="fromDate"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  required
                  className="h-9 cursor-pointer"
                  onClick={(e) => e.currentTarget.showPicker()}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="toDate" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">To Date <span className="text-destructive">*</span></Label>
                <Input
                  id="toDate"
                  name="toDate"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  required
                  disabled={halfDay}
                  className="h-9 cursor-pointer disabled:opacity-80"
                  onClick={(e) => !halfDay && e.currentTarget.showPicker()}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Days (Est.)</Label>
                <div className="h-9 flex items-center justify-between border border-input rounded-md bg-slate-50 dark:bg-slate-900 px-3 font-semibold text-slate-800 dark:text-slate-100 text-sm">
                  <span>{reqDays} Day{reqDays !== 1 ? 's' : ''}</span>
                  {halfDay && <Badge variant="outline" className="text-[10px] py-0.5">Half Day</Badge>}
                </div>
              </div>
            </div>

            {/* Half day toggles */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
              <div className="flex items-center space-x-2 border border-slate-100 dark:border-slate-800 p-2 rounded-lg bg-slate-50/50 dark:bg-slate-900/30">
                <input
                  type="checkbox"
                  id="halfDay"
                  checked={halfDay}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setHalfDay(checked);
                    if (checked && fromDate) setToDate(fromDate);
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <input type="hidden" name="halfDay" value={String(halfDay)} />
                <Label htmlFor="halfDay" className="text-xs font-semibold cursor-pointer">Half Day Leave?</Label>
              </div>

              {halfDay && (
                <div className="space-y-1.5">
                  <Label htmlFor="halfDayType" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Half Day Period</Label>
                  <select
                    id="halfDayType"
                    name="halfDayType"
                    value={halfDayType}
                    onChange={(e) => setHalfDayType(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="FIRST_HALF">First Half (Morning)</option>
                    <option value="SECOND_HALF">Second Half (Afternoon)</option>
                  </select>
                </div>
              )}

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="handoverEmployeeId" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Handover Responsibility To</Label>
                <select
                  id="handoverEmployeeId"
                  name="handoverEmployeeId"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">None</option>
                  {employees.filter(e => e.id !== selectedEmpId).map((e) => (
                    <option key={e.id} value={e.id}>{e.code} · {e.firstName} {e.lastName}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="reason" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reason for Leave <span className="text-destructive">*</span></Label>
                <Input id="reason" name="reason" placeholder="State reason clearly..." required className="h-9" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emergencyContact" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Emergency Contact Phone</Label>
                <Input id="emergencyContact" name="emergencyContact" placeholder="+88017..." className="h-9" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="attachmentPath" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Attachment URL / Path</Label>
                <Input id="attachmentPath" name="attachmentPath" placeholder="Link to medical/supporting document..." className="h-9" />
              </div>
            </div>

            {/* Live Balance Preview Card */}
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-3">
                Live Balance Preview ({selectedType.replace('_', ' ')})
              </span>
              {loadingBalance ? (
                <div className="text-sm text-muted-foreground py-2 animate-pulse">Loading live leave balances...</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
                  <div className="bg-white dark:bg-slate-950 p-2.5 rounded border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Entitled</span>
                    <span className="text-lg font-bold text-slate-800 dark:text-slate-100">
                      {currentBalance?.entitled ?? 0} Days
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-950 p-2.5 rounded border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Taken</span>
                    <span className="text-lg font-bold text-slate-500">
                      {currentBalance?.taken ?? 0} Days
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-950 p-2.5 rounded border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Pending</span>
                    <span className="text-lg font-bold text-amber-500">
                      {currentBalance?.pending ?? 0} Days
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-950 p-2.5 rounded border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Available</span>
                    <span className="text-lg font-bold text-emerald-500">
                      {currentBalance?.available ?? 0} Days
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-950 p-2.5 rounded border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Requested</span>
                    <span className="text-lg font-bold text-blue-500">
                      {reqDays} Days
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-950 p-2.5 rounded border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Balance After</span>
                    <span className={`text-lg font-bold ${balanceAfterApproval < 0 ? 'text-rose-500' : 'text-indigo-500'}`}>
                      {balanceAfterApproval} Days
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Button type="submit" disabled={pending} className="w-full md:w-auto md:px-12 bg-indigo-600 hover:bg-indigo-700 text-white font-medium self-end">
                {pending ? 'Submitting Leave Request…' : 'Submit Leave Request'}
              </Button>
              {state?.error && <p className="text-sm font-semibold text-rose-500 bg-rose-50 dark:bg-rose-950/20 p-3 rounded-md border border-rose-100 dark:border-rose-900">{state.error}</p>}
              {state?.success && <p className="text-sm font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-md border border-emerald-100 dark:border-emerald-900">Leave request submitted successfully.</p>}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Leave Balance Preview Dashboard of All Types */}
      <Card className="border border-slate-200 dark:border-slate-800">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 pb-3">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Current Leave Balance Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {loadingBalance ? (
            <div className="text-sm text-muted-foreground text-center py-6 animate-pulse">Loading balance summary...</div>
          ) : balances ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {Object.entries(balances).map(([type, bal]) => (
                <div key={type} className="border border-slate-100 dark:border-slate-800 rounded-lg p-3 bg-white dark:bg-slate-950 flex flex-col justify-between">
                  <div className="flex justify-between items-center mb-1">
                    <Badge variant="outline" className="text-[9px] uppercase tracking-wide px-1.5 py-0">
                      {type.replace('_', ' ')}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground font-mono">Entitled: {bal.entitled}d</span>
                  </div>
                  <div className="mt-2 flex justify-between items-baseline">
                    <span className="text-[10px] text-muted-foreground">Available:</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{bal.available} Days</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-4">No balances loaded. Please select an employee.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
