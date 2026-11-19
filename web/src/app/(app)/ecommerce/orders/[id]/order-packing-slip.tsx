'use client';

import { useState } from 'react';
import { Printer, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { formatCurrency, type CurrencyCode } from '@/lib/money';
import { toast } from 'sonner';

interface OrderItemSlip {
  id: string;
  name: string;
  sku: string;
  quantity: string | number;
  unitPrice: string | number;
  lineTotal: string | number;
}

interface PackingSlipProps {
  order: {
    number: string;
    orderDate: string;
    channelName: string;
    customerName: string | null;
    customerPhone: string | null;
    shipToAddress: string | null;
    courier: string | null;
    trackingNo: string | null;
    notes: string | null;
    currency: CurrencyCode;
    items: OrderItemSlip[];
    subtotal: string;
    discountTotal: string;
    shippingTotal: string;
    taxTotal: string;
    grandTotal: string;
    paidTotal?: string;
  };
}

export function OrderPackingSlip({ order }: PackingSlipProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const grandTotal = Number(order.grandTotal) || 0;
  const paidTotal = Number(order.paidTotal) || 0;
  const codDue = Math.max(0, grandTotal - paidTotal);

  const handleCopyAddress = () => {
    const text = [
      order.customerName,
      order.customerPhone,
      order.shipToAddress,
    ]
      .filter(Boolean)
      .join('\n');

    if (text) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Customer address copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 shadow-sm">
            <Printer className="h-4 w-4" /> Packing Slip / Invoice
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="p-4 border-b flex flex-row items-center justify-between no-print">
            <DialogTitle className="text-base font-semibold">
              Packing Slip & Invoice — {order.number}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyAddress}
                className="gap-1 text-xs"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                Copy Dispatch Address
              </Button>
              <Button size="sm" onClick={handlePrint} className="gap-1.5">
                <Printer className="h-4 w-4" /> Print Document
              </Button>
            </div>
          </DialogHeader>

          {/* Printable Sheet Body */}
          <div id="printable-order-slip" className="p-8 text-black bg-white space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start border-b pb-4">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-neutral-900">
                  ANNEX LEATHER
                </h1>
                <p className="text-xs text-neutral-500 font-medium mt-0.5">
                  Premium Leather Goods & Accessories
                </p>
                <p className="text-xs text-neutral-500">Dhaka, Bangladesh · support@annexleather.com</p>
              </div>
              <div className="text-right">
                <div className="inline-block border-2 border-neutral-800 px-3 py-1 text-xs font-bold uppercase tracking-wider mb-1">
                  Delivery Challan & Invoice
                </div>
                <p className="text-sm font-mono font-bold text-neutral-800">
                  Order: {order.number}
                </p>
                <p className="text-xs text-neutral-500">
                  Date: {new Date(order.orderDate).toISOString().slice(0, 10)}
                </p>
                <p className="text-xs text-neutral-500">Channel: {order.channelName}</p>
              </div>
            </div>

            {/* Courier & COD Highlight Badge */}
            <div className="grid grid-cols-2 gap-4 bg-neutral-50 p-4 rounded-md border border-neutral-200">
              <div>
                <p className="text-[11px] font-bold uppercase text-neutral-500">Courier Logistics</p>
                <p className="text-sm font-semibold text-neutral-900 mt-0.5">
                  {order.courier ? order.courier : 'Standard Delivery'}
                </p>
                {order.trackingNo && (
                  <p className="text-xs font-mono text-neutral-600">
                    Tracking #: <strong>{order.trackingNo}</strong>
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-[11px] font-bold uppercase text-neutral-500">
                  Payment Collection Mode
                </p>
                {codDue > 0 ? (
                  <div className="mt-0.5">
                    <span className="inline-block bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2.5 py-0.5 rounded text-xs">
                      CASH ON DELIVERY (COD)
                    </span>
                    <p className="text-sm font-black text-neutral-900 mt-1">
                      Collect: {formatCurrency(codDue, order.currency)}
                    </p>
                  </div>
                ) : (
                  <div className="mt-0.5">
                    <span className="inline-block bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold px-2.5 py-0.5 rounded text-xs">
                      PREPAID / SETTLED
                    </span>
                    <p className="text-xs text-neutral-600 mt-1">No COD to collect</p>
                  </div>
                )}
              </div>
            </div>

            {/* Customer & Shipping Details */}
            <div className="grid grid-cols-2 gap-6 border-b pb-4 text-xs">
              <div>
                <p className="font-bold uppercase text-neutral-500 mb-1">Customer / Consignee</p>
                <p className="text-sm font-bold text-neutral-900">
                  {order.customerName || 'Walk-in / Valued Client'}
                </p>
                {order.customerPhone && (
                  <p className="text-neutral-700 font-mono text-xs mt-0.5 font-semibold">
                    Phone: {order.customerPhone}
                  </p>
                )}
              </div>
              <div>
                <p className="font-bold uppercase text-neutral-500 mb-1">Delivery Destination</p>
                <p className="text-neutral-800 whitespace-pre-wrap leading-relaxed font-medium">
                  {order.shipToAddress || 'Pickup / Address not specified'}
                </p>
                {order.notes && (
                  <p className="text-neutral-500 italic mt-1">
                    Customer note: &ldquo;{order.notes}&rdquo;
                  </p>
                )}
              </div>
            </div>

            {/* Line Items Table */}
            <div>
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-neutral-800 text-[11px] uppercase tracking-wider text-neutral-600">
                    <th className="py-2 pr-2">SL</th>
                    <th className="py-2 pr-4">Item & SKU</th>
                    <th className="py-2 px-2 text-right">Qty</th>
                    <th className="py-2 px-2 text-right">Rate</th>
                    <th className="py-2 pl-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {order.items.map((item, idx) => (
                    <tr key={item.id} className="py-2">
                      <td className="py-2 pr-2 text-neutral-400 font-mono">{idx + 1}</td>
                      <td className="py-2 pr-4">
                        <p className="font-semibold text-neutral-900">{item.name}</p>
                        <p className="font-mono text-[10px] text-neutral-500">SKU: {item.sku}</p>
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-bold">{item.quantity}</td>
                      <td className="py-2 px-2 text-right font-mono text-neutral-700">
                        {formatCurrency(item.unitPrice, order.currency)}
                      </td>
                      <td className="py-2 pl-2 text-right font-mono font-semibold text-neutral-900">
                        {formatCurrency(item.lineTotal, order.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pricing Summary */}
            <div className="flex justify-end pt-2 border-t">
              <div className="w-64 space-y-1.5 text-xs">
                <div className="flex justify-between text-neutral-600">
                  <span>Subtotal:</span>
                  <span className="font-mono">{formatCurrency(order.subtotal, order.currency)}</span>
                </div>
                {Number(order.discountTotal) > 0 && (
                  <div className="flex justify-between text-neutral-600">
                    <span>Discount:</span>
                    <span className="font-mono">
                      −{formatCurrency(order.discountTotal, order.currency)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-neutral-600">
                  <span>Shipping Fee:</span>
                  <span className="font-mono">{formatCurrency(order.shippingTotal, order.currency)}</span>
                </div>
                {Number(order.taxTotal) > 0 && (
                  <div className="flex justify-between text-neutral-600">
                    <span>Tax / VAT:</span>
                    <span className="font-mono">{formatCurrency(order.taxTotal, order.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-neutral-900 border-t pt-1.5">
                  <span>Grand Total:</span>
                  <span className="font-mono">{formatCurrency(order.grandTotal, order.currency)}</span>
                </div>
                {paidTotal > 0 && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Paid Total:</span>
                    <span className="font-mono">{formatCurrency(paidTotal, order.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm bg-neutral-100 p-1.5 rounded text-neutral-900 border">
                  <span>Payable / COD:</span>
                  <span className="font-mono">{formatCurrency(codDue, order.currency)}</span>
                </div>
              </div>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 pt-12 text-xs">
              <div className="border-t border-neutral-300 pt-2 text-center">
                <p className="font-semibold text-neutral-700">Packed & Dispatched By</p>
                <p className="text-[10px] text-neutral-400">Annex Warehouse Logistics</p>
              </div>
              <div className="border-t border-neutral-300 pt-2 text-center">
                <p className="font-semibold text-neutral-700">Received By / Customer Sign</p>
                <p className="text-[10px] text-neutral-400">Date & Signature</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Global Print Style for Packing Slip */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-order-slip,
          #printable-order-slip * {
            visibility: visible;
          }
          #printable-order-slip {
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            padding: 20mm;
            margin: 0;
            background: white !important;
            color: black !important;
            font-size: 11pt;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
