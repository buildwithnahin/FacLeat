'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Boxes,
  Store,
  Layers,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Settings,
  ClipboardList,
  Building2,
  Search,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency, d } from '@/lib/money';
import { WarehouseForm } from '../warehouse-form';

export type WarehouseStockData = {
  warehouse: {
    id: string;
    branchId: string;
    code: string;
    name: string;
    type: 'MAIN' | 'STORE' | 'WIP' | 'QUARANTINE' | 'DAMAGED' | 'SHOWROOM';
    address: string | null;
    isActive: boolean;
    branch: { id: string; name: string; code: string; currency: string };
  };
  stock: Array<{
    product: {
      id: string;
      sku: string;
      name: string;
      unit: string;
      type: string;
      costPrice: string;
      sellPrice: string;
      reorderLevel: string;
    };
    qty: string;
    costValue: string;
    sellValue: string;
    isLowStock: boolean;
  }>;
  recentMovements: Array<{
    id: string;
    date: string;
    product: { id: string; name: string; sku: string; unit: string };
    direction: 'IN' | 'OUT';
    quantity: string;
    refType: string;
    note: string | null;
    actor: string;
  }>;
  summary: {
    totalUnits: string;
    totalCostValue: string;
    totalSellValue: string;
    itemsCount: number;
    lowStockCount: number;
  };
};

export function WarehouseDashboard({
  data,
  branches,
  canWrite,
}: {
  data: WarehouseStockData;
  branches: Array<{ id: string; name: string; code: string }>;
  canWrite: boolean;
}) {
  const [activeTab, setActiveTab] = useState<'stock' | 'movements' | 'settings'>('stock');
  const [search, setSearch] = useState('');

  const { warehouse, stock, recentMovements, summary } = data;

  const filteredStock = stock.filter(
    (item) =>
      !search ||
      item.product.name.toLowerCase().includes(search.toLowerCase()) ||
      item.product.sku.toLowerCase().includes(search.toLowerCase()),
  );

  const typeColorMap: Record<string, string> = {
    SHOWROOM: 'bg-purple-100 text-purple-800 border-purple-200',
    MAIN: 'bg-blue-100 text-blue-800 border-blue-200',
    STORE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    WIP: 'bg-amber-100 text-amber-800 border-amber-200',
    DAMAGED: 'bg-red-100 text-red-800 border-red-200',
    QUARANTINE: 'bg-orange-100 text-orange-800 border-orange-200',
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Info */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{warehouse.name}</h1>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                  typeColorMap[warehouse.type] ?? 'bg-slate-100 text-slate-700'
                }`}
              >
                {warehouse.type === 'SHOWROOM' ? '🏪 SHOWROOM' : warehouse.type}
              </span>
              <Badge variant={warehouse.isActive ? 'success' : 'outline'}>
                {warehouse.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 font-mono">
                Code: <strong className="text-foreground">{warehouse.code}</strong>
              </span>
              <span className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                Branch: <strong className="text-foreground">{warehouse.branch.name} ({warehouse.branch.code})</strong>
              </span>
              {warehouse.address && <span>Address: {warehouse.address}</span>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/warehouse/receive?warehouseId=${warehouse.id}`}>
                <ArrowDownToLine className="h-4 w-4" /> Receive Stock
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/warehouse/transfer?fromWarehouseId=${warehouse.id}`}>
                <ArrowLeftRight className="h-4 w-4" /> Transfer Stock
              </Link>
            </Button>
            {warehouse.type === 'SHOWROOM' && (
              <Button size="sm" asChild className="bg-purple-600 hover:bg-purple-700">
                <Link href="/pos">
                  <Store className="h-4 w-4" /> Open POS Terminal
                </Link>
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs uppercase tracking-wider font-medium">Total Units in Stock</span>
            <Boxes className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold mt-1 tabular-nums">
            {parseFloat(summary.totalUnits || '0').toLocaleString()}
          </p>
          <span className="text-xs text-muted-foreground">{summary.itemsCount} unique products stocked</span>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs uppercase tracking-wider font-medium">Valuation at Cost</span>
            <Layers className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold mt-1 text-emerald-600 tabular-nums">
            {formatCurrency(summary.totalCostValue)}
          </p>
          <span className="text-xs text-muted-foreground">Asset acquisition value</span>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs uppercase tracking-wider font-medium">Retail Value (MRP)</span>
            <span className="text-xs font-semibold text-blue-600">MRP</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-slate-800 tabular-nums">
            {formatCurrency(summary.totalSellValue)}
          </p>
          <span className="text-xs text-muted-foreground">Potential sales revenue</span>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs uppercase tracking-wider font-medium">Stock Alerts</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="warning" className="text-xs">
              {summary.lowStockCount} Low Stock
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground mt-1 block">Products below reorder level</span>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('stock')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'stock'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Boxes className="h-4 w-4" />
          Current Stock Inventory ({stock.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('movements')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'movements'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          Recent Stock Movements ({recentMovements.length})
        </button>

        {canWrite && (
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'settings'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Settings className="h-4 w-4" />
            Warehouse Settings
          </button>
        )}
      </div>

      {/* Tab 1: Current Stock Inventory */}
      {activeTab === 'stock' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products in this warehouse..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              Showing {filteredStock.length} of {stock.length} products
            </span>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left font-semibold px-4 py-3">SKU</th>
                    <th className="text-left font-semibold px-4 py-3">Product Name</th>
                    <th className="text-left font-semibold px-4 py-3">Type</th>
                    <th className="text-right font-semibold px-4 py-3">In-Stock Qty</th>
                    <th className="text-left font-semibold px-4 py-3">UOM</th>
                    <th className="text-right font-semibold px-4 py-3">Cost Price</th>
                    <th className="text-right font-semibold px-4 py-3">Sell Price</th>
                    <th className="text-right font-semibold px-4 py-3">Cost Valuation</th>
                    <th className="text-right font-semibold px-4 py-3">Retail Valuation</th>
                    <th className="text-center font-semibold px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredStock.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                        {stock.length === 0
                          ? `No inventory currently stocked in ${warehouse.name}. Use "Receive Stock" or "Transfer Stock" to load products.`
                          : 'No products match your search.'}
                      </td>
                    </tr>
                  )}
                  {filteredStock.map((row) => (
                    <tr key={row.product.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                        {row.product.sku}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <Link href={`/inventory/products/${row.product.id}`} className="hover:underline text-blue-600">
                          {row.product.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground capitalize">
                        {row.product.type.replace('_', ' ').toLowerCase()}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-900">
                        {parseFloat(row.qty).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{row.product.unit}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs text-muted-foreground">
                        {formatCurrency(row.product.costPrice)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs text-muted-foreground">
                        {formatCurrency(row.product.sellPrice)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs font-medium text-emerald-700">
                        {formatCurrency(row.costValue)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs font-semibold text-slate-900">
                        {formatCurrency(row.sellValue)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.isLowStock ? (
                          <Badge variant="warning" className="text-[10px]">
                            Low Stock
                          </Badge>
                        ) : parseFloat(row.qty) <= 0 ? (
                          <Badge variant="destructive" className="text-[10px]">
                            Out of Stock
                          </Badge>
                        ) : (
                          <Badge variant="success" className="text-[10px]">
                            Optimal
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 2: Recent Movements Ledger */}
      {activeTab === 'movements' && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Date</th>
                  <th className="text-left font-semibold px-4 py-3">Product</th>
                  <th className="text-center font-semibold px-4 py-3">Direction</th>
                  <th className="text-right font-semibold px-4 py-3">Quantity</th>
                  <th className="text-left font-semibold px-4 py-3">Reference / Type</th>
                  <th className="text-left font-semibold px-4 py-3">Remarks / Note</th>
                  <th className="text-left font-semibold px-4 py-3">Authorized By</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentMovements.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      No stock movement ledger records found for this location yet.
                    </td>
                  </tr>
                )}
                {recentMovements.map((m) => (
                  <tr key={m.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 tabular-nums text-xs text-muted-foreground">
                      {m.date.slice(0, 10)} {m.date.slice(11, 16)}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <div>{m.product.name}</div>
                      <span className="text-xs text-muted-foreground font-mono">{m.product.sku}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                          m.direction === 'IN'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {m.direction === 'IN' ? '↓ IN' : '↑ OUT'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">
                      {parseFloat(m.quantity).toLocaleString()} {m.product.unit}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                      {m.refType.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">
                      {m.note ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{m.actor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 3: Warehouse Settings */}
      {activeTab === 'settings' && canWrite && (
        <Card className="p-6">
          <h2 className="text-base font-semibold mb-4">Edit Location Details</h2>
          <WarehouseForm
            mode="edit"
            initial={{
              id: warehouse.id,
              branchId: warehouse.branchId,
              code: warehouse.code,
              name: warehouse.name,
              type: warehouse.type,
              address: warehouse.address,
              isActive: warehouse.isActive,
            }}
            branches={branches}
          />
        </Card>
      )}
    </div>
  );
}
