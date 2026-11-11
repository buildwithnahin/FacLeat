'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import JsBarcode from 'jsbarcode';
import {
  Printer,
  Search,
  ArrowLeft,
  Barcode as BarcodeIcon,
  Plus,
  Minus,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

export interface LabelProduct {
  id: string;
  sku: string;
  name: string;
  barcode: string | null;
  size: string | null;
  unit: string;
  categoryName: string | null;
  sellPrice: string;
}

export interface LabelSheetProps {
  products: LabelProduct[];
}

function BarcodeSvg({ value, height = 36 }: { value: string; height?: number }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, {
        format: 'CODE128',
        displayValue: false,
        margin: 0,
        width: 1.5,
        height,
        background: 'transparent',
        lineColor: '#0f172a',
      });
    } catch (e) {
      console.error('JsBarcode render error', e);
    }
  }, [value, height]);

  return <svg ref={ref} aria-label={`Barcode ${value}`} className="label-barcode-svg mx-auto" />;
}

export function LabelSheet({ products }: LabelSheetProps) {
  const [viewMode, setViewMode] = useState<'settings' | 'sheet'>('settings');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [qtyById, setQtyById] = useState<Record<string, number>>({});
  const [sizeById, setSizeById] = useState<Record<string, string>>({});
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);

  // Print settings
  const [labelSize, setLabelSize] = useState<'medium' | 'standard' | 'small' | 'a4'>('medium');
  const [printerType, setPrinterType] = useState<'thermal' | 'laser'>('thermal');
  const [globalCopies, setGlobalCopies] = useState<number>(1);
  const [layoutMode, setLayoutMode] = useState<'grid' | 'roll'>('grid');

  // Initialize size mapping from products
  useEffect(() => {
    const initialSizes: Record<string, string> = {};
    products.forEach((p) => {
      if (p.size) initialSizes[p.id] = p.size;
    });
    setSizeById((prev) => ({ ...initialSizes, ...prev }));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.categoryName && p.categoryName.toLowerCase().includes(q)),
    );
  }, [products, search]);

  const toggleSelect = (p: LabelProduct) => {
    const next = new Set(selectedIds);
    if (next.has(p.id)) {
      next.delete(p.id);
      setQtyById((prev) => {
        const copy = { ...prev };
        delete copy[p.id];
        return copy;
      });
      if (activePreviewId === p.id) {
        const remaining = Array.from(next);
        setActivePreviewId(remaining.length > 0 ? remaining[0] : null);
      }
    } else {
      next.add(p.id);
      setQtyById((prev) => ({
        ...prev,
        [p.id]: prev[p.id] && prev[p.id] > 0 ? prev[p.id] : Math.max(1, globalCopies),
      }));
      setActivePreviewId(p.id);
    }
    setSelectedIds(next);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedIds(new Set());
      setQtyById({});
      setActivePreviewId(null);
    } else {
      const next = new Set<string>();
      const nextQty: Record<string, number> = {};
      filteredProducts.forEach((p) => {
        next.add(p.id);
        nextQty[p.id] = Math.max(1, globalCopies);
      });
      setSelectedIds(next);
      setQtyById(nextQty);
      if (filteredProducts.length > 0) {
        setActivePreviewId(filteredProducts[0].id);
      }
    }
  };

  const updateQty = (id: string, delta: number) => {
    setQtyById((prev) => {
      const current = prev[id] ?? 0;
      const val = Math.max(1, Math.min(500, current + delta));
      return { ...prev, [id]: val };
    });
    if (!selectedIds.has(id)) {
      setSelectedIds((prev) => new Set([...prev, id]));
      setActivePreviewId(id);
    }
  };

  const setQtyDirect = (id: string, value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num <= 0) {
      setQtyById((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      setSelectedIds((prev) => {
        const copy = new Set(prev);
        copy.delete(id);
        return copy;
      });
    } else {
      const capped = Math.min(500, num);
      setQtyById((prev) => ({ ...prev, [id]: capped }));
      setSelectedIds((prev) => new Set([...prev, id]));
      setActivePreviewId(id);
    }
  };

  const handleCopiesChange = (val: number) => {
    const safe = Math.max(1, Math.min(500, val || 1));
    setGlobalCopies(safe);
    setQtyById((prev) => {
      const next: Record<string, number> = {};
      selectedIds.forEach((id) => {
        next[id] = safe;
      });
      return next;
    });
  };

  const formatPrice = (value: string) =>
    `৳${new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(Number(value))}`;

  // Build the list of labels to print
  const printableList: { product: LabelProduct; qty: number; size: string }[] = [];
  products.forEach((p) => {
    if (selectedIds.has(p.id)) {
      const n = qtyById[p.id] ?? 1;
      if (n > 0) {
        printableList.push({
          product: p,
          qty: n,
          size: sizeById[p.id] || p.size || '',
        });
      }
    }
  });

  const totalLabels = printableList.reduce((acc, curr) => acc + curr.qty, 0);

  // Flat labels array for rendering in the print sheet
  const flatLabels = printableList.flatMap(({ product, qty, size }) =>
    Array.from({ length: qty }, () => ({ product, size })),
  );

  const previewItem = useMemo(() => {
    if (activePreviewId) {
      const found = products.find((p) => p.id === activePreviewId);
      if (found) {
        return {
          product: found,
          size: sizeById[found.id] || found.size || '',
        };
      }
    }
    if (printableList.length > 0) {
      return printableList[0];
    }
    return null;
  }, [activePreviewId, printableList, products, sizeById]);

  // Click on "Print Now" or "Print X Labels": switches to the printable format sheet!
  const handleShowPrintableSheet = () => {
    if (totalLabels === 0) {
      if (filteredProducts.length > 0) {
        toggleSelect(filteredProducts[0]);
      }
    }
    setViewMode('sheet');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTriggerPrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* ─────────────────────────────────────────────────────────── */}
      {/* 1. PRINTABLE SHEET FORMAT VIEW (When user clicks Print)     */}
      {/* ─────────────────────────────────────────────────────────── */}
      {viewMode === 'sheet' && (
        <div className="space-y-4">
          {/* Printable Sheet Action Bar (Hidden when physical print dialog runs) */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-lg border shadow-xs print:hidden">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode('settings')}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Settings
              </Button>
              <div className="border-l pl-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  Printable Sheet Format
                </h3>
                <p className="text-xs text-muted-foreground">
                  Ready to print {totalLabels} label{totalLabels === 1 ? '' : 's'} on{' '}
                  <span className="font-medium text-slate-800">
                    {labelSize === 'medium'
                      ? 'Medium (3×2 inch)'
                      : labelSize === 'standard'
                      ? 'Standard (50×25 mm)'
                      : labelSize === 'small'
                      ? 'Small (38×25 mm)'
                      : 'A4 Sheet (3-Column)'}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode('settings')}
              >
                <SlidersHorizontal className="h-4 w-4 mr-1.5" />
                Change Quantities / Size
              </Button>
              <Button
                onClick={handleTriggerPrint}
                className="bg-[#083366] hover:bg-[#0a3f7a] text-white gap-2 font-semibold"
              >
                <Printer className="h-4 w-4" />
                Print Sheet Now
              </Button>
            </div>
          </div>

          {/* Realistic Paper Sheet Container */}
          <div className="bg-slate-100 p-4 sm:p-8 rounded-lg border flex justify-center print:p-0 print:border-none print:bg-white">
            <div className="bg-white p-6 sm:p-8 rounded shadow-md border w-full max-w-4xl print:shadow-none print:border-none print:p-0">
              <div className="mb-4 pb-2 border-b flex justify-between items-center text-xs text-slate-500 print:hidden">
                <span>Print Preview Sheet ({totalLabels} labels total)</span>
                <span>Click &quot;Print Sheet Now&quot; above to send to printer</span>
              </div>

              {/* The Grid of Printable Labels */}
              <div className={`printable-sheet-grid layout-${labelSize}`}>
                {flatLabels.map(({ product, size }, idx) => (
                  <div key={`${product.id}-${idx}`} className="printable-label-card">
                    <div className="label-meta">
                      <span className="label-meta-title">SKU:</span>{' '}
                      <span className="label-meta-value">{product.sku}</span>
                      {size && <span className="label-size-badge">SIZE: {size}</span>}
                    </div>
                    <div className="label-name">{product.name.toUpperCase()}</div>
                    <div className="label-price">MRP {formatPrice(product.sellPrice)}</div>
                    <div className="label-footer">
                      <div className="label-barcode-box">
                        <BarcodeSvg value={product.barcode || product.sku} height={34} />
                        <div className="label-barcode-text">
                          {product.barcode || product.sku}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* 2. SETTINGS / CONFIGURATION VIEW (Default view)             */}
      {/* ─────────────────────────────────────────────────────────── */}
      {viewMode === 'settings' && (
        <>
          {/* Top action / back bar */}
          <div className="flex items-center justify-between print:hidden">
            <Button variant="ghost" size="sm" asChild className="gap-2">
              <Link href="/barcode">
                <ArrowLeft className="h-4 w-4" />
                Back to Barcodes
              </Link>
            </Button>
            {totalLabels > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode('sheet')}
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                Preview Printable Sheet ({totalLabels})
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
            {/* Left Column: Print Settings + Products Selector (2 cols) */}
            <div className="lg:col-span-2 space-y-6">
              {/* 1. Print Settings Card (Figma style) */}
              <Card>
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-base font-semibold">Print Settings</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="label-size" className="text-xs font-medium text-slate-700">
                        Label Size
                      </Label>
                      <select
                        id="label-size"
                        value={labelSize}
                        onChange={(e) => setLabelSize(e.target.value as any)}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="medium">Medium (3×2 inch / 75×50 mm)</option>
                        <option value="standard">Standard (50×25 mm)</option>
                        <option value="small">Small (38×25 mm)</option>
                        <option value="a4">A4 Sheet (3-Column, 24 Labels)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="printer-type" className="text-xs font-medium text-slate-700">
                        Printer
                      </Label>
                      <select
                        id="printer-type"
                        value={printerType}
                        onChange={(e) => setPrinterType(e.target.value as any)}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="thermal">Thermal Barcode Printer</option>
                        <option value="laser">Standard Laser / Inkjet (A4)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="num-copies" className="text-xs font-medium text-slate-700">
                        Number of Copies (per product)
                      </Label>
                      <Input
                        id="num-copies"
                        type="number"
                        min={1}
                        max={500}
                        value={globalCopies}
                        onChange={(e) => handleCopiesChange(parseInt(e.target.value, 10))}
                        className="h-9"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="layout-mode" className="text-xs font-medium text-slate-700">
                        Layout
                      </Label>
                      <select
                        id="layout-mode"
                        value={layoutMode}
                        onChange={(e) => setLayoutMode(e.target.value as any)}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="grid">Grid (Continuous roll or sheet)</option>
                        <option value="roll">Single Label</option>
                      </select>
                    </div>
                  </div>

                  {/* Print Button matching Figma */}
                  <div className="pt-2">
                    <Button
                      type="button"
                      onClick={handleShowPrintableSheet}
                      className="w-full h-11 text-sm font-semibold bg-[#083366] hover:bg-[#0a3f7a] text-white gap-2 shadow-sm"
                    >
                      <Printer className="h-4 w-4" />
                      {totalLabels > 0
                        ? `Print ${totalLabels} Label${totalLabels === 1 ? '' : 's'}`
                        : 'Select Products to Print'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* 2. Select Products to Print */}
              <Card>
                <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-semibold">Select Products to Print</CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    className="text-xs h-8"
                  >
                    {selectedIds.size === filteredProducts.length && filteredProducts.length > 0
                      ? 'Deselect All'
                      : 'Select All'}
                  </Button>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {/* Search bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search by name, SKU, barcode, or category..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>

                  {/* Products Table with Row Click Selection */}
                  <div className="rounded-md border overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                          <tr>
                            <th className="w-10 px-3 py-2 text-center">
                              <Checkbox
                                checked={
                                  filteredProducts.length > 0 &&
                                  selectedIds.size === filteredProducts.length
                                }
                                onCheckedChange={handleSelectAll}
                                aria-label="Select all"
                              />
                            </th>
                            <th className="text-left font-semibold px-3 py-2">Product Info</th>
                            <th className="text-left font-semibold px-3 py-2">Barcode</th>
                            <th className="text-left font-semibold px-3 py-2 w-32">
                              Size <span className="text-[10px] lowercase text-muted-foreground">(editable)</span>
                            </th>
                            <th className="text-right font-semibold px-3 py-2 w-36">Qty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {filteredProducts.map((p) => {
                            const isSelected = selectedIds.has(p.id);
                            const currentQty = qtyById[p.id] ?? 0;
                            const currentSize = sizeById[p.id] ?? p.size ?? '';

                            return (
                              <tr
                                key={p.id}
                                onClick={() => toggleSelect(p)}
                                className={`cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-primary/5 hover:bg-primary/10'
                                    : 'hover:bg-muted/40'
                                }`}
                              >
                                <td
                                  className="px-3 py-2.5 text-center"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleSelect(p)}
                                    aria-label={`Select ${p.name}`}
                                  />
                                </td>
                                <td className="px-3 py-2.5">
                                  <div className="font-medium text-slate-900">{p.name}</div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="font-mono text-xs text-muted-foreground">
                                      {p.sku}
                                    </span>
                                    {p.categoryName && (
                                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
                                        {p.categoryName}
                                      </Badge>
                                    )}
                                    <span className="text-xs font-semibold text-slate-700">
                                      {formatPrice(p.sellPrice)}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 font-mono text-xs text-slate-600">
                                  {p.barcode ? (
                                    <div className="flex items-center gap-1.5">
                                      <BarcodeIcon className="h-3.5 w-3.5 text-slate-400" />
                                      <span>{p.barcode}</span>
                                    </div>
                                  ) : (
                                    <span className="text-amber-600 italic">No barcode</span>
                                  )}
                                </td>
                                <td
                                  className="px-3 py-2.5"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Input
                                    type="text"
                                    placeholder="Size (e.g. 42 / XL)"
                                    value={currentSize}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setSizeById((prev) => ({ ...prev, [p.id]: val }));
                                      if (!selectedIds.has(p.id)) {
                                        toggleSelect(p);
                                      }
                                    }}
                                    className="h-8 text-xs"
                                  />
                                </td>
                                <td
                                  className="px-3 py-2.5 text-right"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => updateQty(p.id, -1)}
                                      disabled={currentQty <= 1}
                                    >
                                      <Minus className="h-3 w-3" />
                                    </Button>
                                    <Input
                                      type="number"
                                      min={0}
                                      max={500}
                                      value={currentQty > 0 ? currentQty : ''}
                                      placeholder="0"
                                      onChange={(e) => setQtyDirect(p.id, e.target.value)}
                                      className="h-7 w-14 text-center tabular text-xs p-1"
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => updateQty(p.id, 1)}
                                    >
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {filteredProducts.length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">
                                No products found matching your search.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Label Live Preview Card (Matching Figma) */}
            <div className="space-y-4">
              <Card className="sticky top-6">
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-base font-semibold">Label Preview</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {/* Preview Box */}
                  <div className="min-h-[220px] rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/50 p-4 flex flex-col items-center justify-center">
                    {previewItem ? (
                      <div className="w-full max-w-[260px] bg-white border border-slate-800 rounded p-3 shadow-xs space-y-2 text-center">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between border-b pb-1">
                          <span>{previewItem.product.sku}</span>
                          {previewItem.size && (
                            <span className="text-primary font-extrabold">Size: {previewItem.size}</span>
                          )}
                        </div>
                        <div className="font-extrabold text-xs text-slate-900 uppercase truncate">
                          {previewItem.product.name}
                        </div>
                        <div className="font-black text-sm text-slate-900">
                          MRP {formatPrice(previewItem.product.sellPrice)}
                        </div>
                        <div className="pt-1">
                          <BarcodeSvg value={previewItem.product.barcode || previewItem.product.sku} height={36} />
                          <div className="font-mono text-[10px] tracking-widest text-slate-600 mt-0.5">
                            {previewItem.product.barcode || previewItem.product.sku}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center space-y-2 text-muted-foreground">
                        <Printer className="h-10 w-10 mx-auto text-slate-300 stroke-[1.5]" />
                        <p className="text-sm font-medium">Select products to preview</p>
                        <p className="text-xs text-slate-400">
                          Click any product in the list to configure its label
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Summary Metadata */}
                  <div className="rounded-md bg-slate-50 p-3 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Label Size:</span>
                      <span className="font-medium text-slate-900 capitalize">
                        {labelSize === 'medium'
                          ? 'Medium (3×2 inch)'
                          : labelSize === 'standard'
                          ? 'Standard (50×25 mm)'
                          : labelSize === 'small'
                          ? 'Small (38×25 mm)'
                          : 'A4 Sheet (3-Column)'}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Printer:</span>
                      <span className="font-medium text-slate-900 capitalize">
                        {printerType === 'thermal' ? 'Thermal Printer' : 'Laser / Inkjet'}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Copies per item:</span>
                      <span className="font-medium text-slate-900">{globalCopies}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 border-t pt-2 font-semibold">
                      <span>Total Labels to Print:</span>
                      <span className="text-primary font-bold text-sm">{totalLabels}</span>
                    </div>
                  </div>

                  {/* Print Now Button */}
                  <Button
                    type="button"
                    onClick={handleShowPrintableSheet}
                    className="w-full bg-[#083366] hover:bg-[#0a3f7a] text-white gap-2 font-semibold"
                  >
                    <Printer className="h-4 w-4" />
                    Print Now
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* 3. PRINT STYLES (@media print)                             */}
      {/* ─────────────────────────────────────────────────────────── */}
      <style jsx>{`
        .printable-sheet-grid {
          display: grid;
          gap: 2.5mm;
          width: 100%;
        }

        .printable-sheet-grid.layout-a4,
        .printable-sheet-grid.layout-medium {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .printable-sheet-grid.layout-standard {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .printable-sheet-grid.layout-small {
          grid-template-columns: repeat(5, minmax(0, 1fr));
        }

        .printable-label-card {
          border: 1.5px solid #111827;
          border-radius: 4px;
          padding: 0;
          min-height: 36mm;
          display: flex;
          flex-direction: column;
          break-inside: avoid;
          background: #ffffff;
          overflow: hidden;
        }

        .label-meta {
          padding: 3px 6px;
          border-bottom: 1px solid #111827;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #fafafa;
        }

        .label-meta-title {
          font-size: 9px;
          font-weight: 700;
          color: #111827;
        }

        .label-meta-value {
          font-size: 9px;
          font-weight: 800;
          color: #020617;
          text-transform: uppercase;
        }

        .label-size-badge {
          font-size: 9px;
          font-weight: 900;
          background: #0f172a;
          color: #ffffff;
          padding: 1px 4px;
          border-radius: 2px;
        }

        .label-name {
          padding: 4px 6px;
          font-weight: 800;
          font-size: 11px;
          line-height: 1.15;
          color: #020617;
          text-transform: uppercase;
          border-bottom: 1px solid #111827;
          min-height: 26px;
          display: flex;
          align-items: center;
        }

        .label-price {
          padding: 3px 6px;
          border-bottom: 1px solid #111827;
          font-size: 11px;
          font-weight: 900;
          color: #020617;
        }

        .label-footer {
          padding: 2px 4px 4px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .label-barcode-box {
          width: 100%;
          text-align: center;
        }

        .label-barcode-svg {
          width: 100%;
          height: 34px;
          display: block;
        }

        .label-barcode-text {
          font-family: ui-monospace, Menlo, monospace;
          font-size: 8px;
          letter-spacing: 0.08em;
          color: #0f172a;
          text-align: center;
          line-height: 1;
          margin-top: 1px;
        }

        @media print {
          :global(body) {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          :global(aside),
          :global(header),
          :global(nav),
          :global(.print\\:hidden) {
            display: none !important;
          }
          .printable-sheet-grid {
            display: grid !important;
            gap: 2mm !important;
            padding: 0 !important;
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}
