'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus } from 'lucide-react';
import { reconcileEcommercePaymentsAction } from '@/server/actions/ecommerce';

interface SettlementRow {
  key: string;
  externalOrderId: string;
  amount: string;
  fee: string;
  provider: string;
}

function emptyRow(): SettlementRow {
  return { key: crypto.randomUUID(), externalOrderId: '', amount: '', fee: '', provider: '' };
}

export function ReconcileForm({
  branchId,
  channels,
}: {
  branchId: string;
  channels: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [channelId, setChannelId] = useState(channels[0]?.id ?? '');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [rows, setRows] = useState<SettlementRow[]>([emptyRow()]);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  function updateRow(key: string, patch: Partial<SettlementRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function submit() {
    if (!channelId) return setMessage({ type: 'err', text: 'Select a channel' });
    if (!periodStart || !periodEnd) return setMessage({ type: 'err', text: 'Select a period' });
    const settlements = rows
      .filter((r) => r.externalOrderId.trim() && Number(r.amount) > 0)
      .map((r) => ({
        externalOrderId: r.externalOrderId.trim(),
        amount: Number(r.amount),
        fee: r.fee ? Number(r.fee) : 0,
        provider: r.provider || undefined,
      }));
    if (settlements.length === 0) return setMessage({ type: 'err', text: 'Enter at least one settlement' });

    startTransition(async () => {
      const res = await reconcileEcommercePaymentsAction({
        branchId,
        channelId,
        periodStart,
        periodEnd,
        settlements,
      });
      if (res && 'error' in res && res.error) return setMessage({ type: 'err', text: res.error });
      if (res && 'success' in res && res.success) {
        setMessage({ type: 'ok', text: `Matched ${res.matchedCount}, unmatched ${res.unmatchedCount}` });
        setRows([emptyRow()]);
        router.refresh();
      }
    });
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="text-sm font-medium">New reconciliation run</div>

      <div>
        <Label>Channel</Label>
        <select
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
          className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="">Select channel</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <Label>Period start</Label>
          <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
        </div>
        <div>
          <Label>Period end</Label>
          <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Settlements</Label>
        {rows.map((row) => (
          <div key={row.key} className="grid grid-cols-[1fr_90px_70px_1fr_auto] gap-2 items-center">
            <Input
              placeholder="External order ID"
              value={row.externalOrderId}
              onChange={(e) => updateRow(row.key, { externalOrderId: e.target.value })}
            />
            <Input
              type="number"
              placeholder="Amount"
              className="tabular"
              value={row.amount}
              onChange={(e) => updateRow(row.key, { amount: e.target.value })}
            />
            <Input
              type="number"
              placeholder="Fee"
              className="tabular"
              value={row.fee}
              onChange={(e) => updateRow(row.key, { fee: e.target.value })}
            />
            <Input
              placeholder="Provider"
              value={row.provider}
              onChange={(e) => updateRow(row.key, { provider: e.target.value })}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
              disabled={rows.length === 1}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setRows((prev) => [...prev, emptyRow()])}>
          <Plus className="h-3.5 w-3.5" /> Add row
        </Button>
      </div>

      {message && (
        <div
          className={`text-sm rounded-md px-3 py-2 ${
            message.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <Button variant="dark" className="w-full" disabled={pending} onClick={submit}>
        {pending ? 'Reconciling…' : 'Run reconciliation'}
      </Button>
    </Card>
  );
}
