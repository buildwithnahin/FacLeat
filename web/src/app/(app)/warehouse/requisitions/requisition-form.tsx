'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  createStockRequisitionAction,
  type StockRequisitionFormState,
} from '@/server/actions/stock-requisitions';

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm';

type ProductOption = {
  id: string;
  sku: string;
  name: string;
  unit: string;
};

type WarehouseOption = {
  id: string;
  name: string;
  code: string;
};

type Row = {
  key: string;
  productId: string;
  unit: string;
  requestedQty: string;
  note: string;
};

function newRow(): Row {
  return {
    key: `row-${Math.random().toString(36).slice(2, 9)}`,
    productId: '',
    unit: 'PCS',
    requestedQty: '',
    note: '',
  };
}

export function StockRequisitionForm({
  branchId,
  showrooms,
  products,
}: {
  branchId: string;
  showrooms: WarehouseOption[];
  products: ProductOption[];
}) {
  const [state, formAction, pending] = useActionState<StockRequisitionFormState, FormData>(
    createStockRequisitionAction,
    undefined,
  );
  const [rows, setRows] = useState<Row[]>([newRow()]);

  const E = (name: string) => state?.fieldErrors?.[name]?.[0];

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="branchId" value={branchId} />
      <input
        type="hidden"
        name="itemsJson"
        value={JSON.stringify(
          rows
            .filter((row) => row.productId && row.requestedQty)
            .map((row) => ({
              productId: row.productId,
              unit: row.unit,
              requestedQty: row.requestedQty,
              note: row.note,
            })),
        )}
      />

      <Card>
        <CardContent className="grid gap-4 p-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="showroomWarehouseId">Showroom</Label>
            <select
              id="showroomWarehouseId"
              name="showroomWarehouseId"
              required
              defaultValue={showrooms[0]?.id ?? ''}
              className={selectClass}
            >
              {showrooms.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name} ({warehouse.code})
                </option>
              ))}
            </select>
            {E('showroomWarehouseId') && (
              <p className="text-xs text-destructive">{E('showroomWarehouseId')}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <select id="priority" name="priority" defaultValue="MEDIUM" className={selectClass}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="requiredDate">Required date</Label>
            <Input id="requiredDate" name="requiredDate" type="date" required />
            {E('requiredDate') && <p className="text-xs text-destructive">{E('requiredDate')}</p>}
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea id="remarks" name="remarks" rows={3} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Requested products</div>
              <div className="text-xs text-muted-foreground">
                Showroom stock will be updated only after receipt confirmation.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/inventory/products/new">
                  <Plus className="h-3 w-3" />
                  Add product
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRows((current) => [...current, newRow()])}
              >
                <Plus className="h-3 w-3" />
                Add row
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {rows.map((row, index) => (
              <div
                key={row.key}
                className="grid gap-2 md:grid-cols-[2fr_120px_120px_1fr_auto] md:items-end"
              >
                <div>
                  {index === 0 && <Label className="text-xs">Product</Label>}
                  <select
                    value={row.productId}
                    onChange={(event) => {
                      const product = products.find((entry) => entry.id === event.target.value);
                      setRows((current) =>
                        current.map((entry) =>
                          entry.key === row.key
                            ? {
                                ...entry,
                                productId: event.target.value,
                                unit: product?.unit || 'PCS',
                              }
                            : entry,
                        ),
                      );
                    }}
                    className={selectClass}
                  >
                    <option value="">Select product</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.sku} · {product.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  {index === 0 && <Label className="text-xs">Qty</Label>}
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.requestedQty}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((entry) =>
                          entry.key === row.key
                            ? { ...entry, requestedQty: event.target.value }
                            : entry,
                        ),
                      )
                    }
                  />
                </div>
                <div>
                  {index === 0 && <Label className="text-xs">Unit</Label>}
                  <Input value={row.unit} disabled />
                </div>
                <div>
                  {index === 0 && <Label className="text-xs">Note</Label>}
                  <Input
                    value={row.note}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((entry) =>
                          entry.key === row.key ? { ...entry, note: event.target.value } : entry,
                        ),
                      )
                    }
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={rows.length === 1}
                    onClick={() =>
                      setRows((current) => current.filter((entry) => entry.key !== row.key))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {E('items') && <p className="text-xs text-destructive">{E('items')}</p>}
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" variant="dark" disabled={pending}>
          {pending ? 'Submitting…' : 'Submit requisition'}
        </Button>
      </div>
    </form>
  );
}
