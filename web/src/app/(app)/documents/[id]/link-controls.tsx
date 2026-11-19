'use client';

import { useActionState, useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  linkDocumentAction,
  unlinkDocumentAction,
  deleteDocumentAction,
  type DocumentFormState,
} from '@/server/actions/documents';

const ENTITY_TYPE_OPTIONS = [
  'PurchaseOrder',
  'PurchaseInvoice',
  'PurchaseRequisition',
  'GoodsReceiving',
  'DamageReport',
  'Supplier',
  'Customer',
  'Employee',
  'Candidate',
  'Asset',
  'ProductionOrder',
  'Other',
];

export function LinkForm({ documentId }: { documentId: string }) {
  const [state, action, pending] = useActionState<DocumentFormState, FormData>(
    linkDocumentAction,
    undefined,
  );
  const [selectedType, setSelectedType] = useState('PurchaseOrder');
  const [customType, setCustomType] = useState('');

  return (
    <Card className="p-4 space-y-3">
      <h3 className="font-semibold text-sm">Link to entity</h3>
      <form action={action} className="space-y-3">
        <input type="hidden" name="documentId" value={documentId} />
        <div>
          <Label className="text-xs">Entity type</Label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {ENTITY_TYPE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {selectedType === 'Other' ? (
            <Input
              name="entityType"
              required
              placeholder="e.g. SalesContract"
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
              className="mt-2 text-xs"
            />
          ) : (
            <input type="hidden" name="entityType" value={selectedType} />
          )}
        </div>
        <div>
          <Label className="text-xs">Entity ID</Label>
          <Input name="entityId" required placeholder="ID or reference" />
        </div>
        <div>
          <Label className="text-xs">Note (optional)</Label>
          <Input name="note" placeholder="e.g. Signed copy, warranty, bill" />
        </div>
        <Button type="submit" variant="dark" className="w-full" disabled={pending}>
          {pending ? 'Linking…' : 'Add link'}
        </Button>
        {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
        {state?.success && <p className="text-xs text-emerald-600">Linked successfully.</p>}
      </form>
    </Card>
  );
}

export function UnlinkButton({
  documentId,
  linkId,
}: {
  documentId: string;
  linkId: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="text-muted-foreground hover:text-red-600 disabled:opacity-50"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await unlinkDocumentAction(documentId, linkId);
        })
      }
      title="Remove link"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

export function DeleteDocumentButton({ documentId }: { documentId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleDelete = () => {
    if (!confirm('Are you sure you want to permanently delete this document?')) {
      return;
    }
    setError(null);
    start(async () => {
      const res = await deleteDocumentAction(documentId);
      if (res?.error) {
        setError(res.error);
      } else {
        router.push('/documents');
      }
    });
  };

  return (
    <div>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={handleDelete}
      >
        <Trash2 className="h-4 w-4 mr-1.5" />
        {pending ? 'Deleting…' : 'Delete Document'}
      </Button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
