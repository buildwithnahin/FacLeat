'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Plus, FileSpreadsheet, ListPlus, Calculator, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { reconcileEcommercePaymentsAction } from '@/server/actions/ecommerce';
import { formatCurrency } from '@/lib/money';

interface SettlementRow {
  key: string;
  externalOrderId: string;
  amount: string;
  fee: string;
  provider: string;
}

function emptyRow(): SettlementRow {
  return {
    key: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
    externalOrderId: '',
    amount: '',
    fee: '',
    provider: '',
  };
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
  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [inputMode, setInputMode] = useState<'manual' | 'paste'>('manual');
  const [bulkText, setBulkText] = useState('');
  const [rows, setRows] = useState<SettlementRow[]>([emptyRow()]);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  function updateRow(key: string, patch: Partial<SettlementRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  // Parse bulk pasted spreadsheet text (tab or comma separated)
  function handleBulkImport() {
    if (!bulkText.trim()) {
      toast.error('Please paste settlement data into the box first');
      return;
    }

    const lines = bulkText.trim().split('\n');
    const parsedRows: SettlementRow[] = [];
    let skipped = 0;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      // Skip header lines
      if (
        line.toLowerCase().includes('order') ||
        line.toLowerCase().includes('external') ||
        line.toLowerCase().includes('tracking')
      ) {
        continue;
      }

      // Split by tab, comma, or semicolon
      const parts = line.includes('\t')
        ? line.split('\t')
        : line.includes(',')
          ? line.split(',')
          : line.split(';');

      const externalOrderId = parts[0]?.trim() || '';
      const amount = parts[1]?.trim().replace(/[^0-9.]/g, '') || '';
      const fee = parts[2]?.trim().replace(/[^0-9.]/g, '') || '0';
      const provider = parts[3]?.trim() || 'COURIER_COD';

      if (externalOrderId && parseFloat(amount) > 0) {
        parsedRows.push({
          key: Math.random().toString(36).slice(2),
          externalOrderId,
          amount,
          fee,
          provider,
        });
      } else {
        skipped++;
      }
    }

    if (parsedRows.length === 0) {
      toast.error('No valid rows found. Format: ExternalOrderId, Amount, [Fee], [Provider]');
      return;
    }

    setRows(parsedRows);
    setInputMode('manual');
    toast.success(
      `Loaded ${parsedRows.length} settlement row(s)${skipped > 0 ? ` (${skipped} headers/empty rows skipped)` : ''}`,
    );
  }

  // Calculate live financial running metrics
  const validRows = rows.filter((r) => r.externalOrderId.trim() && parseFloat(r.amount) > 0);
  const totalGross = validRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const totalFees = validRows.reduce((sum, r) => sum + (parseFloat(r.fee) || 0), 0);
  const netReceivable = Math.max(0, totalGross - totalFees);

  function submit() {
    if (!branchId) {
      const err = 'Branch context is required to run reconciliation';
      setMessage({ type: 'err', text: err });
      toast.error(err);
      return;
    }
    if (!channelId) {
      const err = 'Select an e-commerce sales channel';
      setMessage({ type: 'err', text: err });
      toast.error(err);
      return;
    }
    if (!periodStart || !periodEnd) {
      const err = 'Select reconciliation period date range';
      setMessage({ type: 'err', text: err });
      toast.error(err);
      return;
    }
    if (new Date(periodEnd) < new Date(periodStart)) {
      const err = 'Period end cannot be earlier than period start';
      setMessage({ type: 'err', text: err });
      toast.error(err);
      return;
    }

    const settlements = rows
      .filter((r) => r.externalOrderId.trim() && parseFloat(r.amount) > 0)
      .map((r) => ({
        externalOrderId: r.externalOrderId.trim(),
        amount: parseFloat(r.amount),
        fee: r.fee ? Math.max(0, parseFloat(r.fee) || 0) : 0,
        provider: r.provider.trim() || undefined,
      }));

    if (settlements.length === 0) {
      const err = 'Enter at least one valid settlement row with order ID and amount';
      setMessage({ type: 'err', text: err });
      toast.error(err);
      return;
    }

    startTransition(async () => {
      const res = await reconcileEcommercePaymentsAction({
        branchId,
        channelId,
        periodStart,
        periodEnd,
        settlements,
      });

      if (res && 'error' in res && res.error) {
        setMessage({ type: 'err', text: res.error });
        toast.error(res.error);
        return;
      }

      if (res && 'success' in res && res.success) {
        const okMsg = `Reconciliation completed: Matched ${res.matchedCount} order(s), ${res.unmatchedCount} unmatched.`;
        setMessage({ type: 'ok', text: okMsg });
        toast.success(okMsg);
        setRows([emptyRow()]);
        router.refresh();
      }
    });
  }

  return (
    <Card className="p-5 space-y-5 border shadow-sm">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">New Reconciliation Run</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Match courier COD collections against order payments.
          </p>
        </div>
        <div className="flex items-center gap-1 bg-muted p-1 rounded-md text-xs">
          <button
            type="button"
            onClick={() => setInputMode('manual')}
            className={`px-2 py-1 rounded transition-colors ${
              inputMode === 'manual' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'
            }`}
          >
            Line Items
          </button>
          <button
            type="button"
            onClick={() => setInputMode('paste')}
            className={`px-2 py-1 rounded transition-colors ${
              inputMode === 'paste' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'
            }`}
          >
            Bulk Paste
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Storefront / Channel</Label>
        <select
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
        >
          <option value="">Select sales channel</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Settlement Period From</Label>
          <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Settlement Period To</Label>
          <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </div>
      </div>

      {inputMode === 'paste' ? (
        <div className="space-y-3 bg-muted/20 p-3 rounded-lg border">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5 text-xs font-semibold">
              <FileSpreadsheet className="h-4 w-4 text-primary" /> Paste Courier Settlement Sheet
            </Label>
            <span className="text-[11px] text-muted-foreground">Tab or CSV format</span>
          </div>
          <Textarea
            rows={6}
            placeholder={`Example format (copy directly from Excel / Sheets):\nORD-1001\t1500\t60\tSteadfast\nORD-1002\t2400\t100\tPathao`}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            className="font-mono text-xs"
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setInputMode('manual')}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleBulkImport}
              className="gap-1.5 text-xs"
            >
              <ListPlus className="h-4 w-4" /> Load Rows
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">Settlement Lines ({rows.length})</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRows([emptyRow()])}
              className="h-7 text-xs text-muted-foreground"
            >
              Clear All
            </Button>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {rows.map((row) => (
              <div
                key={row.key}
                className="grid grid-cols-[1fr_85px_65px_1fr_auto] gap-1.5 items-center"
              >
                <Input
                  placeholder="Order ID / Ext ID"
                  className="text-xs h-8"
                  value={row.externalOrderId}
                  onChange={(e) => updateRow(row.key, { externalOrderId: e.target.value })}
                />
                <Input
                  type="number"
                  placeholder="Amount"
                  className="tabular text-xs h-8"
                  value={row.amount}
                  onChange={(e) => updateRow(row.key, { amount: e.target.value })}
                />
                <Input
                  type="number"
                  placeholder="Fee"
                  className="tabular text-xs h-8"
                  value={row.fee}
                  onChange={(e) => updateRow(row.key, { fee: e.target.value })}
                />
                <Input
                  placeholder="Courier/Prov"
                  className="text-xs h-8"
                  value={row.provider}
                  onChange={(e) => updateRow(row.key, { provider: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                  onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                  disabled={rows.length === 1}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRows((prev) => [...prev, emptyRow()])}
              className="gap-1 text-xs h-8"
            >
              <Plus className="h-3.5 w-3.5" /> Add Row
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setInputMode('paste')}
              className="gap-1 text-xs text-muted-foreground h-8"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Bulk Paste
            </Button>
          </div>
        </div>
      )}

      {/* Financial Settlement Calculator Box */}
      {validRows.length > 0 && (
        <div className="bg-muted/40 p-3 rounded-lg border space-y-1.5 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-foreground mb-1">
            <Calculator className="h-3.5 w-3.5 text-primary" />
            <span>Settlement Audit Calculation</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Valid Order Entries:</span>
            <span className="font-semibold text-foreground">{validRows.length}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Gross COD Collected:</span>
            <span className="font-mono text-emerald-700 font-semibold">
              {formatCurrency(totalGross, 'BDT')}
            </span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Courier Service Deductions:</span>
            <span className="font-mono text-amber-700 font-semibold">
              −{formatCurrency(totalFees, 'BDT')}
            </span>
          </div>
          <div className="flex justify-between text-foreground font-bold border-t pt-1">
            <span>Net Bank Disbursement:</span>
            <span className="font-mono text-primary text-sm">
              {formatCurrency(netReceivable, 'BDT')}
            </span>
          </div>
        </div>
      )}

      {message && (
        <div
          className={`text-xs rounded-md px-3 py-2 font-medium ${
            message.type === 'ok'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <Button
        className="w-full gap-2"
        disabled={pending || validRows.length === 0}
        onClick={submit}
      >
        {pending ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" /> Reconciling Payments...
          </>
        ) : (
          `Execute Reconciliation (${validRows.length} lines)`
        )}
      </Button>
    </Card>
  );
}
