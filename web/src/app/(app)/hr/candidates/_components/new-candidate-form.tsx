'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { FileText, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createCandidateAction, type ActionState } from '@/server/actions/hr-recruitment';

interface Props {
  recruitmentRequests: Array<{
    id: string;
    title: string;
    subject: string;
    metadata: any;
  }>;
}

export function NewCandidateForm({ recruitmentRequests }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createCandidateAction,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCvName, setSelectedCvName] = useState('');

  useEffect(() => {
    if (state?.success && formRef.current) {
      formRef.current.reset();
      setSelectedCvName('');
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} encType="multipart/form-data" className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Candidate Full Name *</Label>
          <Input id="name" name="name" placeholder="e.g. Md. Rakib Hasan" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="recruitmentRequestId">Linked Recruitment Position *</Label>
          <select
            id="recruitmentRequestId"
            name="recruitmentRequestId"
            required
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">Select approved vacancy...</option>
            {recruitmentRequests.map((req) => {
              const meta = req.metadata || {};
              return (
                <option key={req.id} value={req.id}>
                  {meta.requestNo || 'REC'} - {req.title} ({req.subject})
                </option>
              );
            })}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="source">Sourcing Channel</Label>
          <select
            id="source"
            name="source"
            defaultValue="LinkedIn"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="LinkedIn">LinkedIn</option>
            <option value="BDJobs">BDJobs</option>
            <option value="Referral">Employee Referral</option>
            <option value="Direct CV">Direct CV Submission</option>
            <option value="Website">Company Career Page</option>
            <option value="Headhunter">Recruitment Agency</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number *</Label>
          <Input id="phone" name="phone" placeholder="e.g. +880 1712-345678" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email Address *</Label>
          <Input id="email" name="email" type="email" placeholder="e.g. candidate@example.com" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="expectedSalary">Expected Salary (BDT) *</Label>
          <Input id="expectedSalary" name="expectedSalary" type="number" min={0} placeholder="e.g. 50000" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cvFile">CV Upload</Label>
          <input
            ref={fileInputRef}
            id="cvFile"
            name="cvFile"
            type="file"
            accept=".pdf,.doc,.docx"
            className="sr-only"
            onChange={(event) => setSelectedCvName(event.target.files?.[0]?.name ?? '')}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-11 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-left text-sm shadow-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                <UploadCloud className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block font-medium text-foreground">Choose CV file</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {selectedCvName || 'PDF, DOC, or DOCX up to 5MB'}
                </span>
              </span>
            </span>
            <span className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground">
              Browse
            </span>
          </button>
          {selectedCvName ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span className="truncate">{selectedCvName}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="experience">Work Experience Summary</Label>
          <textarea
            id="experience"
            name="experience"
            rows={2}
            placeholder="e.g. 4 years as Assistant Production Supervisor at XYZ Leather Ltd"
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="education">Educational Background</Label>
          <textarea
            id="education"
            name="education"
            rows={2}
            placeholder="e.g. B.Sc. in Leather Engineering, DTE"
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Recording Candidate...' : 'Record Candidate Application'}
        </Button>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        {state?.success && (
          <p className="text-sm text-emerald-600 font-medium">
            Candidate details added successfully.
          </p>
        )}
      </div>
    </form>
  );
}
