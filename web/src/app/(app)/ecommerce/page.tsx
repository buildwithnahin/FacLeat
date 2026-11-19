import Link from 'next/link';
import {
  PackageOpen,
  Truck,
  RotateCcw,
  AlertTriangle,
  Boxes,
  ArrowRight,
  Store,
  ExternalLink,
  PlusCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { KpiCard } from '@/components/shared/kpi-card';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pill, type PillTone } from '@/components/shared/pill';
import { Badge } from '@/components/ui/badge';
import { backendFetch } from '@/lib/backend-client';
import { getSession } from '@/server/auth/session';
import { formatCurrency, type CurrencyCode } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'E-commerce & Online Sales | Annex Leather' };

interface DashboardStats {
  open: number;
  packed: number;
  shipped: number;
  returns: number;
  unreconciled: number;
}

interface RecentOrder {
  id: string;
  number: string;
  externalId: string;
  orderDate: string;
  channel: { name: string; type: string };
  customerName: string | null;
  grandTotal: string;
  paidTotal: string;
  currency: CurrencyCode;
  status: string;
  courier?: string | null;
}

interface ChannelItem {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
}

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

export default async function EcommerceOverviewPage() {
  const session = await getSession();
  const branchId =
    session?.activeBranchId ??
    session?.defaultBranchId ??
    session?.allowedBranchIds?.[0] ??
    undefined;
  const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';

  const [stats, orders, channels] = await Promise.all([
    backendFetch<DashboardStats>(`/api/mobile/ecommerce/dashboard${query}`).catch(() => ({
      open: 0,
      packed: 0,
      shipped: 0,
      returns: 0,
      unreconciled: 0,
    })),
    backendFetch<RecentOrder[]>(`/api/mobile/ecommerce/orders${query}`).catch(
      () => [] as RecentOrder[],
    ),
    backendFetch<ChannelItem[]>(`/api/mobile/ecommerce/channels${query}`).catch(
      () => [] as ChannelItem[],
    ),
  ]);

  const recentOrders = orders.slice(0, 7);
  const activeChannels = channels.filter((c) => c.isActive);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <PageHeader
          title="E-commerce & Online Sales"
          description="Omnichannel order sync, warehouse fulfillment, courier dispatch, and COD payment reconciliation."
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/ecommerce/channels" className="gap-1.5">
              <Store className="h-4 w-4" /> Channels ({activeChannels.length})
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/ecommerce/reconcile" className="gap-1.5">
              <FileSpreadsheet className="h-4 w-4" /> Courier Reconcile
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/ecommerce/orders" className="gap-1.5">
              All Orders <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Performance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard
          label="Awaiting Pack"
          value={stats.open}
          icon={Boxes}
          tone="primary"
          description="Synced & packing queue"
        />
        <KpiCard
          label="Ready Packed"
          value={stats.packed}
          icon={PackageOpen}
          tone="warning"
          description="Awaiting courier pickup"
        />
        <KpiCard
          label="Shipped / Done"
          value={stats.shipped}
          icon={Truck}
          tone="success"
          description="In-transit or delivered"
        />
        <KpiCard
          label="Returns / Claims"
          value={stats.returns}
          icon={RotateCcw}
          tone={stats.returns > 0 ? 'danger' : 'default'}
          description="Damaged or returned items"
        />
        <KpiCard
          label="Unreconciled"
          value={stats.unreconciled}
          icon={AlertTriangle}
          tone={stats.unreconciled > 0 ? 'warning' : 'default'}
          description="Awaiting courier COD settlement"
        />
      </div>

      {/* Connected Channel Quick Status */}
      {channels.length > 0 && (
        <Card className="p-4 bg-muted/20 border">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs">
              <Store className="h-4 w-4 text-primary shrink-0" />
              <span className="font-semibold text-foreground">Connected Storefronts:</span>
              <div className="flex flex-wrap gap-1.5 items-center">
                {channels.map((ch) => (
                  <Badge
                    key={ch.id}
                    variant={ch.isActive ? 'secondary' : 'outline'}
                    className="text-[11px] font-normal"
                  >
                    {ch.name} ({ch.type})
                  </Badge>
                ))}
              </div>
            </div>
            <Link
              href="/ecommerce/channels"
              className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1 shrink-0"
            >
              <span>Manage Storefronts</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </Card>
      )}

      {/* Operations Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 flex flex-col justify-between hover:border-primary/40 transition-colors shadow-sm">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Storefronts & Sync
            </div>
            <h3 className="text-base font-semibold mt-1 text-foreground">Sales Channels</h3>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Connect and manage Shopify, WooCommerce, Facebook Shops, Daraz, or offline storefronts.
            </p>
          </div>
          <Button variant="outline" size="sm" className="mt-4 justify-between" asChild>
            <Link href="/ecommerce/channels">
              <span>Configure Channels</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </Card>

        <Card className="p-5 flex flex-col justify-between hover:border-primary/40 transition-colors shadow-sm">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Warehouse Operations
            </div>
            <h3 className="text-base font-semibold mt-1 text-foreground">Packing & Dispatch</h3>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Pack customer orders, print delivery challans, and assign tracking for courier handoff.
            </p>
          </div>
          <Button variant="outline" size="sm" className="mt-4 justify-between" asChild>
            <Link href="/ecommerce/orders">
              <span>Fulfill Orders</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </Card>

        <Card className="p-5 flex flex-col justify-between hover:border-primary/40 transition-colors shadow-sm">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Finance & Logistics
            </div>
            <h3 className="text-base font-semibold mt-1 text-foreground">COD Reconciliation</h3>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Import courier remittance statements, audit deductions, and mark customer balances settled.
            </p>
          </div>
          <Button variant="outline" size="sm" className="mt-4 justify-between" asChild>
            <Link href="/ecommerce/reconcile">
              <span>Reconcile Settlements</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </Card>
      </div>

      {/* Recent Orders Preview */}
      <Card className="p-0 overflow-hidden shadow-sm border">
        <div className="px-5 py-3.5 border-b flex items-center justify-between bg-muted/20">
          <div>
            <h3 className="font-semibold text-sm">Recent Synced Orders</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Latest orders received across all online channels.
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild className="text-xs gap-1">
            <Link href="/ecommerce/orders">
              View all {orders.length} orders <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {recentOrders.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            <Boxes className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p>No online orders received yet.</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sync orders from your e-commerce channels or connect a new storefront.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs uppercase font-medium border-b">
                <tr>
                  <th className="px-5 py-3">Order #</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Channel</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3 text-right">Order Value</th>
                  <th className="px-5 py-3 text-right">Paid</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-semibold">
                      <Link
                        href={`/ecommerce/orders/${ord.id}`}
                        className="text-primary hover:underline tabular text-xs"
                      >
                        {ord.number}
                      </Link>
                      <span className="block text-[10px] text-muted-foreground font-mono">
                        {ord.externalId}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground tabular">
                      {new Date(ord.orderDate).toISOString().slice(0, 10)}
                    </td>
                    <td className="px-5 py-3 text-xs font-medium">
                      {ord.channel?.name || 'Direct'}
                    </td>
                    <td className="px-5 py-3 text-xs text-foreground font-medium">
                      {ord.customerName || 'Walk-in / Guest'}
                    </td>
                    <td className="px-5 py-3 text-right tabular text-xs font-semibold">
                      {formatCurrency(ord.grandTotal, ord.currency)}
                    </td>
                    <td className="px-5 py-3 text-right tabular text-xs text-emerald-700 font-medium">
                      {formatCurrency(ord.paidTotal, ord.currency)}
                    </td>
                    <td className="px-5 py-3">
                      <Pill tone={STATUS_TONE[ord.status] ?? 'grey'}>
                        {ord.status.toLowerCase().replace(/_/g, ' ')}
                      </Pill>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
                        <Link href={`/ecommerce/orders/${ord.id}`}>
                          <span>Details</span>
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
