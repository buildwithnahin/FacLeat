export const ACTIVE_BRANCH_COOKIE = 'annex_active_branch';
export const ACTIVE_COMPANY_COOKIE = 'annex_active_company';
export const ACTIVE_BRANCH_BY_COMPANY_COOKIE = 'annex_active_branch_by_company';

export function parseActiveBranchByCompanyCookie(value: string | undefined): Record<string, string> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string',
      ),
    );
  } catch {
    return {};
  }
}
