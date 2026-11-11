import { PageHeader } from '@/components/shared/page-header';
import { backendFetch } from '@/lib/backend-client';
import { UploadForm } from './upload-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Upload document' };

interface Branch {
  id: string;
  name: string;
  code: string;
}

export default async function NewDocumentPage() {
  const branches = await backendFetch<Branch[]>('/api/mobile/branches');
  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Upload Document" description="Drop a file and tag it for later retrieval" />
      <UploadForm branches={branches} />
    </div>
  );
}
