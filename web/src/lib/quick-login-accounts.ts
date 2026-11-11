/**
 * Labels + email only — no passwords here. Keys must match
 * backend/src/server/auth/quick-login-accounts.ts exactly; the backend
 * resolves the actual password server-side from the key. The email is not
 * secret (it's shown on-screen once quick-login fills the field), so it's
 * safe to duplicate here for the visual autofill effect.
 */
export const QUICK_LOGIN_ROLES = [
  { key: 'SUPER_ADMIN', label: 'Super Admin', email: 'admin@annex.local' },
  { key: 'ADMIN', label: 'Admin', email: 'branchadmin@annex.local' },
  { key: 'ACCOUNTS', label: 'Accounts', email: 'accountant@annex.local' },
  { key: 'PURCHASE', label: 'Purchase', email: 'purchase@annex.local' },
  { key: 'STORE', label: 'Store', email: 'warehouse@annex.local' },
  { key: 'SALES', label: 'Sales', email: 'cashier@annex.local' },
  { key: 'COMMERCIAL', label: 'Commercial', email: 'sales@annex.local' },
  { key: 'PRODUCTION', label: 'Production', email: 'factory@annex.local' },
  { key: 'HR', label: 'HR', email: 'hr@annex.local' },
] as const;
