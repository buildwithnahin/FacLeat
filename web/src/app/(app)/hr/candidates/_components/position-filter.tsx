'use client';

interface Props {
  defaultValue: string;
  filterStatus?: string;
  recruitmentRequests: Array<{ id: string; title: string }>;
}

export function PositionFilter({ defaultValue, filterStatus, recruitmentRequests }: Props) {
  return (
    <select
      defaultValue={defaultValue}
      onChange={(e) => {
        const val = e.target.value;
        const base = `/hr/candidates${filterStatus ? `?status=${filterStatus}` : ''}`;
        window.location.href = val ? `${base}${filterStatus ? '&' : '?'}reqId=${val}` : base;
      }}
      className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
    >
      <option value="">All Job Positions</option>
      {recruitmentRequests.map((r) => (
        <option key={r.id} value={r.id}>
          {r.title}
        </option>
      ))}
    </select>
  );
}
