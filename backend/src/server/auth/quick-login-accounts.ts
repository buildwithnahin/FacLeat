/**
 * Fixed, non-secret role -> account mapping for the "quick login" buttons on
 * the login page. Explicitly requested by the business owner as an
 * unrestricted, no-gate convenience feature for all 9 seeded roles — see
 * the cPanel migration session notes for the risk this was weighed against
 * (any visitor to the public login page can one-click into any of these
 * accounts, including Super Admin). The actual password is never sent to
 * or stored in client code; it lives only here, read from
 * QUICK_LOGIN_PASSWORD, and is checked server-side by the quick-login route
 * exactly like a normal password check.
 */
export type QuickLoginRoleKey =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'ACCOUNTS'
  | 'PURCHASE'
  | 'STORE'
  | 'SALES'
  | 'COMMERCIAL'
  | 'PRODUCTION'
  | 'HR';

export interface QuickLoginAccount {
  key: QuickLoginRoleKey;
  label: string;
  email: string;
}

export const QUICK_LOGIN_ACCOUNTS: QuickLoginAccount[] = [
  { key: 'SUPER_ADMIN', label: 'Super Admin', email: 'admin@annex.local' },
  { key: 'ADMIN', label: 'Admin', email: 'branchadmin@annex.local' },
  { key: 'ACCOUNTS', label: 'Accounts', email: 'accountant@annex.local' },
  { key: 'PURCHASE', label: 'Purchase', email: 'purchase@annex.local' },
  { key: 'STORE', label: 'Store', email: 'warehouse@annex.local' },
  { key: 'SALES', label: 'Sales', email: 'cashier@annex.local' },
  { key: 'COMMERCIAL', label: 'Commercial', email: 'sales@annex.local' },
  { key: 'PRODUCTION', label: 'Production', email: 'factory@annex.local' },
  { key: 'HR', label: 'HR', email: 'hr@annex.local' },
];

export function findQuickLoginAccount(key: string): QuickLoginAccount | undefined {
  return QUICK_LOGIN_ACCOUNTS.find((a) => a.key === key);
}

/**
 * All 9 seeded accounts share one password. It is deliberately NOT in the
 * source — set QUICK_LOGIN_PASSWORD in the host's environment (Render, cPanel,
 * local .env). Returns undefined when unset so the route can answer "quick
 * login isn't configured" instead of guessing a credential.
 */
export function getQuickLoginPassword(): string | undefined {
  return process.env.QUICK_LOGIN_PASSWORD || undefined;
}
