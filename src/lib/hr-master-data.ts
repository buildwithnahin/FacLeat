export type DesignationOption = {
  name: string;
  department: string | null;
};

export function getDesignationDepartment(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const value = (metadata as { department?: unknown }).department;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function buildDesignationOptions(
  rows: Array<{ name: string; metadata?: unknown }>,
  fallback: readonly string[] = [],
): DesignationOption[] {
  const mapped = rows.map((row) => ({
    name: row.name,
    department: getDesignationDepartment(row.metadata),
  }));

  const fallbackMapped = fallback.map((name) => ({ name, department: null }));
  const values = mapped.length ? mapped : fallbackMapped;
  const seen = new Set<string>();

  return values.filter((value) => {
    const key = `${value.name}::${value.department ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
