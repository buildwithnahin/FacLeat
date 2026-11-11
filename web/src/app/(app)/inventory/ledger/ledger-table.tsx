'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Search,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  History,
  FileText,
  Filter,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, d } from '@/lib/money';

export interface MovementRow {
  id: string;
  createdAt: string;
  direction: 'IN' | 'OUT';
  quantity: string;
  costPerUnit: string;
  refType: string;
  refId: string | null;
  note: string | null;
  product: { sku: string; name: string };
  warehouse: { name: string; code: string; type: string };
}

export function LedgerTable({
  rows,
  emptyLabel,
}: {
  rows: MovementRow[];
  emptyLabel: string;
}) {
  const [search, setSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [refTypeFilter, setRefTypeFilter] = useState('ALL');

  // Distinct ref types
  const refTypes = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.refType) set.add(r.refType);
    });
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      // Direction
      if (directionFilter !== 'ALL' && r.direction !== directionFilter) return false;

      // Ref type
      if (refTypeFilter !== 'ALL' && r.refType !== refTypeFilter) return false;

      // Text search
      if (!q) return true;
      return (
        r.product.name.toLowerCase().includes(q) ||
        r.product.sku.toLowerCase().includes(q) ||
        r.warehouse.name.toLowerCase().includes(q) ||
        r.warehouse.code.toLowerCase().includes(q) ||
        r.refType.toLowerCase().includes(q) ||
        (r.note && r.note.toLowerCase().includes(q))
      );
    });
  }, [rows, search, directionFilter, refTypeFilter]);

  // Totals
  const totals = useMemo(() => {
    let totalIn = d(0);
    let totalOut = d(0);

    rows.forEach((r) => {
      const q = d(r.quantity);
      if (r.direction === 'IN') totalIn = totalIn.add(q);
      else if (r.direction === 'OUT') totalOut = totalOut.add(q);
    });

    const net = totalIn.sub(totalOut);

    return {
      totalIn: totalIn.toString(),
      totalOut: totalOut.toString(),
      net: net.toString(),
      inCount: rows.filter((r) => r.direction === 'IN').length,
      outCount: rows.filter((r) => r.direction === 'OUT').length,
    };
  }, [rows]);

  return (
    <div className="space-y-4">
      {/* KPI Cards: IN vs OUT summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs uppercase tracking-wider font-semibold">Total Stock In</span>
            <ArrowDownToLine className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold mt-1 text-emerald-600 tabular-nums">
            +{parseFloat(totals.totalIn).toLocaleString()} units
          </p>
          <span className="text-xs text-muted-foreground">
            {totals.inCount} received / incoming transactions
          </span>
        </Card>

        <Card className="p-4 border-l-4 border-l-red-500">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs uppercase tracking-wider font-semibold">Total Stock Out</span>
            <ArrowUpFromLine className="h-4 w-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold mt-1 text-red-600 tabular-nums">
            -{parseFloat(totals.totalOut).toLocaleString()} units
          </p>
          <span className="text-xs text-muted-foreground">
            {totals.outCount} issued / sold / dispatched transactions
          </span>
        </Card>

        <Card className="p-4 border-l-4 border-l-primary">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs uppercase tracking-wider font-semibold">Net Movement</span>
            <History className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold mt-1 text-slate-800 tabular-nums">
            {parseFloat(totals.net) >= 0 ? '+' : ''}
            {parseFloat(totals.net).toLocaleString()} units
          </p>
          <span className="text-xs text-muted-foreground">Net change in stock balance</span>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-md border">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search product, SKU, warehouse, ref..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>

          {/* Direction Filter Tabs */}
          <div className="flex items-center gap-1 border rounded-md p-0.5 bg-slate-50">
            <Button
              type="button"
              variant={directionFilter === 'ALL' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setDirectionFilter('ALL')}
              className="text-xs h-7 px-2.5"
            >
              All ({rows.length})
            </Button>
            <Button
              type="button"
              variant={directionFilter === 'IN' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setDirectionFilter('IN')}
              className="text-xs h-7 px-2.5 text-emerald-700 font-medium"
            >
              Stock In ({totals.inCount})
            </Button>
            <Button
              type="button"
              variant={directionFilter === 'OUT' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setDirectionFilter('OUT')}
              className="text-xs h-7 px-2.5 text-red-600 font-medium"
            >
              Stock Out ({totals.outCount})
            </Button>
          </div>

          {/* Ref Type Dropdown */}
          {refTypes.length > 1 && (
            <select
              value={refTypeFilter}
              onChange={(e) => setRefTypeFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs focus:outline-none"
            >
              <option value="ALL">All Ref Types ({refTypes.length})</option>
              {refTypes.map((rt) => (
                <option key={rt} value={rt}>
                  {rt}
                </option>
              ))}
            </select>
          )}
        </div>

        <span className="text-xs text-muted-foreground tabular-nums">
          Showing {filtered.length} of {rows.length} records
        </span>
      </div>

      {/* Ledger Records Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left font-semibold px-4 py-3">Timestamp</th>
                <th className="text-left font-semibold px-4 py-3">SKU</th>
                <th className="text-left font-semibold px-4 py-3">Product</th>
                <th className="text-left font-semibold px-4 py-3">Warehouse</th>
                <th className="text-center font-semibold px-4 py-3">Direction</th>
                <th className="text-right font-semibold px-4 py-3">Quantity</th>
                <th className="text-right font-semibold px-4 py-3">Cost / Unit</th>
                <th className="text-left font-semibold px-4 py-3">Reference</th>
                <th className="text-left font-semibold px-4 py-3">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    {rows.length === 0 ? emptyLabel : 'No movement records match your search or filter.'}
                  </td>
                </tr>
              )}
              {filtered.map((r) => {
                const isIn = r.direction === 'IN';
                return (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground tabular text-xs">
                      {r.createdAt ? r.createdAt.replace('T', ' ').slice(0, 19) : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                      {r.product.sku}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {r.product.name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      <div className="font-medium text-slate-700">{r.warehouse.name}</div>
                      <span className="text-[10px] text-slate-400">
                        {r.warehouse.code} • {r.warehouse.type.toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        variant={isIn ? 'success' : 'destructive'}
                        className="text-[11px] font-bold px-2 py-0.5"
                      >
                        {isIn ? '↓ IN' : '↑ OUT'}
                      </Badge>
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums text-sm font-bold ${
                        isIn ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {isIn ? '+' : '-'}
                      {parseFloat(r.quantity).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular text-muted-foreground text-xs">
                      {r.costPerUnit ? formatCurrency(r.costPerUnit) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {r.refType}
                      </Badge>
                      {r.refId && (
                        <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          #{r.refId.slice(0, 8)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">
                      {r.note || '—'}
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
