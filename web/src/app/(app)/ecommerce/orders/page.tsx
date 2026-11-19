import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/shared/data-table';
import { Pill, type PillTone } from '@/components/shared/pill';
import { backendFetch } from '@/lib/backend-client';
import { getSession } from '@/server/auth/session';
import { formatCurrency, type CurrencyCode } from '@/lib/money';
import {
  ShoppingBag,
  DollarSign,
  Truck,
  RotateCcw,
  Search,
  FilterX,
  ExternalLink,
} from 'lucide-react';
import { OrdersExportButton } from './orders-export-button';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'E-commerce Orders | Annex Leather' };

const STATUS_TONE: Record<string, PillTone> = {
  SYNCED: 'blue',
  PACKING: 'amber',
  PACKED: 'amber',
  SHIPPED: 'green',
  DELIVERED: 'green',
  CANCELLED: 'red',
  PARTIALLY_RETURNED: 'orange',
  RETURNED: 'red',
};

const STATUSES = [
  'ALL',
  'SYNCED',
  'PACKING',
  'PACKED',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'PARTIALLY_RETURNED',
  'RETURNED',
];

interface ChannelSummary {
  id: string;
  name: string;
  code: string;
}

interface OrderRow {
  id: string;
  number: string;
  externalId: string;
  orderDate: string;
  channel: { id: string; name: string; code: string };
  warehouse?: { id: string; code: string; name: string } | null;
  customerName: string | null;
  customerPhone: string | null;
  shipToAddress: string | null;
  items: unknown[];
  grandTotal: string;
  paidTotal: string;
  reconciledAmount?: string;
  currency: CurrencyCode;
  courier: string | null;
  trackingNo: string | null;
  status: string;
}

export default async function EcommerceOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    search?: string;
    channelId?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const session = await getSession();
  const sp = await searchParams;
  const branchId =
    session?.activeBranchId ??
    session?.defaultBranchId ??
    session?.allowedBranchIds?.[0];

  const qs = new URLSearchParams();
  if (sp.status && sp.status !== 'ALL') qs.set('status', sp.status);
  if (sp.search) qs.set('search', sp.search);
  if (sp.channelId && sp.channelId !== 'ALL') qs.set('channelId', sp.channelId);
  if (sp.from) qs.set('from', sp.from);
  if (sp.to) qs.set('to', sp.to);
  if (branchId) qs.set('branchId', branchId);

  const [orders, channels] = await Promise.all([
    backendFetch<OrderRow[]>(`/api/mobile/ecommerce/orders?${qs.toString()}`).catch(
      () => [] as OrderRow[],
    ),
    backendFetch<ChannelSummary[]>(
      `/api/mobile/ecommerce/channels${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ''}`,
    ).catch(() => [] as ChannelSummary[]),
  ]);

  const hasFilter = Boolean(
    sp.search ||
      (sp.status && sp.status !== 'ALL') ||
      (sp.channelId && sp.channelId !== 'ALL') ||
      sp.from ||
      sp.to,
  );

  // Calculate live financial summaries
  const totalVolume = orders.reduce((sum, o) => sum + (Number(o.grandTotal) || 0), 0);
  const totalPaid = orders.reduce((sum, o) => sum + (Number(o.paidTotal) || 0), 0);
  const pendingFulfillment = orders.filter((o) => ['SYNCED', 'PACKING', 'PACKED'].includes(o.status)).length;
  const returnCount = orders.filter((o) => ['PARTIALLY_RETURNED', 'RETURNED'].includes(o.status)).length;

  const exportData = orders.map((o) => ({
    id: o.id,
    number: o.number,
    externalId: o.externalId,
    orderDate: o.orderDate,
    channelName: o.channel?.name || 'Direct',
    customerName: o.customerName || 'Walk-in / Guest',
    customerPhone: o.customerPhone || '',
    shipToAddress: o.shipToAddress || '',
    grandTotal: o.grandTotal,
    paidTotal: o.paidTotal,
    status: o.status,
    courier: o.courier,
    trackingNo: o.trackingNo,
    itemCount: o.items?.length || 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <PageHeader
          title="Online Orders"
          description="Synced e-commerce orders, fulfillment workflows, and shipment tracking."
        />
        <div className="flex items-center gap-2">
          <OrdersExportButton orders={exportData} />
        </div>
      </div>

      {/* KPI Performance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Filtered Orders
            </p>
            <p className="text-2xl font-bold mt-1">{orders.length}</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <ShoppingBag className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Order Volume
            </p>
            <p className="text-2xl font-bold mt-1 text-primary">
              {formatCurrency(totalVolume, 'BDT')}
            </p>
          </div>
          <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
            <DollarSign className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Awaiting Dispatch
            </p>
            <p className="text-2xl font-bold mt-1 text-amber-600">{pendingFulfillment}</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
            <Truck className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Returns / Partial
            </p>
            <p className="text-2xl font-bold mt-1 text-red-600">{returnCount}</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-600">
            <RotateCcw className="h-5 w-5" />
          </div>
        </Card>
      </div>

      {/* Advanced Filter Bar */}
      <Card className="p-4 shadow-sm border">
        <form className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 items-end">
          <div className="sm:col-span-2 space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Search</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                name="search"
                className="pl-8 text-sm"
                placeholder="Order #, external ID, phone, customer..."
                defaultValue={sp.search ?? ''}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Channel</label>
            <select
              name="channelId"
              defaultValue={sp.channelId ?? 'ALL'}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
            >
              <option value="ALL">All Storefronts</option>
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Fulfillment Status</label>
            <select
              name="status"
              defaultValue={sp.status ?? 'ALL'}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.toLowerCase().replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">From Date</label>
            <Input type="date" name="from" defaultValue={sp.from ?? ''} className="text-sm" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">To Date</label>
            <Input type="date" name="to" defaultValue={sp.to ?? ''} className="text-sm" />
          </div>

          <div className="sm:col-span-2 md:col-span-6 flex justify-end gap-2 pt-1 border-t">
            {hasFilter && (
              <Button variant="ghost" size="sm" asChild className="gap-1 text-xs">
                <Link href="/ecommerce/orders">
                  <FilterX className="h-3.5 w-3.5" /> Clear Filters
                </Link>
              </Button>
            )}
            <Button size="sm" type="submit" className="gap-1.5 text-xs">
              <Search className="h-3.5 w-3.5" /> Apply Filters
            </Button>
          </div>
        </form>
      </Card>

      {/* Main Orders Table */}
      <Card className="p-0 overflow-hidden shadow-sm border">
        <div className="px-4 py-3 border-b text-sm font-medium flex items-center justify-between bg-muted/20">
          <span>
            Showing {orders.length} order{orders.length === 1 ? '' : 's'}
          </span>
          <span className="text-xs text-muted-foreground">
            Total Paid: <strong className="text-emerald-700">{formatCurrency(totalPaid, 'BDT')}</strong>
          </span>
        </div>

        <DataTable
          rows={orders}
          rowKey={(r) => r.id}
          empty="No e-commerce orders found matching the filter criteria."
          columns={[
            {
              key: 'number',
              header: 'Order #',
              cell: (r) => (
                <div className="flex flex-col">
                  <Link
                    href={`/ecommerce/orders/${r.id}`}
                    className="text-primary font-semibold hover:underline tabular text-sm flex items-center gap-1"
                  >
                    <span>{r.number}</span>
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </Link>
                  <span className="text-xs text-muted-foreground font-mono">
                    Ext: {r.externalId}
                  </span>
                </div>
              ),
            },
            {
              key: 'date',
              header: 'Date',
              cell: (r) => (
                <span className="tabular text-xs text-muted-foreground">
                  {new Date(r.orderDate).toISOString().slice(0, 10)}
                </span>
              ),
            },
            {
              key: 'channel',
              header: 'Channel',
              cell: (r) => (
                <span className="font-medium text-xs text-foreground bg-muted/50 px-2 py-0.5 rounded">
                  {r.channel?.name || 'Direct'}
                </span>
              ),
            },
            {
              key: 'customer',
              header: 'Customer Details',
              cell: (r) => (
                <div className="flex flex-col text-xs">
                  <span className="font-medium text-foreground">
                    {r.customerName || 'Walk-in / Guest'}
                  </span>
                  {r.customerPhone && (
                    <span className="text-muted-foreground tabular font-mono">
                      {r.customerPhone}
                    </span>
                  )}
                </div>
              ),
            },
            {
              key: 'items',
              header: 'Items',
              align: 'right',
              cell: (r) => <span className="tabular text-xs">{r.items?.length || 0}</span>,
            },
            {
              key: 'total',
              header: 'Grand Total',
              align: 'right',
              cell: (r) => (
                <span className="tabular font-semibold text-xs">
                  {formatCurrency(r.grandTotal, r.currency)}
                </span>
              ),
            },
            {
              key: 'paid',
              header: 'Paid / COD',
              align: 'right',
              cell: (r) => {
                const gTotal = Number(r.grandTotal) || 0;
                const pTotal = Number(r.paidTotal) || 0;
                const isCod = pTotal < gTotal;
                return (
                  <div className="flex flex-col items-end text-xs">
                    <span className="tabular text-emerald-700 font-medium">
                      {formatCurrency(pTotal, r.currency)}
                    </span>
                    {isCod && (
                      <span className="text-[10px] text-amber-600 font-mono">
                        COD: {formatCurrency(gTotal - pTotal, r.currency)}
                      </span>
                    )}
                  </div>
                );
              },
            },
            {
              key: 'courier',
              header: 'Logistics',
              cell: (r) => (
                <div className="flex flex-col text-xs">
                  <span className="font-medium">{r.courier || '—'}</span>
                  {r.trackingNo && (
                    <span className="text-[11px] font-mono text-muted-foreground">
                      #{r.trackingNo}
                    </span>
                  )}
                </div>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              cell: (r) => (
                <Pill tone={STATUS_TONE[r.status] ?? 'grey'}>
                  {r.status.toLowerCase().replace(/_/g, ' ')}
                </Pill>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
