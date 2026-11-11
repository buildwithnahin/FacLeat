import Link from 'next/link';
import { PackageOpen, Truck, RotateCcw, AlertTriangle, Boxes } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { KpiCard } from '@/components/shared/kpi-card';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { backendFetch } from '@/lib/backend-client';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'E-commerce' };

interface DashboardStats {
  open: number;
  packed: number;
  shipped: number;
  returns: number;
  unreconciled: number;
}

export default async function EcommerceOverviewPage() {
  const stats = await backendFetch<DashboardStats>('/api/mobile/ecommerce/dashboard');

  return (
    <div className="space-y-6">
      <PageHeader
        title="E-commerce / Online Sales"
        description="Order sync, fulfillment, shipment tracking & reconciliation."
      >
        <Button variant="outline" asChild>
          <Link href="/ecommerce/channels">Channels</Link>
        </Button>
        <Button variant="dark" asChild>
          <Link href="/ecommerce/orders">All orders</Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <KpiCard label="Open" value={stats.open} icon={Boxes} tone="primary" description="Synced / packing" />
        <KpiCard label="Packed" value={stats.packed} icon={PackageOpen} />
        <KpiCard label="Shipped" value={stats.shipped} icon={Truck} tone="success" description="Shipped / delivered" />
        <KpiCard label="Returns" value={stats.returns} icon={RotateCcw} tone={stats.returns > 0 ? 'warning' : 'default'} />
        <KpiCard
          label="Unreconciled"
          value={stats.unreconciled}
          icon={AlertTriangle}
          tone={stats.unreconciled > 0 ? 'danger' : 'default'}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Workflow</div>
          <h3 className="text-base font-semibold mt-1">Channels</h3>
          <p className="text-xs text-muted-foreground mt-2">
            Storefronts synced from Shopify, WooCommerce, Facebook, Daraz, or manual entry.
          </p>
          <Button variant="outline" size="sm" className="mt-4" asChild>
            <Link href="/ecommerce/channels">Manage channels</Link>
          </Button>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Workflow</div>
          <h3 className="text-base font-semibold mt-1">Orders & fulfillment</h3>
          <p className="text-xs text-muted-foreground mt-2">
            Pack, ship, and track online orders. Stock decrements on fulfillment.
          </p>
          <Button variant="outline" size="sm" className="mt-4" asChild>
            <Link href="/ecommerce/orders">Manage orders</Link>
          </Button>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Workflow</div>
          <h3 className="text-base font-semibold mt-1">Reconciliation</h3>
          <p className="text-xs text-muted-foreground mt-2">
            Match channel settlements against orders and track collected revenue.
          </p>
          <Button variant="outline" size="sm" className="mt-4" asChild>
            <Link href="/ecommerce/reconcile">Reconcile payments</Link>
          </Button>
        </Card>
      </div>
    </div>
  );
}
