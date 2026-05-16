'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import JsBarcode from 'jsbarcode';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

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

function BarcodeSvg({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    JsBarcode(ref.current, value, {
      format: 'CODE128',
      displayValue: false,
      margin: 0,
      width: 1.6,
      height: 34,
      background: '#ffffff',
      lineColor: '#0f172a',
    });
  }, [value]);

  return <svg ref={ref} aria-label={`Barcode ${value}`} className="label-barcode-svg" />;
}

export function LabelSheet({ products }: LabelSheetProps) {
  const [qtyById, setQtyById] = useState<Record<string, string>>({});

  const setQty = (id: string, v: string) => setQtyById((prev) => ({ ...prev, [id]: v }));
  const formatPrice = (value: string) =>
    `৳${new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(Number(value))}`;

  const toPrint: { p: LabelProduct; n: number }[] = [];
  for (const p of products) {
    const n = Math.max(0, Math.min(500, Number(qtyById[p.id] || 0)));
    if (n > 0) toPrint.push({ p, n });
  }

  const labels: LabelProduct[] = toPrint.flatMap(({ p, n }) => Array.from({ length: n }, () => p));
  const totalLabels = labels.length;
  const isShoeProduct = (product: LabelProduct) => product.categoryName?.trim().toLowerCase() === 'shoes';
  const getQtyLabel = (product: LabelProduct) => {
    if (product.unit === 'PAIR' || isShoeProduct(product)) return '1 Pair';
    if (product.unit === 'PCS') return '1 Pc';
    return `1 ${product.unit}`;
  };
  return (
    <div className="space-y-6">
      <Card className="print:hidden">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Pick quantities, then print</Label>
              <p className="text-xs text-muted-foreground">
                3-column A4 sheet. {totalLabels} label{totalLabels === 1 ? '' : 's'} will print.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" onClick={() => window.print()} disabled={totalLabels === 0}>
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/barcode">Back</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left font-semibold px-3 py-2">SKU</th>
                  <th className="text-left font-semibold px-3 py-2">Name</th>
                  <th className="text-left font-semibold px-3 py-2">Size</th>
                  <th className="text-left font-semibold px-3 py-2">Barcode</th>
                  <th className="text-right font-semibold px-3 py-2 w-32">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2 font-mono text-xs">{p.sku}</td>
                    <td className="px-3 py-2">{p.name}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {isShoeProduct(p) ? (p.size ?? '—') : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {p.barcode}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        type="number"
                        min={0}
                        max={500}
                        value={qtyById[p.id] ?? ''}
                        onChange={(e) => setQty(p.id, e.target.value)}
                        className="h-8 w-24 text-right tabular ml-auto"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {products.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No active products with assigned barcodes are available to print.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="label-sheet">
        {labels.map((p, idx) => (
          <div key={`${p.id}-${idx}`} className="label">
            <div className="label-meta">
              <div className="label-meta-line">
                <span className="label-meta-title">SKU Code / Qty :</span>{' '}
                <span className="label-meta-value">
                  {p.sku} ({getQtyLabel(p)})
                </span>
              </div>
            </div>
            <div className="label-name">{p.name.toUpperCase()}</div>
            <div className="label-price">MRP {formatPrice(p.sellPrice)}</div>
            {isShoeProduct(p) && p.size && <div className="label-size">Size {p.size}</div>}
            <div className="label-footer">
              <div className="label-barcode-box">
                <BarcodeSvg value={p.barcode ?? ''} />
                <div className="label-barcode-text">{p.barcode}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .label-sheet {
          display: none;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5mm;
          padding: 6mm;
        }
        .label {
          border: 1.5px solid #111827;
          border-radius: 2px;
          padding: 0;
          min-height: 36mm;
          display: flex;
          flex-direction: column;
          break-inside: avoid;
          background: #fff;
          overflow: hidden;
        }
        .label-meta {
          padding: 5px 8px 4px;
          border-bottom: 1px solid #111827;
        }
        .label-meta-line {
          font-size: 10px;
          line-height: 1.25;
          color: #111827;
          word-break: break-word;
        }
        .label-meta-title {
          font-size: 10px;
          font-weight: 700;
          line-height: 1.1;
          color: #111827;
        }
        .label-meta-value {
          font-size: 10px;
          font-weight: 800;
          line-height: 1.2;
          letter-spacing: 0.02em;
          color: #020617;
          text-transform: uppercase;
        }
        .label-name {
          padding: 6px 8px;
          font-weight: 900;
          font-size: 15px;
          line-height: 1.05;
          letter-spacing: 0.03em;
          color: #020617;
          text-transform: uppercase;
          border-bottom: 1px solid #111827;
          min-height: 34px;
          display: flex;
          align-items: center;
        }
        .label-price {
          padding: 4px 8px;
          border-bottom: 1px solid #111827;
          font-size: 12px;
          font-weight: 800;
          line-height: 1.1;
          color: #020617;
        }
        .label-size {
          padding: 4px 8px;
          border-bottom: 1px solid #111827;
          font-size: 12px;
          font-weight: 800;
          line-height: 1.1;
          color: #020617;
          text-transform: uppercase;
          text-align: center;
        }
        .label-footer {
          display: flex;
        }
        .label-barcode-svg {
          width: 100%;
          height: 38px;
          display: block;
        }
        .label-barcode-box {
          width: 100%;
          padding: 4px 8px 0;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          align-items: center;
        }
        .label-barcode-text {
          font-family: ui-monospace, Menlo, monospace;
          font-size: 9px;
          letter-spacing: 0.08em;
          color: #0f172a;
          text-align: center;
          line-height: 1;
        }
        @media print {
          :global(body) {
            background: #fff !important;
          }
          :global(aside),
          :global(header) {
            display: none !important;
          }
          .label-sheet {
            display: grid;
          }
        }
      `}</style>
    </div>
  );
}
