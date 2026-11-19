'use client';

import { useState } from 'react';
import { Tag, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface AssetTagProps {
  asset: {
    code: string;
    name: string;
    serialNumber: string | null;
    categoryName: string;
    branchName: string;
    location: string | null;
    assignedTo: string | null;
    purchaseDate: string;
  };
}

export function AssetTagModal({ asset }: AssetTagProps) {
  const [open, setOpen] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 shadow-sm text-xs">
            <Tag className="h-3.5 w-3.5" /> Print Asset Tag
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md p-0">
          <DialogHeader className="p-4 border-b flex flex-row items-center justify-between no-print">
            <DialogTitle className="text-base font-semibold">
              Asset Tag Label — {asset.code}
            </DialogTitle>
            <Button size="sm" onClick={handlePrint} className="gap-1.5 text-xs">
              <Printer className="h-3.5 w-3.5" /> Print Tag
            </Button>
          </DialogHeader>

          {/* Printable Tag Container */}
          <div className="p-6 flex justify-center bg-muted/20">
            <div
              id="printable-asset-tag"
              className="w-[320px] bg-white border-2 border-neutral-900 rounded-md p-4 text-black shadow-sm font-sans"
            >
              <div className="border-b-2 border-neutral-900 pb-2 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-600">
                  Fixed Asset Inventory
                </p>
                <h2 className="text-base font-black tracking-tight text-neutral-900">
                  ANNEX LEATHER
                </h2>
              </div>

              <div className="py-3 text-center">
                <p className="text-2xl font-mono font-black tracking-wider text-neutral-900">
                  {asset.code}
                </p>
                {/* Visual Barcode bars representation */}
                <div className="flex justify-center items-center gap-[2px] h-8 my-2">
                  {[4, 2, 5, 1, 3, 6, 2, 4, 1, 5, 2, 3, 6, 1, 4, 2, 5, 3, 1, 6, 2, 4, 3, 5, 1, 2, 6, 3, 4, 2, 1, 5].map(
                    (h, i) => (
                      <div
                        key={i}
                        className="bg-neutral-900"
                        style={{
                          width: i % 3 === 0 ? '3px' : '1.5px',
                          height: `${18 + (h % 3) * 6}px`,
                        }}
                      />
                    ),
                  )}
                </div>
                <p className="text-xs font-semibold text-neutral-800 line-clamp-1">{asset.name}</p>
              </div>

              <div className="border-t border-neutral-300 pt-2 space-y-1 text-[11px] text-neutral-700">
                <div className="flex justify-between">
                  <span className="text-neutral-500 font-medium">Category:</span>
                  <span className="font-semibold text-neutral-900">{asset.categoryName}</span>
                </div>
                {asset.serialNumber && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500 font-medium">Serial #:</span>
                    <span className="font-mono text-neutral-900">{asset.serialNumber}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-neutral-500 font-medium">Branch:</span>
                  <span className="text-neutral-900">{asset.branchName}</span>
                </div>
                {asset.location && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500 font-medium">Location:</span>
                    <span className="text-neutral-900">{asset.location}</span>
                  </div>
                )}
                {asset.assignedTo && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500 font-medium">Custodian:</span>
                    <span className="text-neutral-900">{asset.assignedTo}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-neutral-900 mt-3 pt-1.5 text-center">
                <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">
                  Property of Annex Leather · Do Not Remove
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-asset-tag,
          #printable-asset-tag * {
            visibility: visible;
          }
          #printable-asset-tag {
            position: fixed;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 80mm;
            border: 2px solid black;
            padding: 4mm;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
