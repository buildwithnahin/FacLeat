'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Search,
  Boxes,
  AlertTriangle,
  Layers,
  Store,
  Building2,
  Warehouse as WarehouseIcon,
} from 'lucide-react';
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

export type WarehouseOption = {
  id: string;
  name: string;
  code: string;
  type: string;
  branch?: { id?: string; name: string; code: string };
};

export type BranchOption = {
  id: string;
  name: string;
  code: string;
};

export function StockTable({
  rows,
  title,
  description,
  emptyLabel,
  availableWarehouses = [],
  availableBranches = [],
  initialBranchId = 'ALL',
}: {
  rows: StockRow[];
  title: string;
  description: string;
  emptyLabel: string;
  availableWarehouses?: WarehouseOption[];
  availableBranches?: BranchOption[];
  initialBranchId?: string;
}) {
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState(initialBranchId);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'SHOWROOM' | 'MAIN' | 'STORE' | 'WIP' | 'DAMAGED'>('ALL');
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LOW' | 'OUT'>('ALL');

  // Map each warehouseId to its branchId/code
  const warehouseBranchMap = useMemo(() => {
    const map = new Map<string, string>();
    availableWarehouses.forEach((w) => {
      if (w.branch?.id) map.set(w.id, w.branch.id);
    });
    return map;
  }, [availableWarehouses]);

  // Master list of warehouses filtered by current branch and type selection
  const selectableWarehouses = useMemo(() => {
    let list = availableWarehouses;
    if (list.length === 0) {
      const map = new Map<string, WarehouseOption>();
      rows.forEach((r) =>
        map.set(r.warehouse.id, {
          id: r.warehouse.id,
          name: r.warehouse.name,
          code: r.warehouse.code,
          type: r.warehouse.type,
        }),
      );
      list = Array.from(map.values());
    }

    return list.filter((w) => {
      if (branchFilter !== 'ALL' && w.branch?.id && w.branch.id !== branchFilter) return false;
      if (typeFilter !== 'ALL' && w.type?.toUpperCase() !== typeFilter) return false;
      return true;
    });
  }, [availableWarehouses, rows, branchFilter, typeFilter]);

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

      // Branch
      const whBranchId = warehouseBranchMap.get(r.warehouse.id);
      const matchesBranch = branchFilter === 'ALL' || !whBranchId || whBranchId === branchFilter;

      // Warehouse Type
      const matchesType = typeFilter === 'ALL' || r.warehouse.type?.toUpperCase() === typeFilter;

      // Specific Warehouse
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

      return matchesSearch && matchesBranch && matchesType && matchesWarehouse && matchesStatus;
    });
  }, [rows, search, branchFilter, typeFilter, warehouseFilter, statusFilter, warehouseBranchMap]);

  // Aggregate stats based on current filtered items
  const totals = useMemo(() => {
    let totalQty = d(0);
    let totalCostVal = d(0);
    let totalSellVal = d(0);
    let lowCount = 0;
    let outCount = 0;

    filtered.forEach((r) => {
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
  }, [filtered]);

  const typePillClass: Record<string, string> = {
    SHOWROOM: 'bg-purple-100 text-purple-800 border-purple-200',
    MAIN: 'bg-blue-100 text-blue-800 border-blue-200',
    STORE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    WIP: 'bg-amber-100 text-amber-800 border-amber-200',
    DAMAGED: 'bg-red-100 text-red-800 border-red-200',
  };

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs uppercase tracking-wider font-medium">Units in Stock</span>
            <Boxes className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold mt-1 tabular-nums">
            {parseFloat(totals.qty).toLocaleString()}
          </p>
          <span className="text-xs text-muted-foreground">{filtered.length} matching locations</span>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs uppercase tracking-wider font-medium">Total Cost Value</span>
            <Layers className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold mt-1 text-emerald-600 tabular-nums">
            {formatCurrency(totals.cost)}
          </p>
          <span className="text-xs text-muted-foreground">Asset at cost price</span>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs uppercase tracking-wider font-medium">Retail Value (MRP)</span>
            <span className="text-xs font-semibold text-blue-600">MRP</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-slate-800 tabular-nums">
            {formatCurrency(totals.sell)}
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
              {totals.lowCount} Low
            </Badge>
            <Badge variant="destructive" className="text-xs">
              {totals.outCount} Out
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground mt-1 block">Requires restocking</span>
        </Card>
      </div>

      {/* Warehouse Type Quick Filters */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
        <span className="text-xs font-semibold text-slate-600 mr-1 flex items-center gap-1">
          <WarehouseIcon className="h-3.5 w-3.5" /> Location Type:
        </span>
        <button
          type="button"
          onClick={() => {
            setTypeFilter('ALL');
            setWarehouseFilter('ALL');
          }}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            typeFilter === 'ALL'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 border hover:bg-slate-100'
          }`}
        >
          All Types
        </button>
        <button
          type="button"
          onClick={() => {
            setTypeFilter('SHOWROOM');
            setWarehouseFilter('ALL');
          }}
          className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
            typeFilter === 'SHOWROOM'
              ? 'bg-purple-700 text-white shadow-xs'
              : 'bg-white text-purple-800 border border-purple-200 hover:bg-purple-50'
          }`}
        >
          <Store className="h-3.5 w-3.5" /> Showrooms Only
        </button>
        <button
          type="button"
          onClick={() => {
            setTypeFilter('MAIN');
            setWarehouseFilter('ALL');
          }}
          className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
            typeFilter === 'MAIN'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'bg-white text-blue-800 border border-blue-200 hover:bg-blue-50'
          }`}
        >
          <Building2 className="h-3.5 w-3.5" /> Central / Main WH
        </button>
        <button
          type="button"
          onClick={() => {
            setTypeFilter('STORE');
            setWarehouseFilter('ALL');
          }}
          className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
            typeFilter === 'STORE'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50'
          }`}
        >
          <Boxes className="h-3.5 w-3.5" /> Sub-Stores
        </button>
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

          {/* Branch Filter Selector */}
          {availableBranches.length > 1 && (
            <select
              value={branchFilter}
              onChange={(e) => {
                setBranchFilter(e.target.value);
                setWarehouseFilter('ALL');
              }}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus:outline-none"
            >
              <option value="ALL">All Branches ({availableBranches.length})</option>
              {availableBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          )}

          {/* Warehouse Dropdown Filter */}
          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus:outline-none max-w-[240px]"
          >
            <option value="ALL">
              All Locations {selectableWarehouses.length > 0 ? `(${selectableWarehouses.length})` : ''}
            </option>
            {selectableWarehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.name} ({wh.code}) [{wh.type}]
              </option>
            ))}
          </select>

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
              Low ({totals.lowCount})
            </Button>
            <Button
              type="button"
              variant={statusFilter === 'OUT' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter('OUT')}
              className="text-xs h-8 text-red-600"
            >
              Out ({totals.outCount})
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
                <th className="text-left font-semibold px-4 py-3">Warehouse / Showroom</th>
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
                      <Link href={`/inventory/products/${r.product.id}`} className="hover:underline text-blue-600">
                        {r.product.name}
                      </Link>
                      <span className="text-[10px] text-muted-foreground uppercase block">
                        {r.product.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Link
                          href={`/warehouse/${r.warehouse.id}`}
                          className="font-semibold text-slate-800 hover:underline hover:text-blue-600"
                        >
                          {r.warehouse.name}
                        </Link>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-semibold border ${
                            typePillClass[r.warehouse.type] ?? 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {r.warehouse.type === 'SHOWROOM' ? '🏪 SHOWROOM' : r.warehouse.type}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">({r.warehouse.code})</span>
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
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground text-xs font-medium text-emerald-700">
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
