import { PageHeader } from '@/components/shared/page-header';
import { backendFetch } from '@/lib/backend-client';
import { getSession } from '@/server/auth/session';
import { ChannelManagement, type ChannelItem } from './channel-management';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'E-commerce Channels | Storefronts' };

export default async function EcommerceChannelsPage() {
  const session = await getSession();
  const branchId =
    session?.activeBranchId ??
    session?.defaultBranchId ??
    session?.allowedBranchIds?.[0] ??
    undefined;
  const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
  const channels = await backendFetch<ChannelItem[]>(`/api/mobile/ecommerce/channels${query}`).catch(
    () => [] as ChannelItem[],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="E-commerce Channels"
        description="Connected storefronts, marketplaces, and online sales platforms synced into this branch."
      />

      <ChannelManagement initialChannels={channels} branchId={branchId} />
    </div>
  );
}
