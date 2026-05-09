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
  categoryName: string | null;
  // sellPrice: string;
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

  const toPrint: { p: LabelProduct; n: number }[] = [];
  for (const p of products) {
    const n = Math.max(0, Math.min(500, Number(qtyById[p.id] || 0)));
    if (n > 0) toPrint.push({ p, n });
  }

  const labels: LabelProduct[] = toPrint.flatMap(({ p, n }) => Array.from({ length: n }, () => p));
  const totalLabels = labels.length;
  const isShoeProduct = (product: LabelProduct) => product.categoryName?.trim().toLowerCase() === 'shoes';

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
            <div className="label-name">{p.name}</div>
            <div className="label-sku">{p.sku}</div>
            {isShoeProduct(p) && p.size && <div className="label-size">Size {p.size}</div>}
            <BarcodeSvg value={p.barcode ?? ''} />
            <div className="label-barcode-text">{p.barcode}</div>
            {/* <div className="label-price">৳ {p.sellPrice}</div> */}
          </div>
        ))}
      </div>

      <style jsx>{`
        .label-sheet {
          display: none;
          grid-template-columns: repeat(3, 1fr);
          gap: 4mm;
          padding: 8mm;
        }
        .label {
          border: 1px dashed #cbd5e1;
          border-radius: 4px;
          padding: 8px 10px;
          min-height: 32mm;
          display: flex;
          flex-direction: column;
          gap: 4px;
          break-inside: avoid;
          background: #fff;
        }
        .label-name {
          font-weight: 600;
          font-size: 11px;
          line-height: 1.2;
          color: #0f172a;
        }
        .label-sku {
          font-family: ui-monospace, Menlo, monospace;
          font-size: 10px;
          color: #64748b;
        }
        .label-size {
          font-size: 10px;
          font-weight: 600;
          color: #0f172a;
        }
        .label-barcode-svg {
          width: 100%;
          height: 34px;
          display: block;
          margin-top: 2px;
        }
        .label-barcode-text {
          font-family: ui-monospace, Menlo, monospace;
          font-size: 9px;
          letter-spacing: 0.8px;
          color: #0f172a;
          text-align: center;
        }
        .label-price {
          font-weight: 700;
          font-size: 12px;
          color: #1e40af;
          text-align: right;
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
          .label {
            border-color: #000;
          }
        }
      `}</style>
    </div>
  );
}
