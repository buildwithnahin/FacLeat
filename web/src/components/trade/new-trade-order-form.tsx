'use client';

import { useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Trash2, RefreshCw, Calculator } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { createTradeOrderSchema } from '@/server/validators/trade';
import { createTradeOrder } from '@/server/actions/trade';

type FormValues = z.infer<typeof createTradeOrderSchema>;

export interface TradeProductOption {
  id: string;
  sku: string;
  name: string;
  unit: string;
  sellPrice: string | number;
  costPrice: string | number;
  type?: string;
}

interface Props {
  defaultBranchId: string;
  branches: { id: string; name: string; code: string }[];
  customers: { id: string; name: string; code: string }[];
  suppliers: { id: string; name: string; code: string }[];
  products?: TradeProductOption[];
}

const CURRENCIES = ['USD', 'EUR', 'BDT', 'INR'] as const;
const INCOTERMS = ['EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'DAP', 'DDP', 'CPT', 'CIP', 'FAS'];

export function NewTradeOrderForm({
  defaultBranchId,
  branches,
  customers,
  suppliers,
  products = [],
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const form = useForm<FormValues>({
    resolver: zodResolver(createTradeOrderSchema),
    defaultValues: {
      branchId: defaultBranchId,
      type: 'EXPORT',
      customerId: '',
      supplierId: '',
      contractRef: '',
      currency: 'USD',
      exchangeRate: 122,
      incoterms: '',
      portOfLoading: '',
      portOfDischarge: '',
      goodsDescription: '',
      notes: '',
      items: [
        {
          productId: '',
          description: '',
          hsCode: '',
          quantity: 1,
          unitPrice: 0,
          unit: 'PCS',
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' });
  const orderType = form.watch('type');
  const currentCurrency = form.watch('currency');
  const currentExchangeRate = form.watch('exchangeRate') || 1;

  function handleProductSelect(idx: number, productId: string) {
    form.setValue(`items.${idx}.productId`, productId);
    if (!productId) return;
    const prod = productMap.get(productId);
    if (!prod) return;

    form.setValue(`items.${idx}.description`, prod.name);
    form.setValue(`items.${idx}.unit`, prod.unit || 'PCS');

    const rate = Number(form.getValues('exchangeRate')) || 1;
    const cur = form.getValues('currency');
    const basePrice = Number(prod.sellPrice) || 0;

    let convertedPrice = basePrice;
    if (cur !== 'BDT' && rate > 0) {
      convertedPrice = Number((basePrice / rate).toFixed(2));
    }
    form.setValue(`items.${idx}.unitPrice`, convertedPrice);
  }

  function recalculateAllPrices() {
    const rate = Number(form.getValues('exchangeRate')) || 1;
    const cur = form.getValues('currency');
    const items = form.getValues('items') || [];

    let count = 0;
    items.forEach((it, idx) => {
      if (it.productId && productMap.has(it.productId)) {
        const prod = productMap.get(it.productId)!;
        const basePrice = Number(prod.sellPrice) || 0;
        let convertedPrice = basePrice;
        if (cur !== 'BDT' && rate > 0) {
          convertedPrice = Number((basePrice / rate).toFixed(2));
        }
        form.setValue(`items.${idx}.unitPrice`, convertedPrice);
        count++;
      }
    });

    if (count > 0) {
      toast.success(`Converted ${count} item price(s) to ${cur} at rate ${rate}`);
    } else {
      toast.info('No catalog products selected in line items to recalculate.');
    }
  }

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const res = await createTradeOrder(values);
      if (res.success) {
        toast.success('Trade order created');
        router.push(`/trade/orders/${res.data.id}`);
      } else {
        toast.error(res.error ?? 'Failed to create order');
      }
    });
  }

  const totalValue = (form.watch('items') ?? []).reduce(
    (sum, it) => sum + (it.quantity || 0) * (it.unitPrice || 0),
    0,
  );
  const totalLocalBDT = totalValue * Number(currentExchangeRate);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Order Details & Commercial Terms</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="branchId" render={({ field }) => (
              <FormItem>
                <FormLabel>Branch</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel>Order Type</FormLabel>
                <Select
                  onValueChange={(val) => {
                    field.onChange(val);
                    if (val === 'EXPORT') {
                      form.setValue('supplierId', '');
                    } else {
                      form.setValue('customerId', '');
                    }
                  }}
                  value={field.value}
                >
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="EXPORT">Export</SelectItem>
                    <SelectItem value="IMPORT">Import</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {orderType === 'EXPORT' ? (
              <FormField control={form.control} name="customerId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer (Buyer)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            ) : (
              <FormField control={form.control} name="supplierId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Supplier (Seller)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            <FormField control={form.control} name="contractRef" render={({ field }) => (
              <FormItem>
                <FormLabel>Contract Reference / PI No.</FormLabel>
                <FormControl><Input placeholder="CONTRACT-001 or PI-2026-001" {...field} value={field.value ?? ''} /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="currency" render={({ field }) => (
              <FormItem>
                <FormLabel>Trade Currency</FormLabel>
                <Select
                  onValueChange={(val) => {
                    field.onChange(val);
                    const currentRate = Number(form.getValues('exchangeRate'));
                    let newRate = currentRate;
                    if (val === 'USD' && (currentRate === 1 || !currentRate)) newRate = 122;
                    else if (val === 'EUR' && (currentRate === 1 || !currentRate)) newRate = 132;
                    else if (val === 'INR' && (currentRate === 1 || !currentRate)) newRate = 1.45;
                    else if (val === 'BDT') newRate = 1;
                    form.setValue('exchangeRate', newRate);
                  }}
                  value={field.value}
                >
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />

            <FormField control={form.control} name="exchangeRate" render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Exchange Rate (1 {currentCurrency} = ? BDT)</FormLabel>
                  {fields.some((f) => f.productId) && (
                    <button
                      type="button"
                      onClick={recalculateAllPrices}
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Recalculate Prices
                    </button>
                  )}
                </div>
                <FormControl>
                  <Input type="number" step="0.0001" min="0.0001" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="incoterms" render={({ field }) => (
              <FormItem>
                <FormLabel>Incoterms</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ''}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select incoterms" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {INCOTERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />

            <FormField control={form.control} name="portOfLoading" render={({ field }) => (
              <FormItem>
                <FormLabel>Port of Loading</FormLabel>
                <FormControl><Input placeholder="e.g. Chittagong Port, Bangladesh" {...field} value={field.value ?? ''} /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="portOfDischarge" render={({ field }) => (
              <FormItem>
                <FormLabel>Port of Discharge</FormLabel>
                <FormControl><Input placeholder="e.g. Port of Hamburg, Germany" {...field} value={field.value ?? ''} /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="latestShipDate" render={({ field }) => (
              <FormItem>
                <FormLabel>Latest Shipment Date</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    value={field.value instanceof Date ? field.value.toISOString().slice(0, 10) : ''}
                    onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                  />
                </FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="expectedArrival" render={({ field }) => (
              <FormItem>
                <FormLabel>Expected Arrival Date</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    value={field.value instanceof Date ? field.value.toISOString().slice(0, 10) : ''}
                    onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                  />
                </FormControl>
              </FormItem>
            )} />

            <div className="md:col-span-2">
              <FormField control={form.control} name="goodsDescription" render={({ field }) => (
                <FormItem>
                  <FormLabel>Goods Description</FormLabel>
                  <FormControl><Textarea rows={2} placeholder="Leather goods, finished wallets, cow crust leather..." {...field} value={field.value ?? ''} /></FormControl>
                </FormItem>
              )} />
            </div>

            <div className="md:col-span-2">
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Special Instructions / Notes</FormLabel>
                  <FormControl><Textarea rows={2} placeholder="Packaging specifications, inspection terms..." {...field} value={field.value ?? ''} /></FormControl>
                </FormItem>
              )} />
            </div>
          </CardContent>
        </Card>

        {/* LINE ITEMS */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm font-semibold">Line Items (Products Breakdown)</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Select from catalog products to auto-fill description and convert price to {currentCurrency}, or enter custom items manually.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {fields.some((f) => f.productId) && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={recalculateAllPrices}
                  className="h-8 text-xs"
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Recalculate Prices
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={() =>
                  append({
                    productId: '',
                    description: '',
                    hsCode: '',
                    quantity: 1,
                    unitPrice: 0,
                    unit: 'PCS',
                  })
                }
                className="h-8 text-xs"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Line
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, idx) => (
              <div key={field.id} className="p-3.5 border rounded-lg bg-card/60 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  {/* Product Catalog Dropdown */}
                  <div className="md:col-span-5">
                    <FormField control={form.control} name={`items.${idx}.productId`} render={({ field: pField }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-foreground">
                          {idx === 0 ? 'Select Catalog Product' : 'Catalog Product'}
                        </FormLabel>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                          value={pField.value ?? ''}
                          onChange={(e) => {
                            pField.onChange(e.target.value);
                            handleProductSelect(idx, e.target.value);
                          }}
                        >
                          <option value="">— Custom / Manual Entry —</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.sku} • {p.name} (৳{Number(p.sellPrice).toLocaleString()})
                            </option>
                          ))}
                        </select>
                      </FormItem>
                    )} />
                  </div>

                  {/* Description / Item Name */}
                  <div className="md:col-span-5">
                    <FormField control={form.control} name={`items.${idx}.description`} render={({ field: dField }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-foreground">
                          Item Description <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Leather Bag, Wallet..." {...dField} value={dField.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  {/* Delete Button */}
                  <div className="md:col-span-2 flex justify-end">
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 text-xs h-9 px-2"
                        onClick={() => remove(idx)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Remove
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-12 gap-3 items-end pt-2 border-t border-border/40">
                  {/* HS Code */}
                  <div className="col-span-1 md:col-span-3">
                    <FormField control={form.control} name={`items.${idx}.hsCode`} render={({ field: hField }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">HS Code</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 4202.11" {...hField} value={hField.value ?? ''} />
                        </FormControl>
                      </FormItem>
                    )} />
                  </div>

                  {/* Quantity & Unit */}
                  <div className="col-span-1 md:col-span-3">
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <FormField control={form.control} name={`items.${idx}.quantity`} render={({ field: qField }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">Quantity</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.001" min="0.001" {...qField} value={qField.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <div className="w-20">
                        <FormField control={form.control} name={`items.${idx}.unit`} render={({ field: uField }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">Unit</FormLabel>
                            <FormControl>
                              <Input placeholder="PCS" {...uField} value={uField.value ?? 'PCS'} />
                            </FormControl>
                          </FormItem>
                        )} />
                      </div>
                    </div>
                  </div>

                  {/* Unit Price */}
                  <div className="col-span-1 md:col-span-3">
                    <FormField control={form.control} name={`items.${idx}.unitPrice`} render={({ field: pField }) => {
                      const prodId = form.watch(`items.${idx}.productId`);
                      const selProd = prodId ? productMap.get(prodId) : null;
                      const enteredPrice = Number(pField.value) || 0;
                      const approxBDT = enteredPrice * Number(currentExchangeRate);

                      return (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">
                            Unit Price ({currentCurrency})
                          </FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" min="0" {...pField} value={pField.value ?? ''} />
                          </FormControl>
                          <div className="text-[11px] text-muted-foreground tabular-nums flex items-center justify-between mt-0.5">
                            {currentCurrency !== 'BDT' && Number(currentExchangeRate) > 1 && (
                              <span>≈ ৳{approxBDT.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT</span>
                            )}
                            {selProd && (
                              <span className="text-primary font-medium">Base: ৳{Number(selProd.sellPrice).toLocaleString()}</span>
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      );
                    }} />
                  </div>

                  {/* Line Total */}
                  <div className="col-span-1 md:col-span-3 flex flex-col justify-end">
                    <span className="text-xs text-muted-foreground mb-1">Line Total</span>
                    <div className="h-9 px-3 flex items-center rounded-md border bg-muted/40 font-semibold tabular-nums text-sm">
                      {((form.watch(`items.${idx}.quantity`) || 0) * (form.watch(`items.${idx}.unitPrice`) || 0)).toFixed(2)} {currentCurrency}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* TOTAL VALUATION SUMMARY */}
            <div className="flex flex-col sm:flex-row items-end justify-between gap-3 pt-3 border-t">
              <div className="text-xs text-muted-foreground">
                Exchange Rate: <strong>1 {currentCurrency} = {currentExchangeRate} BDT</strong>
              </div>
              <div className="text-right space-y-1">
                <p className="text-base font-bold tabular-nums">
                  Total Order Value: {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currentCurrency}
                </p>
                {currentCurrency !== 'BDT' && Number(currentExchangeRate) > 1 && (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Equivalent in Local Currency: <strong>৳ {totalLocalBDT.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT</strong>
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={pending}>
            <Calculator className="mr-1.5 h-4 w-4" />
            Create Trade Order
          </Button>
        </div>
      </form>
    </Form>
  );
}
