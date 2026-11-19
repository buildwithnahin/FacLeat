'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Truck,
  Package,
  CheckCircle2,
  Clock,
  Eye,
  Send,
  Search,
  Loader2,
  AlertCircle,
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
import {
  createStockDispatchAction,
  updateStockTransferStatusAction,
} from '@/server/actions/stock-requisitions';

const STATUS_TONE: Record<string, PillTone> = {
  WAREHOUSE_ASSIGNED: 'blue',
  PICKING: 'amber',
  PACKED: 'amber',
  DISPATCHED: 'blue',
  IN_TRANSIT: 'blue',
  RECEIVED: 'green',
  COMPLETED: 'grey',
};

export interface DispatchQueueItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  requestedQty: string;
  approvedQty: string;
  dispatchedQty: string;
  receivedQty: string;
}

export interface DispatchQueueTransfer {
  id: string;
  number: string;
  status: string;
  vehicle: string | null;
  driverName: string | null;
  driverPhone: string | null;
  gatePassNo: string | null;
  trackingNo: string | null;
  updatedAt: string;
}

export interface DispatchQueueRow {
  id: string;
  number: string;
  status: string;
  priority?: string;
  requiredDate: string;
  showroomWarehouse: { name: string; code: string };
  sourceWarehouse: { name: string; code: string } | null;
  items: DispatchQueueItem[];
  transfers: DispatchQueueTransfer[];
}

export function DispatchQueueClient({ rows }: { rows: DispatchQueueRow[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<'PENDING' | 'IN_TRANSIT' | 'COMPLETED'>('PENDING');
  const [search, setSearch] = useState('');
  const [isPending, startTransition] = useTransition();

  // Dispatch Modal state
  const [dispatchModalRow, setDispatchModalRow] = useState<DispatchQueueRow | null>(null);
  const [expectedDate, setExpectedDate] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [gatePassNo, setGatePassNo] = useState('');
  const [trackingNo, setTrackingNo] = useState('');
  const [remarks, setRemarks] = useState('');

  // Workflow status quick action (e.g. mark packed, mark dispatched)
  function handleQuickStatus(transferId: string, nextStatus: 'PACKED' | 'DISPATCHED' | 'IN_TRANSIT') {
    startTransition(async () => {
      const formData = new FormData();
      formData.set('transferId', transferId);
      formData.set('status', nextStatus);
      formData.set('dispatchNote', `Quick update to ${nextStatus}`);

      const res = await updateStockTransferStatusAction(undefined, formData);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(`Transfer status updated to ${nextStatus}`);
        router.refresh();
      }
    });
  }

  // Handle Full Dispatch Submit
  function handleDispatchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dispatchModalRow) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.set('requisitionId', dispatchModalRow.id);
      if (expectedDate) formData.set('expectedDate', expectedDate);
      if (vehicle) formData.set('vehicle', vehicle);
      if (driverName) formData.set('driverName', driverName);
      if (driverPhone) formData.set('driverPhone', driverPhone);
      if (gatePassNo) formData.set('gatePassNo', gatePassNo);
      if (trackingNo) formData.set('trackingNo', trackingNo);
      if (remarks) formData.set('remarks', remarks);

      // Remaining items to dispatch
      const dispatchItems = dispatchModalRow.items.map((it) => {
        const remaining = Math.max(0, Number(it.approvedQty) - Number(it.dispatchedQty));
        return {
          requisitionItemId: it.id,
          productId: it.productId,
          quantity: remaining.toString(),
          note: '',
        };
      });

      formData.set('itemsJson', JSON.stringify(dispatchItems));

      const res = await createStockDispatchAction(undefined, formData);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(`Dispatch created for ${dispatchModalRow.number}`);
        setDispatchModalRow(null);
        router.refresh();
      }
    });
  }

  // Filter rows by search
  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      r.number.toLowerCase().includes(q) ||
      r.showroomWarehouse.name.toLowerCase().includes(q) ||
      r.showroomWarehouse.code.toLowerCase().includes(q) ||
      (r.sourceWarehouse && r.sourceWarehouse.name.toLowerCase().includes(q))
    );
  });

  const pendingRows = filtered.filter((r) =>
    ['WAREHOUSE_ASSIGNED', 'PICKING', 'PACKED'].includes(r.status),
  );
  const inTransitRows = filtered.filter((r) =>
    ['DISPATCHED', 'IN_TRANSIT'].includes(r.status),
  );
  const completedRows = filtered.filter((r) =>
    ['RECEIVED', 'COMPLETED'].includes(r.status),
  );

  const currentDisplayRows =
    tab === 'PENDING' ? pendingRows : tab === 'IN_TRANSIT' ? inTransitRows : completedRows;

  return (
    <div className="space-y-4">
      {/* Top Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Navigation Tabs */}
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
            Awaiting Dispatch
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
              {pendingRows.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTab('IN_TRANSIT')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
              tab === 'IN_TRANSIT'
                ? 'bg-background shadow-xs text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Truck className="h-3.5 w-3.5" />
            In-Transit / On Truck
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
              {inTransitRows.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTab('COMPLETED')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
              tab === 'COMPLETED'
                ? 'bg-background shadow-xs text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Completed Deliveries
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
              {completedRows.length}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search requisition or showroom…"
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
                <th className="px-4 py-3">Requisition #</th>
                <th className="px-4 py-3">Destination Showroom</th>
                <th className="px-4 py-3">Source Warehouse</th>
                <th className="px-4 py-3">Items Summary</th>
                <th className="px-4 py-3">Required Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Dispatch Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {currentDisplayRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    {tab === 'PENDING'
                      ? 'No dispatch work queued. All showroom requisitions are fulfilled.'
                      : tab === 'IN_TRANSIT'
                      ? 'No shipments currently in-transit on truck.'
                      : 'No completed transfers found.'}
                  </td>
                </tr>
              )}
              {currentDisplayRows.map((row) => {
                const latestTransfer = row.transfers[0];
                const totalReqQty = row.items.reduce((s, it) => s + Number(it.requestedQty || 0), 0);
                const totalAppQty = row.items.reduce((s, it) => s + Number(it.approvedQty || 0), 0);
                const totalDispQty = row.items.reduce((s, it) => s + Number(it.dispatchedQty || 0), 0);
                const pendingDispQty = Math.max(0, totalAppQty - totalDispQty);

                return (
                  <tr key={row.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono font-medium">
                      <Link
                        href={`/warehouse/requisitions/${row.id}`}
                        className="text-primary hover:underline"
                      >
                        {row.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {row.showroomWarehouse.name}
                      <span className="text-xs text-muted-foreground block font-normal">
                        Code: {row.showroomWarehouse.code}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {row.sourceWarehouse?.name ?? 'Not assigned'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold tabular-nums">
                        {row.items.length} items ({totalAppQty > 0 ? totalAppQty : totalReqQty} units)
                      </span>
                      {pendingDispQty > 0 && row.status !== 'WAREHOUSE_ASSIGNED' && (
                        <span className="text-[11px] text-amber-600 block tabular-nums">
                          {pendingDispQty} units to dispatch
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums">
                      {new Date(row.requiredDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Pill tone={STATUS_TONE[row.status] ?? 'grey'}>
                        {row.status.replaceAll('_', ' ').toLowerCase()}
                      </Pill>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {row.status === 'WAREHOUSE_ASSIGNED' && (
                          <Button
                            size="sm"
                            variant="default"
                            className="h-8 text-xs font-medium cursor-pointer"
                            onClick={() => {
                              setDispatchModalRow(row);
                              setExpectedDate(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
                            }}
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Dispatch Goods
                          </Button>
                        )}

                        {row.status === 'PICKING' && latestTransfer && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs font-medium cursor-pointer text-amber-700 border-amber-300 hover:bg-amber-50"
                            disabled={isPending}
                            onClick={() => handleQuickStatus(latestTransfer.id, 'PACKED')}
                          >
                            <Package className="h-3 w-3 mr-1" />
                            Mark Packed
                          </Button>
                        )}

                        {row.status === 'PACKED' && latestTransfer && (
                          <Button
                            size="sm"
                            variant="default"
                            className="h-8 text-xs font-medium cursor-pointer bg-blue-600 hover:bg-blue-700"
                            disabled={isPending}
                            onClick={() => handleQuickStatus(latestTransfer.id, 'DISPATCHED')}
                          >
                            <Truck className="h-3 w-3 mr-1" />
                            Dispatch Truck
                          </Button>
                        )}

                        {row.status === 'DISPATCHED' && latestTransfer && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs font-medium cursor-pointer text-blue-700 border-blue-300 hover:bg-blue-50"
                            disabled={isPending}
                            onClick={() => handleQuickStatus(latestTransfer.id, 'IN_TRANSIT')}
                          >
                            <Truck className="h-3 w-3 mr-1" />
                            In Transit
                          </Button>
                        )}

                        <Button size="sm" variant="ghost" asChild className="h-8 px-2">
                          <Link href={`/warehouse/requisitions/${row.id}`}>
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

      {/* DISPATCH MODAL DIALOG */}
      {dispatchModalRow && (
        <Dialog open={!!dispatchModalRow} onOpenChange={(o) => !isPending && !o && setDispatchModalRow(null)}>
          <DialogContent className="sm:max-w-lg">
            <form onSubmit={handleDispatchSubmit} className="space-y-4">
              <DialogHeader>
                <div className="flex items-center gap-2 text-primary mb-1">
                  <Truck className="h-5 w-5" />
                  <DialogTitle>Dispatch Showroom Goods</DialogTitle>
                </div>
                <DialogDescription className="text-xs text-muted-foreground">
                  Dispatching for requisition{' '}
                  <span className="font-mono font-medium text-foreground">{dispatchModalRow.number}</span> to{' '}
                  <span className="font-semibold text-foreground">{dispatchModalRow.showroomWarehouse.name}</span>.
                </DialogDescription>
              </DialogHeader>

              {/* Items Preview */}
              <div className="border rounded-md p-3 bg-muted/40 max-h-36 overflow-y-auto text-xs space-y-1.5">
                <span className="font-semibold text-foreground block mb-1">Items to Dispatch:</span>
                {dispatchModalRow.items.map((it) => {
                  const rem = Math.max(0, Number(it.approvedQty) - Number(it.dispatchedQty));
                  return (
                    <div key={it.id} className="flex justify-between items-center text-muted-foreground">
                      <span>{it.productName} ({it.sku})</span>
                      <span className="font-bold text-foreground tabular-nums">
                        {rem} {it.unit}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="d-date" className="text-xs">Expected Arrival Date</Label>
                  <Input
                    id="d-date"
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="d-vehicle" className="text-xs">Vehicle / Transport</Label>
                  <Input
                    id="d-vehicle"
                    placeholder="e.g. Pickup Truck DHAKA-11-2345"
                    value={vehicle}
                    onChange={(e) => setVehicle(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="d-driver" className="text-xs">Driver Name</Label>
                  <Input
                    id="d-driver"
                    placeholder="Driver's full name"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="d-phone" className="text-xs">Driver Contact</Label>
                  <Input
                    id="d-phone"
                    placeholder="017XXXXXXXX"
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="d-gate" className="text-xs">Gate Pass #</Label>
                  <Input
                    id="d-gate"
                    placeholder="GP-2026-001"
                    value={gatePassNo}
                    onChange={(e) => setGatePassNo(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="d-track" className="text-xs">Challan / Tracking #</Label>
                  <Input
                    id="d-track"
                    placeholder="CH-8872"
                    value={trackingNo}
                    onChange={(e) => setTrackingNo(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="d-remarks" className="text-xs">Dispatch Remarks</Label>
                <Textarea
                  id="d-remarks"
                  rows={2}
                  placeholder="Special instructions, handling terms..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => setDispatchModalRow(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      Creating Dispatch...
                    </>
                  ) : (
                    'Confirm & Create Dispatch'
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
