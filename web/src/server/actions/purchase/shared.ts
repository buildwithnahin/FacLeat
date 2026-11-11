export type PurchaseFormState =
  | { error?: string; fieldErrors?: Record<string, string[]> }
  | undefined;

/** The client form JSON-stringifies `items` before submitting. */
export function parseItems(formData: FormData): unknown {
  const raw = formData.get('itemsJson');
  if (typeof raw !== 'string' || !raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
