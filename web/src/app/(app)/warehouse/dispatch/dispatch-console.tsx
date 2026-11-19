'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pill, type PillTone } from '@/components/shared/pill';
import { ChevronDown, ChevronUp, Edit2, Plus, Truck } from 'lucide-react';
import {
  recordCorporateDeliveryAction,
  updateCorporateDeliveryWorkflowAction,
} from '@/server/actions/corporate-sales';

type OrderItem = {
  id: string;
  productName: string;
  sku: string;
  orderedQty: number;
  remainingQty: number;
};

type DispatchOrder = {
  id: string;
  number: string;
  customerName: string;
  warehouseId: string;
  warehouseName: string;
  deliveryAddress: string;
  items: OrderItem[];
};

type DeliveryItem = {
  id: string;
  productName: string;
  sku: string;
  quantity: string;
};

type DeliveryRow = {
  id: string;
  number: string;
  status: string;
  orderNumber: string;
  customerName: string;
  warehouseName: string;
  expectedDate: string;
  trackingNo: string;
  gatePassNo: string;
  transportCompany: string;
  vehicleNo: string;
  driverName: string;
  driverPhone: string;
  notes: string;
  createdAt: string;
  items: DeliveryItem[];
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  APPROVED: 'Approved',
  PICKING: 'Picking',
  PACKED: 'Packed',
  DISPATCHED: 'Dispatched',
  DELIVERED: 'Delivered',
  CLOSED: 'Closed',
  VOIDED: 'Voided',
};

const STATUS_TONES: Record<string, PillTone> = {
  DRAFT: 'grey',
  APPROVED: 'blue',
  PICKING: 'orange',
  PACKED: 'amber',
  DISPATCHED: 'blue',
  DELIVERED: 'green',
  CLOSED: 'neutral',
  VOIDED: 'red',
};

const NEXT_STATUS: Record<string, { status: string; label: string } | undefined> = {
  DRAFT: { status: 'APPROVED', label: 'Approve' },
  APPROVED: { status: 'PICKING', label: 'Start Picking' },
  PICKING: { status: 'PACKED', label: 'Mark Packed' },
  PACKED: { status: 'DISPATCHED', label: 'Dispatch' },
  DISPATCHED: { status: 'DELIVERED', label: 'Mark Delivered' },
  DELIVERED: { status: 'CLOSED', label: 'Close' },
};

export function DispatchConsole({
  orders,
  deliveries,
}: {
  orders: DispatchOrder[];
  deliveries: DeliveryRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [statusPending, startStatusTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Form toggle state: default open if no deliveries, otherwise collapsible
  const [showCreateForm, setShowCreateForm] = useState(deliveries.length === 0);

  // Status filter tab
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Track which delivery cards have their editable details expanded
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});

  const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id ?? '');
  const [expectedDate, setExpectedDate] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState(orders[0]?.deliveryAddress ?? '');
  const [trackingNo, setTrackingNo] = useState('');
  const [transportCompany, setTransportCompany] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [gatePassNo, setGatePassNo] = useState('');
  const [notes, setNotes] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [workflowFields, setWorkflowFields] = useState<
    Record<
      string,
      {
        trackingNo: string;
        gatePassNo: string;
        transportCompany: string;
        vehicleNo: string;
        driverName: string;
        driverPhone: string;
        customerSignature: string;
        podAttachment: string;
        notes: string;
      }
    >
  >({});

  // Deduplicate deliveries by ID to guard against any duplicate data
  const uniqueDeliveries = useMemo(() => {
    const seen = new Set<string>();
    return deliveries.filter((d) => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });
  }, [deliveries]);

  // Filter deliveries based on active tab
  const filteredDeliveries = useMemo(() => {
    if (statusFilter === 'ALL') return uniqueDeliveries;
    if (statusFilter === 'ACTIVE') {
      return uniqueDeliveries.filter((d) => !['CLOSED', 'VOIDED'].includes(d.status));
    }
    return uniqueDeliveries.filter((d) => d.status === statusFilter);
  }, [uniqueDeliveries, statusFilter]);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  );

  function toggleEdit(deliveryId: string) {
    setExpandedDetails((prev) => ({
      ...prev,
      [deliveryId]: !prev[deliveryId],
    }));
  }

  function updateSelectedOrder(orderId: string) {
    setSelectedOrderId(orderId);
    const next = orders.find((order) => order.id === orderId);
    setDeliveryAddress(next?.deliveryAddress ?? '');
    setQuantities({});
  }

  function createDispatch() {
    if (!selectedOrder) {
      setMessage({ type: 'err', text: 'Select a production-ready sales order first.' });
      return;
    }

    const items = selectedOrder.items
      .map((item) => ({
        orderItemId: item.id,
        quantity: Number(quantities[item.id] ?? 0),
      }))
      .filter((item) => item.quantity > 0);

    if (items.length === 0) {
      setMessage({ type: 'err', text: 'Enter at least one dispatch quantity.' });
      return;
    }

    for (const item of items) {
      const orderItem = selectedOrder.items.find((o) => o.id === item.orderItemId);
      if (orderItem && item.quantity > orderItem.remainingQty) {
        setMessage({
          type: 'err',
          text: `Quantity for ${orderItem.productName} cannot exceed remaining (${orderItem.remainingQty}).`,
        });
        return;
      }
    }

    startTransition(async () => {
      const res = await recordCorporateDeliveryAction({
        orderId: selectedOrder.id,
        warehouseId: selectedOrder.warehouseId,
        expectedDate: expectedDate || undefined,
        deliveryAddress: deliveryAddress || undefined,
        trackingNo: trackingNo || undefined,
        transportCompany: transportCompany || undefined,
        vehicleNo: vehicleNo || undefined,
        driverName: driverName || undefined,
        driverPhone: driverPhone || undefined,
        gatePassNo: gatePassNo || undefined,
        notes: notes || undefined,
        items,
      });
      if (!('success' in res) || !res.success) {
        setMessage({
          type: 'err',
          text: 'error' in res && res.error ? res.error : 'Failed to create dispatch challan.',
        });
        return;
      }
      setMessage({ type: 'ok', text: `Dispatch challan ${res.deliveryNumber} created.` });
      setExpectedDate('');
      setTrackingNo('');
      setTransportCompany('');
      setVehicleNo('');
      setDriverName('');
      setDriverPhone('');
      setGatePassNo('');
      setNotes('');
      setQuantities({});
      setShowCreateForm(false);
      router.refresh();
    });
  }

  function runWorkflow(deliveryId: string, status: string) {
    const fields = workflowFields[deliveryId] ?? {
      trackingNo: '',
      gatePassNo: '',
      transportCompany: '',
      vehicleNo: '',
      driverName: '',
      driverPhone: '',
      customerSignature: '',
      podAttachment: '',
      notes: '',
    };

    startStatusTransition(async () => {
      const res = await updateCorporateDeliveryWorkflowAction({
        deliveryId,
        status,
        ...fields,
      });
      if (res && 'error' in res && res.error) {
        setMessage({ type: 'err', text: res.error });
        return;
      }
      setMessage({ type: 'ok', text: `Delivery moved to ${status.toLowerCase()}.` });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Create Delivery / Dispatch Challan Section */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Create delivery / dispatch challan</div>
            <div className="text-xs text-muted-foreground">
              Select an approved order to generate a new dispatch challan and deduct warehouse stock.
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreateForm((prev) => !prev)}
            className="gap-1.5"
          >
            {showCreateForm ? (
              <>
                <ChevronUp className="h-4 w-4" /> Hide form
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> New challan
              </>
            )}
          </Button>
        </div>

        {showCreateForm && (
          <div className="pt-2 border-t space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Sales order</Label>
                <select
                  value={selectedOrderId}
                  onChange={(e) => updateSelectedOrder(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="">Select order</option>
                  {orders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.number} · {order.customerName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Warehouse</Label>
                <Input value={selectedOrder?.warehouseName ?? ''} disabled />
              </div>
              <div className="space-y-2">
                <Label>Expected delivery date</Label>
                <Input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Tracking no</Label>
                <Input value={trackingNo} onChange={(e) => setTrackingNo(e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Delivery address</Label>
                <Input
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Transport company</Label>
                <Input
                  value={transportCompany}
                  onChange={(e) => setTransportCompany(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Gate pass no</Label>
                <Input value={gatePassNo} onChange={(e) => setGatePassNo(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Vehicle no</Label>
                <Input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Driver name</Label>
                <Input value={driverName} onChange={(e) => setDriverName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Driver phone</Label>
                <Input value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Dispatch quantities</div>
              {selectedOrder?.items.length ? (
                <div className="space-y-2">
                  {selectedOrder.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-lg border p-3 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{item.productName}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.sku} · ordered {item.orderedQty} · remaining {item.remainingQty}
                        </div>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        max={item.remainingQty}
                        step="any"
                        className="w-28 text-right"
                        value={quantities[item.id] ?? ''}
                        onChange={(e) =>
                          setQuantities((prev) => ({
                            ...prev,
                            [item.id]: Number(e.target.value),
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
                  No deliverable sales orders found.
                </div>
              )}
            </div>

            <Button variant="dark" disabled={pending || !selectedOrder} onClick={createDispatch}>
              {pending ? 'Saving…' : 'Create challan'}
            </Button>
          </div>
        )}
      </Card>

      {/* Dispatch Workflow Board */}
      <Card className="p-0">
        <div className="border-b px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Dispatch workflow board</span>
            <span className="text-xs text-muted-foreground">
              ({uniqueDeliveries.length} total)
            </span>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {[
              { key: 'ALL', label: 'All' },
              { key: 'ACTIVE', label: 'Active' },
              { key: 'PICKING', label: 'Picking' },
              { key: 'PACKED', label: 'Packed' },
              { key: 'DISPATCHED', label: 'Dispatched' },
              { key: 'DELIVERED', label: 'Delivered' },
              { key: 'CLOSED', label: 'Closed' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === tab.key
                    ? 'bg-neutral-900 text-white font-medium'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4 p-4">
          {filteredDeliveries.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              {statusFilter === 'ALL'
                ? 'No dispatch challans yet.'
                : `No dispatch challans found with status "${statusFilter.toLowerCase()}".`}
            </div>
          ) : (
            filteredDeliveries.map((delivery) => {
              const next = NEXT_STATUS[delivery.status];
              const isExpanded = expandedDetails[delivery.id] ?? false;
              const fields = workflowFields[delivery.id] ?? {
                trackingNo: delivery.trackingNo,
                gatePassNo: delivery.gatePassNo,
                transportCompany: delivery.transportCompany,
                vehicleNo: delivery.vehicleNo,
                driverName: delivery.driverName,
                driverPhone: delivery.driverPhone,
                customerSignature: '',
                podAttachment: '',
                notes: delivery.notes,
              };

              return (
                <div key={delivery.id} className="rounded-xl border p-4 space-y-3 bg-card">
                  {/* Delivery Header */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{delivery.number}</span>
                        <Pill tone={STATUS_TONES[delivery.status] ?? 'grey'}>
                          {STATUS_LABELS[delivery.status] ?? delivery.status}
                        </Pill>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Order <span className="font-medium text-foreground">{delivery.orderNumber}</span> · {delivery.customerName} · {delivery.warehouseName}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Created {delivery.createdAt}
                      {delivery.expectedDate ? ` · ETA ${delivery.expectedDate}` : ''}
                    </div>
                  </div>

                  {/* Clean Read-Only Summary Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-xs bg-muted/30 p-3 rounded-lg">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Carrier</span>
                      <span className="font-medium">{fields.transportCompany || '—'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Vehicle #</span>
                      <span className="font-medium">{fields.vehicleNo || '—'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Driver</span>
                      <span className="font-medium">
                        {fields.driverName
                          ? `${fields.driverName} ${fields.driverPhone ? `(${fields.driverPhone})` : ''}`
                          : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Gate Pass #</span>
                      <span className="font-medium">{fields.gatePassNo || '—'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Tracking #</span>
                      <span className="font-medium">{fields.trackingNo || '—'}</span>
                    </div>
                    {fields.notes ? (
                      <div className="col-span-2 sm:col-span-3">
                        <span className="text-muted-foreground block text-[11px]">Notes</span>
                        <span className="truncate block">{fields.notes}</span>
                      </div>
                    ) : null}
                  </div>

                  {/* Items List */}
                  <div className="rounded-lg bg-muted/20 px-3 py-2 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                    <span className="font-medium text-foreground">Items:</span>
                    {delivery.items.map((item) => (
                      <span key={item.id} className="tabular">
                        {item.productName} ({item.sku}) × <strong className="text-foreground">{item.quantity}</strong>
                      </span>
                    ))}
                  </div>

                  {/* Expandable Edit Details Form (Hidden by default to eliminate repetitive form clutter) */}
                  {isExpanded && (
                    <div className="pt-3 border-t space-y-3">
                      <div className="text-xs font-semibold text-muted-foreground">
                        Update Challan & Carrier Information
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Tracking no</Label>
                          <Input
                            className="h-8 text-xs"
                            value={fields.trackingNo}
                            onChange={(e) =>
                              setWorkflowFields((prev) => ({
                                ...prev,
                                [delivery.id]: { ...fields, trackingNo: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Gate pass no</Label>
                          <Input
                            className="h-8 text-xs"
                            value={fields.gatePassNo}
                            onChange={(e) =>
                              setWorkflowFields((prev) => ({
                                ...prev,
                                [delivery.id]: { ...fields, gatePassNo: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Transport company</Label>
                          <Input
                            className="h-8 text-xs"
                            value={fields.transportCompany}
                            onChange={(e) =>
                              setWorkflowFields((prev) => ({
                                ...prev,
                                [delivery.id]: { ...fields, transportCompany: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Vehicle no</Label>
                          <Input
                            className="h-8 text-xs"
                            value={fields.vehicleNo}
                            onChange={(e) =>
                              setWorkflowFields((prev) => ({
                                ...prev,
                                [delivery.id]: { ...fields, vehicleNo: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Driver name</Label>
                          <Input
                            className="h-8 text-xs"
                            value={fields.driverName}
                            onChange={(e) =>
                              setWorkflowFields((prev) => ({
                                ...prev,
                                [delivery.id]: { ...fields, driverName: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Driver phone</Label>
                          <Input
                            className="h-8 text-xs"
                            value={fields.driverPhone}
                            onChange={(e) =>
                              setWorkflowFields((prev) => ({
                                ...prev,
                                [delivery.id]: { ...fields, driverPhone: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Customer signature</Label>
                          <Input
                            className="h-8 text-xs"
                            value={fields.customerSignature}
                            onChange={(e) =>
                              setWorkflowFields((prev) => ({
                                ...prev,
                                [delivery.id]: { ...fields, customerSignature: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">POD attachment</Label>
                          <Input
                            className="h-8 text-xs"
                            value={fields.podAttachment}
                            onChange={(e) =>
                              setWorkflowFields((prev) => ({
                                ...prev,
                                [delivery.id]: { ...fields, podAttachment: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Notes</Label>
                          <Input
                            className="h-8 text-xs"
                            value={fields.notes}
                            onChange={(e) =>
                              setWorkflowFields((prev) => ({
                                ...prev,
                                [delivery.id]: { ...fields, notes: e.target.value },
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleEdit(delivery.id)}
                      className="text-xs text-muted-foreground gap-1.5 h-8 px-2"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      {isExpanded ? 'Hide details' : 'Edit details'}
                    </Button>

                    <div className="flex items-center gap-2">
                      {next ? (
                        <Button
                          size="sm"
                          disabled={statusPending}
                          onClick={() => runWorkflow(delivery.id, next.status)}
                          className="h-8 text-xs"
                        >
                          {statusPending ? 'Saving…' : next.label}
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" disabled className="h-8 text-xs">
                          Workflow complete
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {message ? (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            message.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      ) : null}
    </div>
  );
}
