'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Inbox,
  CheckCircle2,
  Clock,
  Eye,
  Search,
  Loader2,
  AlertCircle,
  Truck,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pill, type PillTone } from '@/components/shared/pill';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { receiveStockTransferAction } from '@/server/actions/stock-requisitions';

const STATUS_TONE: Record<string, PillTone> = {
  DISPATCHED: 'blue',
  IN_TRANSIT: 'blue',
  RECEIVED: 'green',
};

export interface ReceiptItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  quantity: string;
  receivedQty: string;
  damagedQty: string;
  missingQty: string;
}

export interface ReceiptTransferRow {
  id: string;
  number: string;
  status: string;
  requisition: { id: string; number: string };
  fromWarehouse: { name: string; code?: string };
  toWarehouse: { name: string; code?: string };
  items: ReceiptItem[];
}

export function ReceiveQueueClient({ transfers }: { transfers: ReceiptTransferRow[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<'PENDING' | 'RECEIVED'>('PENDING');
  const [search, setSearch] = useState('');
  const [isPending, startTransition] = useTransition();

  // Receive Dialog state
  const [receivingTransfer, setReceivingTransfer] = useState<ReceiptTransferRow | null>(null);
  const [itemRows, setItemRows] = useState<
    { itemId: string; receivedQty: string; damagedQty: string; missingQty: string }[]
  >([]);
  const [receiveRemarks, setReceiveRemarks] = useState('');

  function openReceiveModal(transfer: ReceiptTransferRow) {
    setReceivingTransfer(transfer);
    setItemRows(
      transfer.items.map((it) => ({
        itemId: it.id,
        receivedQty: it.quantity,
        damagedQty: '0',
        missingQty: '0',
      })),
    );
    setReceiveRemarks('');
  }

  function handleAutoFillAll(transfer: ReceiptTransferRow) {
    setItemRows(
      transfer.items.map((it) => ({
        itemId: it.id,
        receivedQty: it.quantity,
        damagedQty: '0',
        missingQty: '0',
      })),
    );
    toast.info('All items filled with full dispatched quantity.');
  }

  function handleItemChange(
    itemId: string,
    field: 'receivedQty' | 'damagedQty' | 'missingQty',
    val: string,
  ) {
    setItemRows((prev) =>
      prev.map((r) => (r.itemId === itemId ? { ...r, [field]: val } : r)),
    );
  }

  function handleReceiveSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!receivingTransfer) return;

    // Validate that for every item, sum equals dispatched quantity
    for (const it of receivingTransfer.items) {
      const row = itemRows.find((r) => r.itemId === it.id);
      if (!row) continue;
      const rec = Number(row.receivedQty || 0);
      const dam = Number(row.damagedQty || 0);
      const mis = Number(row.missingQty || 0);
      const sum = rec + dam + mis;
      const expected = Number(it.quantity || 0);

      if (Math.abs(sum - expected) > 0.0001) {
        toast.error(
          `For ${it.productName}, sum of Received (${rec}) + Damaged (${dam}) + Missing (${mis}) must equal Dispatched (${expected})`,
        );
        return;
      }
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set('transferId', receivingTransfer.id);
      formData.set('itemsJson', JSON.stringify(itemRows));
      if (receiveRemarks) formData.set('receiveRemarks', receiveRemarks);

      const res = await receiveStockTransferAction(undefined, formData);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(`Transfer ${receivingTransfer.number} received successfully! Stock updated.`);
        setReceivingTransfer(null);
        router.refresh();
      }
    });
  }

  // Filter
  const filtered = transfers.filter((t) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      t.number.toLowerCase().includes(q) ||
      t.requisition.number.toLowerCase().includes(q) ||
      t.fromWarehouse.name.toLowerCase().includes(q) ||
      t.toWarehouse.name.toLowerCase().includes(q)
    );
  });

  const pendingTransfers = filtered.filter((t) =>
    ['DISPATCHED', 'IN_TRANSIT'].includes(t.status),
  );
  const receivedTransfers = filtered.filter((t) => t.status === 'RECEIVED');

  const displayTransfers = tab === 'PENDING' ? pendingTransfers : receivedTransfers;

  return (
    <div className="space-y-4">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-muted rounded-lg text-xs font-medium">
          <button
            type="button"
            onClick={() => setTab('PENDING')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
              tab === 'PENDING'
                ? 'bg-background shadow-xs text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            Pending Showroom Receive
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
              {pendingTransfers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTab('RECEIVED')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
              tab === 'RECEIVED'
                ? 'bg-background shadow-xs text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Received History
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
              {receivedTransfers.length}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transfer or warehouse…"
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Transfer #</th>
                <th className="px-4 py-3">Requisition #</th>
                <th className="px-4 py-3">From Warehouse</th>
                <th className="px-4 py-3">To Showroom</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {displayTransfers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    {tab === 'PENDING'
                      ? 'No incoming showroom transfers awaiting receipt.'
                      : 'No past received transfers found.'}
                  </td>
                </tr>
              )}
              {displayTransfers.map((row) => {
                const totalQty = row.items.reduce((s, it) => s + Number(it.quantity || 0), 0);

                return (
                  <tr key={row.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono font-medium">
                      <Link
                        href={`/warehouse/requisitions/${row.requisition.id}`}
                        className="text-primary hover:underline"
                      >
                        {row.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {row.requisition.number}
                    </td>
                    <td className="px-4 py-3 text-xs">{row.fromWarehouse.name}</td>
                    <td className="px-4 py-3 text-xs font-semibold">{row.toWarehouse.name}</td>
                    <td className="px-4 py-3 text-xs tabular-nums">
                      {row.items.length} items ({totalQty} units)
                    </td>
                    <td className="px-4 py-3">
                      <Pill tone={STATUS_TONE[row.status] ?? 'grey'}>
                        {row.status.replaceAll('_', ' ').toLowerCase()}
                      </Pill>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {['DISPATCHED', 'IN_TRANSIT'].includes(row.status) && (
                          <Button
                            size="sm"
                            variant="default"
                            className="h-8 text-xs font-medium cursor-pointer bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => openReceiveModal(row)}
                          >
                            <Inbox className="h-3 w-3 mr-1" />
                            Receive Stock
                          </Button>
                        )}

                        <Button size="sm" variant="ghost" asChild className="h-8 px-2">
                          <Link href={`/warehouse/requisitions/${row.requisition.id}`}>
                            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                          </Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* RECEIVE MODAL DIALOG */}
      {receivingTransfer && (
        <Dialog
          open={!!receivingTransfer}
          onOpenChange={(o) => !isPending && !o && setReceivingTransfer(null)}
        >
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleReceiveSubmit} className="space-y-4">
              <DialogHeader>
                <div className="flex items-center gap-2 text-emerald-600 mb-1">
                  <Inbox className="h-5 w-5" />
                  <DialogTitle>Confirm Showroom Stock Receipt</DialogTitle>
                </div>
                <DialogDescription className="text-xs text-muted-foreground">
                  Receive transfer{' '}
                  <span className="font-mono font-medium text-foreground">{receivingTransfer.number}</span>{' '}
                  from{' '}
                  <span className="font-medium text-foreground">{receivingTransfer.fromWarehouse.name}</span>{' '}
                  into{' '}
                  <span className="font-semibold text-foreground">{receivingTransfer.toWarehouse.name}</span>.
                </DialogDescription>
              </DialogHeader>

              {/* Quick Fill Button */}
              <div className="flex justify-between items-center py-1">
                <span className="text-xs font-semibold text-foreground">Items Inspection:</span>
                <button
                  type="button"
                  onClick={() => handleAutoFillAll(receivingTransfer)}
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="h-3 w-3" />
                  Accept All Dispatched Quantities
                </button>
              </div>

              {/* Items Table */}
              <div className="border rounded-md divide-y overflow-hidden">
                {receivingTransfer.items.map((it) => {
                  const row = itemRows.find((r) => r.itemId === it.id);
                  const rec = Number(row?.receivedQty || 0);
                  const dam = Number(row?.damagedQty || 0);
                  const mis = Number(row?.missingQty || 0);
                  const total = rec + dam + mis;
                  const expected = Number(it.quantity || 0);
                  const isBalanced = Math.abs(total - expected) < 0.0001;

                  return (
                    <div key={it.id} className="p-3 bg-card space-y-2">
                      <div className="flex justify-between items-start text-xs">
                        <div>
                          <p className="font-medium text-foreground">{it.productName}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">{it.sku}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] text-muted-foreground block">Dispatched</span>
                          <span className="font-bold tabular-nums text-foreground">
                            {it.quantity} {it.unit}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <div>
                          <Label className="text-[11px] text-emerald-700">Good / Received</Label>
                          <Input
                            type="number"
                            step="0.001"
                            min="0"
                            className="h-8 text-xs font-semibold text-emerald-700"
                            value={row?.receivedQty ?? ''}
                            onChange={(e) => handleItemChange(it.id, 'receivedQty', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] text-red-600">Damaged</Label>
                          <Input
                            type="number"
                            step="0.001"
                            min="0"
                            className="h-8 text-xs"
                            value={row?.damagedQty ?? '0'}
                            onChange={(e) => handleItemChange(it.id, 'damagedQty', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] text-amber-600">Missing</Label>
                          <Input
                            type="number"
                            step="0.001"
                            min="0"
                            className="h-8 text-xs"
                            value={row?.missingQty ?? '0'}
                            onChange={(e) => handleItemChange(it.id, 'missingQty', e.target.value)}
                          />
                        </div>
                      </div>

                      {!isBalanced && (
                        <p className="text-[11px] text-destructive flex items-center gap-1 font-medium">
                          <AlertCircle className="h-3 w-3" />
                          Sum ({total}) does not match dispatched quantity ({expected})
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Remarks */}
              <div className="space-y-1.5">
                <Label htmlFor="rcv-remarks" className="text-xs">
                  Receiving Remarks / Inspection Note
                </Label>
                <Textarea
                  id="rcv-remarks"
                  rows={2}
                  placeholder="e.g. Received in good condition with seal intact..."
                  value={receiveRemarks}
                  onChange={(e) => setReceiveRemarks(e.target.value)}
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => setReceivingTransfer(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      Receiving Stock...
                    </>
                  ) : (
                    'Confirm & Post Stock Receipt'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
