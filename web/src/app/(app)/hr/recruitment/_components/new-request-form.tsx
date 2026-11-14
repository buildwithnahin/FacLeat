'use client';

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { DesignationOption } from '@/lib/hr-master-data';
import {
  createRecruitmentRequestAction,
  createDesignationAction,
  type ActionState,
} from '@/server/actions/hr-recruitment';

const FALLBACK_DEPARTMENTS = ['Production', 'HR', 'Accounts'];

export function NewRequestForm({
  departments,
  designationOptions,
}: {
  departments: string[];
  designationOptions: DesignationOption[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createRecruitmentRequestAction,
    {},
  );
  const departmentOptions = Array.from(
    new Set((departments.length ? departments : FALLBACK_DEPARTMENTS).filter(Boolean)),
  );
  const [selectedDepartment, setSelectedDepartment] = useState(departmentOptions[0] ?? '');
  const [selectedPosition, setSelectedPosition] = useState('');
  const [designationsList, setDesignationsList] = useState<DesignationOption[]>(designationOptions);

  // Add designation modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDesignationName, setNewDesignationName] = useState('');
  const [newDesignationDept, setNewDesignationDept] = useState(departmentOptions[0] ?? '');
  const [addError, setAddError] = useState<string | null>(null);
  const [isSavingDesignation, startSaving] = useTransition();

  const formRef = useRef<HTMLFormElement>(null);

  const filteredDesignationOptions = useMemo(() => {
    const matches = designationsList.filter(
      (option) => !option.department || !selectedDepartment || option.department === selectedDepartment,
    );
    const values = matches.length ? matches : designationsList;
    const names = new Set<string>();
    return values.filter((option) => {
      if (names.has(option.name)) return false;
      names.add(option.name);
      return true;
    });
  }, [designationsList, selectedDepartment]);

  useEffect(() => {
    if (state?.success && formRef.current) {
      formRef.current.reset();
      setSelectedDepartment(departmentOptions[0] ?? '');
      setSelectedPosition('');
    }
  }, [departmentOptions, state]);

  useEffect(() => {
    if (!selectedPosition) return;
    if (!filteredDesignationOptions.some((option) => option.name === selectedPosition)) {
      setSelectedPosition('');
    }
  }, [filteredDesignationOptions, selectedPosition]);

  function handleSaveDesignation(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    if (!newDesignationName.trim()) {
      setAddError('Please enter a designation name');
      return;
    }

    startSaving(async () => {
      const res = await createDesignationAction(newDesignationName, newDesignationDept);
      if (!res.success) {
        setAddError(res.error ?? 'Failed to create designation');
        return;
      }
      const newOpt: DesignationOption = {
        name: res.designation?.name ?? newDesignationName.trim(),
        department: res.designation?.department ?? newDesignationDept,
      };
      setDesignationsList((prev) => [newOpt, ...prev]);
      setSelectedPosition(newOpt.name);
      if (newOpt.department) {
        setSelectedDepartment(newOpt.department);
      }
      setNewDesignationName('');
      setShowAddModal(false);
    });
  }

  return (
    <>
      <form ref={formRef} action={formAction} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="position">Designation *</Label>
              <button
                type="button"
                onClick={() => {
                  setNewDesignationDept(selectedDepartment || departmentOptions[0] || '');
                  setAddError(null);
                  setShowAddModal(true);
                }}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
              >
                <Plus className="h-3 w-3" /> Add new
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <select
                id="position"
                name="position"
                required
                value={selectedPosition}
                onChange={(event) => setSelectedPosition(event.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
              >
                <option value="">Select designation</option>
                {filteredDesignationOptions.map((designation) => (
                  <option
                    key={`${designation.name}-${designation.department ?? 'shared'}`}
                    value={designation.name}
                  >
                    {designation.name}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0 shrink-0"
                title="Add new designation"
                onClick={() => {
                  setNewDesignationDept(selectedDepartment || departmentOptions[0] || '');
                  setAddError(null);
                  setShowAddModal(true);
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="department">Department *</Label>
            <select
              id="department"
              name="department"
              required
              value={selectedDepartment}
              onChange={(event) => setSelectedDepartment(event.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
            >
              {departmentOptions.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vacancies">Number of Vacancies *</Label>
            <Input
              id="vacancies"
              name="vacancies"
              type="number"
              min={1}
              defaultValue={1}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="salaryRange">Salary Range *</Label>
            <Input
              id="salaryRange"
              name="salaryRange"
              placeholder="e.g. 45,000–55,000"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expectedJoining">Expected Joining Date *</Label>
            <Input
              id="expectedJoining"
              name="expectedJoining"
              type="date"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <select
              id="priority"
              name="priority"
              defaultValue="NORMAL"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
            >
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reason">Reason for Recruitment / Justification *</Label>
          <textarea
            id="reason"
            name="reason"
            rows={3}
            placeholder="e.g. Factory Expansion, Increased workload, Backfill"
            required
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? 'Submitting Request...' : 'Submit Request'}
          </Button>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          {state?.success && (
            <p className="text-sm text-emerald-600 font-medium">
              Recruitment request submitted successfully.
            </p>
          )}
        </div>
      </form>

      {/* Modal to add new designation */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background border rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-semibold text-base">Add New Designation</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDesignation} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newDesignationName">Designation Name *</Label>
                <Input
                  id="newDesignationName"
                  placeholder="e.g. Senior Leather Artisan"
                  value={newDesignationName}
                  onChange={(e) => setNewDesignationName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newDesignationDept">Department</Label>
                <select
                  id="newDesignationDept"
                  value={newDesignationDept}
                  onChange={(e) => setNewDesignationDept(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                >
                  <option value="">— Shared / All Departments —</option>
                  {departmentOptions.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {addError && <p className="text-xs text-destructive">{addError}</p>}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddModal(false)}
                  disabled={isSavingDesignation}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSavingDesignation}>
                  {isSavingDesignation ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…
                    </>
                  ) : (
                    'Save Designation'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
