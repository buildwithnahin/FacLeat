'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  transferAssetAction,
  disposeAssetAction,
  depreciateAssetAction,
  maintainAssetAction,
  type AssetFormState,
} from '@/server/actions/assets';
import { ASSET_CONDITION } from '@/server/validators/assets';

type Branch = { id: string; name: string; code: string };

export function AssetActions({
  asset,
  branches,
}: {
  asset: { id: string; status: string };
  branches: Branch[];
}) {
  const router = useRouter();
  const [transferState, transferAction, transferPending] = useActionState<AssetFormState, FormData>(
    transferAssetAction,
    undefined,
  );
  const [disposeState, disposeAction, disposePending] = useActionState<AssetFormState, FormData>(
    disposeAssetAction,
    undefined,
  );
  const [deprState, deprAction, deprPending] = useActionState<AssetFormState, FormData>(
    depreciateAssetAction,
    undefined,
  );
  const [maintainState, maintainAction, maintainPending] = useActionState<AssetFormState, FormData>(
    maintainAssetAction,
    undefined,
  );

  useEffect(() => {
    if (
      transferState?.success ||
      disposeState?.success ||
      deprState?.success ||
      maintainState?.success
    ) {
      router.refresh();
    }
  }, [
    transferState?.success,
    disposeState?.success,
    deprState?.success,
    maintainState?.success,
    router,
  ]);

  const disposed = asset.status === 'DISPOSED';

  return (
    <div className="space-y-6">
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold text-sm">Transfer</h3>
        <form action={transferAction} className="space-y-2">
          <input type="hidden" name="assetId" value={asset.id} />
          <div>
            <Label className="text-xs">Target branch</Label>
            <select
              name="toBranchId"
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">— keep current —</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">New location</Label>
            <Input name="toLocation" />
          </div>
          <div>
            <Label className="text-xs">New assignee</Label>
            <Input name="toAssignee" />
          </div>
          <div>
            <Label className="text-xs">Note</Label>
            <Textarea name="note" rows={2} />
          </div>
          <Button type="submit" size="sm" variant="outline" className="w-full" disabled={transferPending || disposed}>
            {transferPending ? 'Transferring…' : 'Transfer asset'}
          </Button>
          {transferState?.error && <p className="text-xs text-red-600">{transferState.error}</p>}
          {transferState?.success && <p className="text-xs text-emerald-600">Transferred.</p>}
        </form>
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold text-sm">Depreciation</h3>
        <form action={deprAction} className="space-y-2">
          <input type="hidden" name="assetId" value={asset.id} />
          <div>
            <Label className="text-xs">Period end</Label>
            <Input type="date" name="periodEnd" required />
          </div>
          <Button type="submit" size="sm" variant="outline" className="w-full" disabled={deprPending || disposed}>
            {deprPending ? 'Posting…' : 'Post depreciation'}
          </Button>
          {deprState?.error && <p className="text-xs text-red-600">{deprState.error}</p>}
          {deprState?.success && <p className="text-xs text-emerald-600">Posted.</p>}
        </form>
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold text-sm">Maintenance & Service</h3>
        <form action={maintainAction} className="space-y-2">
          <input type="hidden" name="assetId" value={asset.id} />
          <div>
            <Label className="text-xs">Service Cost (BDT)</Label>
            <Input type="number" min="0" step="0.01" name="cost" defaultValue="0" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Asset Status</Label>
              <select
                name="status"
                defaultValue={asset.status === 'UNDER_MAINTENANCE' ? 'IN_USE' : 'UNDER_MAINTENANCE'}
                className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-xs"
              >
                <option value="UNDER_MAINTENANCE">Under Maintenance</option>
                <option value="IN_USE">In Use (Active)</option>
                <option value="IN_STORAGE">In Storage</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Condition</Label>
              <select
                name="condition"
                defaultValue="GOOD"
                className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-xs"
              >
                {ASSET_CONDITION.map((c) => (
                  <option key={c} value={c}>
                    {c.toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Service Notes / Work Details *</Label>
            <Textarea
              name="note"
              rows={2}
              placeholder="e.g. Blade sharpening, motor servicing, parts overhaul..."
              required
            />
          </div>
          <Button
            type="submit"
            size="sm"
            variant="outline"
            className="w-full"
            disabled={maintainPending || disposed}
          >
            {maintainPending ? 'Recording…' : 'Log Maintenance'}
          </Button>
          {maintainState?.error && <p className="text-xs text-red-600">{maintainState.error}</p>}
          {maintainState?.success && <p className="text-xs text-emerald-600">Maintenance recorded.</p>}
        </form>
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold text-sm text-red-600">Dispose</h3>
        <form action={disposeAction} className="space-y-2">
          <input type="hidden" name="assetId" value={asset.id} />
          <div>
            <Label className="text-xs">Disposed on</Label>
            <Input type="date" name="disposedAt" required />
          </div>
          <div>
            <Label className="text-xs">Disposal value</Label>
            <Input type="number" min="0" step="0.01" name="disposalValue" defaultValue="0" />
          </div>
          <div>
            <Label className="text-xs">Reason</Label>
            <Textarea name="disposalReason" rows={2} required />
          </div>
          <Button type="submit" size="sm" variant="destructive" className="w-full" disabled={disposePending || disposed}>
            {disposePending ? 'Disposing…' : disposed ? 'Already disposed' : 'Dispose asset'}
          </Button>
          {disposeState?.error && <p className="text-xs text-red-600">{disposeState.error}</p>}
          {disposeState?.success && <p className="text-xs text-emerald-600">Disposed.</p>}
        </form>
      </Card>
    </div>
  );
}
