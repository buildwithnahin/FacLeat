'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { completeJoiningAction, type ActionState } from '@/server/actions/hr-recruitment';
import { DEFAULT_EMPLOYMENT_TYPES } from '@/server/validators/hr';
import { CheckSquare } from 'lucide-react';

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

interface AcceptedOffer {
  id: string;
  title: string;
  subject: string | null;
  amount: any;
  metadata: any;
}

interface ShiftOption {
  id: string;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  branchId: string;
  branch: {
    name: string;
    code: string;
  };
}

interface Props {
  acceptedOffers: AcceptedOffer[];
  branches: BranchOption[];
  shifts: ShiftOption[];
}

function formatTime(value: string) {
  const [hourText, minute] = value.split(':');
  const hour = Number(hourText);
  if (Number.isNaN(hour) || !minute) return value;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const normalizedHour = hour % 12 || 12;
  return `${String(normalizedHour).padStart(2, '0')}:${minute} ${suffix}`;
}

export function CompleteJoiningForm({ acceptedOffers, branches, shifts }: Props) {
  const [selectedOfferId, setSelectedOfferId] = useState<string>('');
  const [empIdInput, setEmpIdInput] = useState<string>('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    completeJoiningAction,
    undefined
  );

  const formRef = useRef<HTMLFormElement>(null);

  // Checklist state (mock/visual representation of onboarding steps)
  const [checklist, setChecklist] = useState({
    docsUploaded: false,
    contractSigned: false,
    systemAccountCreated: false,
    workspaceAssigned: false,
  });

  // Automatically fetch next suggested Employee ID
  useEffect(() => {
    // Generate a pseudo-random or sequentially high EMP number
    const rand = Math.floor(1000 + Math.random() * 9000);
    setEmpIdInput(`EMP-${rand}`);
  }, [selectedOfferId]);

  // Find selected offer details
  const selectedOffer = acceptedOffers.find((o) => o.id === selectedOfferId);
  const metadata = selectedOffer?.metadata || {};
  const availableShifts = selectedBranchId ? shifts.filter((shift) => shift.branchId === selectedBranchId) : shifts;

  useEffect(() => {
    if (state?.success && formRef.current) {
      formRef.current.reset();
      setSelectedOfferId('');
      setSelectedBranchId('');
      setChecklist({
        docsUploaded: false,
        contractSigned: false,
        systemAccountCreated: false,
        workspaceAssigned: false,
      });
    }
  }, [state]);

  const canSubmit = checklist.docsUploaded && checklist.contractSigned && checklist.systemAccountCreated;

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="offerId">Select Accepted Offer *</Label>
          <select
            id="offerId"
            name="offerId"
            required
            value={selectedOfferId}
            onChange={(e) => setSelectedOfferId(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">Select candidate offer...</option>
            {acceptedOffers.map((o) => (
              <option key={o.id} value={o.id}>
                {((o.metadata as Record<string, unknown> | null)?.candidateName as string | undefined) || o.title || 'Candidate'} - {o.subject}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="employeeId">Assign Employee ID Code *</Label>
          <Input
            id="employeeId"
            name="employeeId"
            required
            value={empIdInput}
            onChange={(e) => setEmpIdInput(e.target.value.toUpperCase())}
            placeholder="e.g. EMP-0056"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="branchId">Assign Branch *</Label>
          <select
            id="branchId"
            name="branchId"
            required
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">Select branch...</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} · {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedOffer && (
        <div className="bg-muted/30 p-4 rounded-lg border border-dashed grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="font-semibold text-muted-foreground block">Designation</span>
            <Input
              name="designation"
              defaultValue={selectedOffer.subject || ''}
              className="h-8 mt-1 text-xs"
              required
            />
          </div>
          <div>
            <span className="font-semibold text-muted-foreground block">Department</span>
            <Input
              name="department"
              defaultValue={metadata.department || 'Production'}
              className="h-8 mt-1 text-xs"
              required
            />
          </div>
          <div>
            <span className="font-semibold text-muted-foreground block">Salary (Finalized BDT)</span>
            <div className="h-8 flex items-center font-bold text-foreground text-sm pl-1">
              {Number(selectedOffer.amount || 0).toLocaleString()} BDT
            </div>
          </div>
          <div>
            <span className="font-semibold text-muted-foreground block">Employment Type</span>
            <select
              name="employmentType"
              defaultValue="PERMANENT"
              className="flex h-8 w-full mt-1 rounded-md border border-input bg-transparent px-2 text-xs"
            >
              {DEFAULT_EMPLOYMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-4">
            <span className="font-semibold text-muted-foreground block">Shift Assignment</span>
            <select
              name="shiftId"
              required
              defaultValue=""
              className="flex h-8 w-full mt-1 rounded-md border border-input bg-transparent px-2 text-xs"
            >
              <option value="">Select a shift...</option>
              {availableShifts.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {shift.code} · {shift.name} · {formatTime(shift.startTime)}-{formatTime(shift.endTime)} · {shift.branch.code}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Onboarding Checklist */}
      <div className="space-y-3 p-4 rounded-lg border bg-muted/10">
        <div className="flex items-center gap-2 border-b pb-2 mb-2">
          <CheckSquare className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold text-card-foreground">Onboarding Verification Checklist</h4>
        </div>
        <p className="text-xs text-muted-foreground pb-2">
          All key checkpoints must be verified before the candidate record can be converted to an employee profile.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <label className="flex items-center gap-2.5 p-2 bg-background rounded border hover:bg-muted/10 cursor-pointer">
            <input
              type="checkbox"
              checked={checklist.docsUploaded}
              onChange={(e) => setChecklist({ ...checklist, docsUploaded: e.target.checked })}
              className="rounded text-primary focus:ring-primary h-4 w-4"
            />
            <span>Documents Collected (NID, Photos, Certificates) *</span>
          </label>

          <label className="flex items-center gap-2.5 p-2 bg-background rounded border hover:bg-muted/10 cursor-pointer">
            <input
              type="checkbox"
              checked={checklist.contractSigned}
              onChange={(e) => setChecklist({ ...checklist, contractSigned: e.target.checked })}
              className="rounded text-primary focus:ring-primary h-4 w-4"
            />
            <span>Employment Contract Signed *</span>
          </label>

          <label className="flex items-center gap-2.5 p-2 bg-background rounded border hover:bg-muted/10 cursor-pointer">
            <input
              type="checkbox"
              checked={checklist.systemAccountCreated}
              onChange={(e) => setChecklist({ ...checklist, systemAccountCreated: e.target.checked })}
              className="rounded text-primary focus:ring-primary h-4 w-4"
            />
            <span>Official ERP Account Created *</span>
          </label>

          <label className="flex items-center gap-2.5 p-2 bg-background rounded border hover:bg-muted/10 cursor-pointer">
            <input
              type="checkbox"
              checked={checklist.workspaceAssigned}
              onChange={(e) => setChecklist({ ...checklist, workspaceAssigned: e.target.checked })}
              className="rounded text-primary focus:ring-primary h-4 w-4"
            />
            <span>Shift/Seat & Equipment Prepared</span>
          </label>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || !canSubmit}>
          {pending ? 'Completing Joining...' : 'Complete Onboarding & Create Employee'}
        </Button>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        {state?.success && (
          <p className="text-sm text-emerald-600 font-medium">
            Employee registered, joining record created, and onboarding complete!
          </p>
        )}
      </div>

      {!canSubmit && selectedOffer && (
        <p className="text-[11px] text-amber-600 font-medium italic">
          * Please verify and check the first three required onboarding points to enable the submission button.
        </p>
      )}
    </form>
  );
}
