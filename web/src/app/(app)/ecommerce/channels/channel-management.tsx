'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Globe,
  Plus,
  Power,
  Store,
  Layers,
  CheckCircle2,
  XCircle,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pill, type PillTone } from '@/components/shared/pill';
import {
  createEcommerceChannelAction,
  toggleEcommerceChannelAction,
} from '@/server/actions/ecommerce';

const TYPE_TONE: Record<string, PillTone> = {
  SHOPIFY: 'green',
  WOOCOMMERCE: 'blue',
  FACEBOOK: 'blue',
  DARAZ: 'amber',
  MANUAL: 'grey',
  OTHER: 'grey',
};

export interface ChannelItem {
  id: string;
  name: string;
  code: string;
  type: string;
  storeUrl: string | null;
  isActive: boolean;
  lastSyncAt: string | null;
}

interface ChannelManagementProps {
  initialChannels: ChannelItem[];
  branchId?: string;
}

export function ChannelManagement({ initialChannels, branchId }: ChannelManagementProps) {
  const router = useRouter();
  const [channels, setChannels] = useState<ChannelItem[]>(initialChannels);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState<string>('SHOPIFY');
  const [storeUrl, setStoreUrl] = useState('');

  const activeCount = channels.filter((c) => c.isActive).length;
  const inactiveCount = channels.length - activeCount;
  const uniqueTypes = new Set(channels.map((c) => c.type)).size;

  const handleNameChange = (val: string) => {
    setName(val);
    if (!code || code === name.toUpperCase().replace(/[^A-Z0-9]/g, '_')) {
      setCode(val.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 24));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      toast.error('Channel name and unique code are required');
      return;
    }
    if (!branchId) {
      toast.error('Branch context is missing. Please select an active branch.');
      return;
    }

    startTransition(async () => {
      const res = await createEcommerceChannelAction({
        branchId,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        type,
        storeUrl: storeUrl.trim() || undefined,
      });

      if (res.success) {
        toast.success(`Channel "${name}" created successfully`);
        setIsOpen(false);
        setName('');
        setCode('');
        setStoreUrl('');
        setType('SHOPIFY');
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to create channel');
      }
    });
  };

  const handleToggle = async (channelId: string, currentStatus: boolean, channelName: string) => {
    setTogglingId(channelId);
    try {
      const res = await toggleEcommerceChannelAction(channelId);
      if (res.success) {
        setChannels((prev) =>
          prev.map((c) => (c.id === channelId ? { ...c, isActive: !c.isActive } : c)),
        );
        toast.success(
          `Channel "${channelName}" is now ${currentStatus ? 'deactivated' : 'activated'}.`,
        );
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to toggle status');
      }
    } catch {
      toast.error('An unexpected error occurred while toggling status');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Storefronts
            </p>
            <p className="text-2xl font-bold mt-1">{channels.length}</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Store className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Active Syncing
            </p>
            <p className="text-2xl font-bold mt-1 text-emerald-600">{activeCount}</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Paused / Inactive
            </p>
            <p className="text-2xl font-bold mt-1 text-amber-600">{inactiveCount}</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
            <XCircle className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Channel Types
            </p>
            <p className="text-2xl font-bold mt-1">{uniqueTypes}</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
            <Layers className="h-5 w-5" />
          </div>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="p-0 overflow-hidden shadow-sm border">
        <div className="px-5 py-4 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-muted/20">
          <div>
            <h3 className="font-semibold text-base">Storefront & Channel Configuration</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage connected online sales channels, automated sync hooks, and storefront availability.
            </p>
          </div>

          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 shadow-sm">
                <Plus className="h-4 w-4" /> Add Channel
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>Add New Sales Channel</DialogTitle>
                  <DialogDescription>
                    Connect a new e-commerce storefront or marketplace to sync orders directly into your branch inventory.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="channelName">Channel / Storefront Name</Label>
                    <Input
                      id="channelName"
                      placeholder="e.g. Annex Leather Official Shopify"
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="channelCode">Unique Code</Label>
                      <Input
                        id="channelCode"
                        placeholder="SHOPIFY_MAIN"
                        className="font-mono text-xs uppercase"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="channelType">Platform Type</Label>
                      <Select value={type} onValueChange={setType}>
                        <SelectTrigger id="channelType">
                          <SelectValue placeholder="Select platform" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SHOPIFY">Shopify</SelectItem>
                          <SelectItem value="WOOCOMMERCE">WooCommerce</SelectItem>
                          <SelectItem value="DARAZ">Daraz</SelectItem>
                          <SelectItem value="FACEBOOK">Facebook / Meta</SelectItem>
                          <SelectItem value="MANUAL">Manual Storefront</SelectItem>
                          <SelectItem value="OTHER">Other / Custom API</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="storeUrl">Storefront URL (Optional)</Label>
                    <Input
                      id="storeUrl"
                      type="url"
                      placeholder="https://annexleather.com"
                      value={storeUrl}
                      onChange={(e) => setStoreUrl(e.target.value)}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isPending} className="gap-1.5">
                    {isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" /> Saving...
                      </>
                    ) : (
                      'Save Channel'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {channels.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Globe className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-medium text-foreground">No online channels configured yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Add your Shopify, Daraz, or custom website channel above, or they will be registered automatically upon the first synced order.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs uppercase font-medium border-b">
                <tr>
                  <th className="px-5 py-3">Storefront / Name</th>
                  <th className="px-5 py-3">Code</th>
                  <th className="px-5 py-3">Platform</th>
                  <th className="px-5 py-3">Store URL</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Last Order Synced</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {channels.map((ch) => {
                  const isToggling = togglingId === ch.id;
                  return (
                    <tr key={ch.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span>{ch.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">
                        {ch.code}
                      </td>
                      <td className="px-5 py-3.5">
                        <Pill tone={TYPE_TONE[ch.type] ?? 'grey'}>{ch.type}</Pill>
                      </td>
                      <td className="px-5 py-3.5">
                        {ch.storeUrl ? (
                          <a
                            href={ch.storeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                          >
                            <span>{ch.storeUrl.replace(/^https?:\/\//, '')}</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={ch.isActive ? 'success' : 'outline'}>
                          {ch.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground tabular">
                        {ch.lastSyncAt ? (
                          new Date(ch.lastSyncAt).toISOString().slice(0, 16).replace('T', ' ')
                        ) : (
                          <span className="text-muted-foreground/50">Never</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Button
                          variant={ch.isActive ? 'outline' : 'default'}
                          size="sm"
                          className="h-8 gap-1.5 text-xs"
                          disabled={isToggling}
                          onClick={() => handleToggle(ch.id, ch.isActive, ch.name)}
                        >
                          {isToggling ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Power className="h-3.5 w-3.5" />
                          )}
                          {ch.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
