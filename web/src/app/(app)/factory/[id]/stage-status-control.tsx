'use client';

import { useActionState } from 'react';
import { updateStageAction, type FactoryFormState } from '@/server/actions/factory';
import { PRODUCTION_STAGE_STATUS } from '@/server/validators/factory';

export function StageStatusControl({
  stageId,
  orderId,
  currentStatus,
  disabled,
}: {
  stageId: string;
  orderId: string;
  currentStatus: string;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState<FactoryFormState, FormData>(
    updateStageAction,
    undefined,
  );

  if (disabled) return null;

  return (
    <form action={formAction} className="inline-flex items-center gap-1.5">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="stageId" value={stageId} />
      <select
        name="status"
        defaultValue={currentStatus}
        disabled={pending}
        onChange={(e) => e.target.form?.requestSubmit()}
        className="h-7 rounded border border-input bg-transparent px-2 text-xs"
      >
        {PRODUCTION_STAGE_STATUS.map((s) => (
          <option key={s} value={s}>
            {s.replace('_', ' ').toLowerCase()}
          </option>
        ))}
      </select>
      {state?.error && <span className="text-[10px] text-red-600">{state.error}</span>}
    </form>
  );
}
