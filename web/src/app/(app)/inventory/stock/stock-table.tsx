'use client';

import { useState, useMemo } from 'react';
import { Search, Boxes, AlertTriangle, Layers, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, d } from '@/lib/money';

export type Product = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  type: string;
  reorderLevel: string;
  costPrice: string;
  sellPrice: string;
};

export type Warehouse = {
  id: string;
  name: string;
  code: string;
  type: string;
};

export type StockRow = {
  product: Product;
  warehouse: Warehouse;
  qty: string;
};

export function StockTable({
  rows,
  title,
  description,
  emptyLabel,
}: {
  rows: StockRow[];
  title: string;
  description: string;
  emptyLabel: string;
}) {
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LOW' | 'OUT'>('ALL');

  const warehouses = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => map.set(r.warehouse.id, `${r.warehouse.name} (${r.warehouse.code})`));
    return Array.from(map.entries());
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      // Search
      const matchesSearch =
        !q ||
        r.product.name.toLowerCase().includes(q) ||
        r.product.sku.toLowerCase().includes(q) ||
        r.warehouse.name.toLowerCase().includes(q) ||
        r.warehouse.code.toLowerCase().includes(q);

      // Warehouse
      const matchesWarehouse = warehouseFilter === 'ALL' || r.warehouse.id === warehouseFilter;

      // Status
      const qty = d(r.qty);
      const reorder = d(r.product.reorderLevel);
      const isOut = qty.lte(0);
      const isLow = reorder.gt(0) && qty.lte(reorder);

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'OUT' && isOut) ||
        (statusFilter === 'LOW' && isLow);

      return matchesSearch && matchesWarehouse && matchesStatus;
    });
  }, [rows, search, warehouseFilter, statusFilter]);

  // Aggregate stats
  const totals = useMemo(() => {
    let totalQty = d(0);
    let totalCostVal = d(0);
    let totalSellVal = d(0);
    let lowCount = 0;
    let outCount = 0;

    rows.forEach((r) => {
      const q = d(r.qty);
      const reorder = d(r.product.reorderLevel);
      if (q.lte(0)) outCount++;
      else if (reorder.gt(0) && q.lte(reorder)) lowCount++;

      totalQty = totalQty.add(q);
      totalCostVal = totalCostVal.add(d(r.product.costPrice).mul(q));
      totalSellVal = totalSellVal.add(d(r.product.sellPrice).mul(q));
    });

    return {
      qty: totalQty.toString(),
      cost: totalCostVal.toString(),
      sell: totalSellVal.toString(),
      lowCount,
      outCount,
    };
  }, [rows]);

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs uppercase tracking-wider">Total Units in Stock</span>
            <Boxes className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold mt-1 tabular-nums">
            {parseFloat(totals.qty).toLocaleString()}
          </p>
          <span className="text-xs text-muted-foreground">{rows.length} SKU locations</span>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs uppercase tracking-wider">Total Valuation (Cost)</span>
            <Layers className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold mt-1 text-emerald-600 tabular-nums">
            {formatCurrency(totals.cost)}
          </p>
          <span className="text-xs text-muted-foreground">Asset at cost price</span>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs uppercase tracking-wider">Retail Value (Sell)</span>
            <span className="text-xs font-semibold text-blue-600">MRP</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-slate-800 tabular-nums">
            {formatCurrency(totals.sell)}
          </p>
          <span className="text-xs text-muted-foreground">Estimated sales revenue</span>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs uppercase tracking-wider">Stock Alerts</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="warning" className="text-xs">
              {totals.lowCount} Low
            </Badge>
            <Badge variant="destructive" className="text-xs">
              {totals.outCount} Out
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground mt-1 block">Requires restocking</span>
        </Card>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-md border">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search product, SKU, or warehouse..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>

          {/* Warehouse Dropdown Filter */}
          {warehouses.length > 1 && (
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus:outline-none"
            >
              <option value="ALL">All Warehouses ({warehouses.length})</option>
              {warehouses.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          )}

          {/* Status Quick Filter Buttons */}
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant={statusFilter === 'ALL' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter('ALL')}
              className="text-xs h-8"
            >
              All
            </Button>
            <Button
              type="button"
              variant={statusFilter === 'LOW' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter('LOW')}
              className="text-xs h-8 text-amber-700"
            >
              Low Stock ({totals.lowCount})
            </Button>
            <Button
              type="button"
              variant={statusFilter === 'OUT' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter('OUT')}
              className="text-xs h-8 text-red-600"
            >
              Out of Stock ({totals.outCount})
            </Button>
          </div>
        </div>

        <span className="text-xs text-muted-foreground tabular-nums">
          Showing {filtered.length} of {rows.length} rows
        </span>
      </div>

      {/* Main Stock Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left font-semibold px-4 py-3">SKU</th>
                <th className="text-left font-semibold px-4 py-3">Product</th>
                <th className="text-left font-semibold px-4 py-3">Warehouse</th>
                <th className="text-right font-semibold px-4 py-3">Balance Qty</th>
                <th className="text-left font-semibold px-4 py-3">Unit</th>
                <th className="text-right font-semibold px-4 py-3">Cost / unit</th>
                <th className="text-right font-semibold px-4 py-3">Sell / unit</th>
                <th className="text-right font-semibold px-4 py-3">Total Cost</th>
                <th className="text-right font-semibold px-4 py-3">Total Sell</th>
                <th className="text-right font-semibold px-4 py-3">Reorder Level</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                    {rows.length === 0 ? emptyLabel : 'No products match your search or filter.'}
                  </td>
                </tr>
              )}
              {filtered.map((r) => {
                const qty = d(r.qty);
                const reorderLevel = d(r.product.reorderLevel);
                const low =
                  reorderLevel.gt(0) && qty.lte(reorderLevel)
                    ? 'text-amber-600 font-bold'
                    : qty.lte(0)
                    ? 'text-red-600 font-bold'
                    : 'text-slate-900 font-semibold';
                const totalCost = d(r.product.costPrice).mul(qty);
                const totalSell = d(r.product.sellPrice).mul(qty);

                return (
                  <tr key={`${r.product.id}-${r.warehouse.id}`} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                      {r.product.sku}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div>{r.product.name}</div>
                      <span className="text-[10px] text-muted-foreground uppercase">
                        {r.product.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      <div className="font-medium text-slate-700">{r.warehouse.name}</div>
                      <span className="text-[10px] text-slate-400">({r.warehouse.code})</span>
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums text-sm ${low}`}>
                      {parseFloat(r.qty).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{r.product.unit}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground text-xs">
                      {formatCurrency(r.product.costPrice)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground text-xs">
                      {formatCurrency(r.product.sellPrice)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground text-xs">
                      {formatCurrency(totalCost)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-xs text-slate-900">
                      {formatCurrency(totalSell)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground text-xs">
                      {reorderLevel.gt(0) ? (
                        <span className={qty.lte(reorderLevel) ? 'text-amber-600 font-semibold' : ''}>
                          {r.product.reorderLevel}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
