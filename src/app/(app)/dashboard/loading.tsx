import { Card } from '@/components/ui/card';

export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-64 rounded-md bg-muted" />
          <div className="h-4 w-96 max-w-full rounded-md bg-muted" />
        </div>
        <div className="h-8 w-32 rounded-md bg-muted" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="p-5 space-y-3">
            <div className="h-4 w-28 rounded bg-muted" />
            <div className="h-8 w-24 rounded bg-muted" />
            <div className="h-3 w-36 rounded bg-muted" />
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} className="p-5 space-y-3">
            <div className="h-5 w-32 rounded bg-muted" />
            {Array.from({ length: 4 }).map((__, rowIndex) => (
              <div key={rowIndex} className="space-y-2">
                <div className="h-4 w-40 rounded bg-muted" />
                <div className="h-3 w-52 rounded bg-muted" />
              </div>
            ))}
          </Card>
        ))}
      </div>

      <Card className="p-5 space-y-3">
        <div className="h-5 w-40 rounded bg-muted" />
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <div className="h-4 w-56 rounded bg-muted" />
            <div className="h-3 w-72 rounded bg-muted" />
          </div>
        ))}
      </Card>
    </div>
  );
}
