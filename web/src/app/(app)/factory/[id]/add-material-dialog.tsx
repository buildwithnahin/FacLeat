'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { addProductionMaterialAction } from '@/server/actions/factory';
import { UNITS, PRODUCTION_MATERIAL_TYPES } from '@/server/validators/factory';

interface ProductItem {
  id: string;
  name: string;
  sku: string;
  unit: string;
  costPrice: string;
  type: string;
}

interface WarehouseItem {
  id: string;
  code: string;
  name: string;
}

export function AddMaterialDialog({
  orderId,
  products,
  warehouses,
  disabled,
}: {
  orderId: string;
  products: ProductItem[];
  warehouses: WarehouseItem[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? '');
  const [unit, setUnit] = useState(products[0]?.unit ?? 'PCS');
  const [plannedQty, setPlannedQty] = useState('');
  const [unitCost, setUnitCost] = useState(products[0]?.costPrice?.toString() ?? '0');
  const [materialType, setMaterialType] = useState('OTHER');
  const [fromWarehouseId, setFromWarehouseId] = useState(warehouses[0]?.id ?? '');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) {
      if (!selectedProductId && products.length > 0 && products[0]) {
        setSelectedProductId(products[0].id ?? '');
        setUnit(products[0].unit ?? 'PCS');
        setUnitCost(products[0].costPrice?.toString() ?? '0');
      }
      if (!fromWarehouseId && warehouses.length > 0 && warehouses[0]) {
        setFromWarehouseId(warehouses[0].id ?? '');
      }
    }
  }, [open, products, warehouses, selectedProductId, fromWarehouseId]);

  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);
    const prod = products.find((p) => p.id === productId);
    if (prod) {
      setUnit(prod.unit || 'PCS');
      setUnitCost(prod.costPrice || '0');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set('orderId', orderId);
    formData.set('productId', selectedProductId);
    formData.set('unit', unit);
    formData.set('plannedQty', plannedQty);
    formData.set('unitCost', unitCost);
    formData.set('materialType', materialType);
    formData.set('fromWarehouseId', fromWarehouseId);
    formData.set('note', note);

    startTransition(async () => {
      const res = await addProductionMaterialAction(undefined, formData);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setOpen(false);
      setPlannedQty('');
      setNote('');
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="gap-1.5 h-8">
          <Plus className="h-3.5 w-3.5" />
          Add material
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Material to BOM</DialogTitle>
            <DialogDescription>
              Add a raw material, consumable, or component needed for this production run.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="mt-3 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid gap-3 py-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Product / Raw Material</Label>
              <select
                value={selectedProductId ?? ''}
                onChange={(e) => handleProductChange(e.target.value)}
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Select product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku}) · Cost: {Number(p.costPrice).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Planned quantity</Label>
                <Input
                  type="number"
                  min="0.0001"
                  step="any"
                  value={plannedQty ?? ''}
                  onChange={(e) => setPlannedQty(e.target.value)}
                  placeholder="e.g. 10"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Unit of measure</Label>
                <select
                  value={unit ?? 'PCS'}
                  onChange={(e) => setUnit(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Unit cost</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={unitCost ?? ''}
                  onChange={(e) => setUnitCost(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Material type</Label>
                <select
                  value={materialType ?? 'OTHER'}
                  onChange={(e) => setMaterialType(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  {PRODUCTION_MATERIAL_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Source warehouse</Label>
              <select
                value={fromWarehouseId ?? ''}
                onChange={(e) => setFromWarehouseId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Default warehouse (optional)</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Note (optional)</Label>
              <Textarea
                rows={2}
                value={note ?? ''}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional notes or cutting instructions"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !selectedProductId || !plannedQty}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Add Material'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
