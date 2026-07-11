# Chart of Accounts Documentation

## Project
Annex Leather ERP

## Purpose
This document explains how the Chart of Accounts (COA) works in this project from the database layer to the user interface, including account hierarchy, validations, posting behavior, balances, system mappings, and operational constraints.

## What The COA Is In This Project
The COA is the master list of ledger accounts used by the accounting module and by operational modules that generate accounting entries automatically.

Each account is stored in the `ChartAccount` model and can be:
- a root account or a child account
- a posting account or a header account
- a normal account or a control account
- global (`branchId = null`) or branch-specific
- active or inactive
- system-managed or user-managed

The COA is not only a display list. It is the foundation for:
- manual journal entries
- account history and ledger views
- trial balance, income statement, and balance sheet logic
- system account mapping for sales, purchase, inventory, tax, cash, bank, and other automated postings

## Core Data Model
The main model is `ChartAccount`.

Key fields:
- `code`: globally unique account code
- `name`: account title
- `type`: `ASSET`, `LIABILITY`, `EQUITY`, `INCOME`, or `EXPENSE`
- `normalSide`: `DEBIT` or `CREDIT`
- `parentId`: optional self-reference for hierarchy
- `path`: materialized hierarchy path such as `5000/5300/5310`
- `depth`: tree depth used by the UI
- `isPosting`: whether journal lines can post directly to the account
- `isControl`: whether the account should be fed through subledger flows rather than normal manual journals
- `currency`: account currency
- `branchId`: optional branch scope
- `openingBalance`: starting balance stored directly on the account
- `detailType`: UI classification label
- `openingBalanceDate`: date for the starting balance
- `isActive`: soft status toggle
- `isSystem`: protects seeded/system accounts from destructive changes

Related models:
- `JournalEntry`
- `JournalEntryLine`
- `SystemAccountMapping`
- `OpeningBalanceEntry`

Important implementation note:
Although `OpeningBalanceEntry` exists in the schema, the current COA screen calculates balances using `ChartAccount.openingBalance` plus posted journal lines. The COA screen does not currently aggregate `OpeningBalanceEntry` rows.

## Account Hierarchy
The hierarchy is tree-based and stored in two ways:
- relationally through `parentId`
- denormalized through `path` and `depth`

Example:
- `5000` Expenses
- `5000/5300` Operating Expenses
- `5000/5300/5310` Salaries & Wages

Why `path` matters:
- the UI sorts accounts by `path`
- descendants can be found quickly with `startsWith`
- reparenting can update descendant paths in bulk logic

Hierarchy rules enforced by the service:
- a parent account must exist
- parent and child must have the same `type`
- an account cannot become its own parent
- an account cannot be moved under one of its descendants

## Branch Scope
Accounts may be:
- global, when `branchId` is `null`
- branch-specific, when `branchId` contains a branch id

When listing accounts for a branch, the service returns:
- all global accounts
- all accounts assigned to the active branch

This is implemented as:
- `OR: [{ branchId: null }, { branchId }]`

That means a branch can use shared master accounts and also branch-specific accounts together.

## Permissions
The COA module uses permission checks before any action:
- `coa:read` for listing, tree view, detail view
- `coa:write` for create, edit, activate/deactivate, delete

Pages and actions depend on the authenticated session and branch context.

## How Accounts Are Created
There are two create flows in the project:
- quick-create modal from the main COA page
- full create form on `/coa/new`

Common create behavior:
- account code is uppercased from form input
- Zod validates the payload
- the service checks for duplicate `code`
- parent account is validated if provided
- `path` is built from the parent path and new code
- `depth` is derived from the parent
- an audit log entry is recorded
- the COA cache tag is revalidated

Special behavior:
- if the selected parent is currently a posting account, the service automatically changes the parent to `isPosting = false`
This prevents a header account from remaining postable after children are added.

## Validation Rules On Create And Edit
The code-level validation rules include:
- `code` is required, max 24 chars, and only allows letters, digits, dot, dash, underscore
- `name` is required
- `type` must be one of the 5 supported account types
- `normalSide` must be `DEBIT` or `CREDIT`
- `branchId` and `parentId` must be valid ids when present
- `openingBalance` must be numeric
- `detailType` and `description` have length limits

Service-level business rules include:
- duplicate account codes are blocked
- parent type must match child type
- system accounts cannot have code or type changed
- descendants are re-pathed when a parent path changes

## Posting Accounts Vs Header Accounts
`isPosting` controls whether journal entries can use the account directly.

Posting account:
- can receive `JournalEntryLine` rows

Header account:
- used for grouping only
- cannot receive direct journal postings

The accounts service enforces this with a validation error if someone tries to post to a non-posting account.

## Control Accounts
`isControl` marks accounts whose balances are expected to be driven by subledger processes.

Examples of likely control-account usage:
- Accounts Receivable
- Accounts Payable
- Inventory
- Tax payable or tax recoverable

Manual journal posting behavior:
- normal manual posting blocks direct posting to control accounts
- system-triggered journal posting may allow control accounts

This is deliberate. The project tries to push users toward the proper domain flow, such as sales or purchase modules, instead of bypassing subledgers with ad hoc manual journals.

## How Balances Are Calculated In The COA Screen
The COA tree page does not simply show the stored opening balance.
It calculates:
- opening balance from `ChartAccount.openingBalance`
- movement from posted journal lines only
- current balance based on the account's normal side

Formula used:
- for `DEBIT` normal accounts:
  current balance = opening balance + debit - credit
- for `CREDIT` normal accounts:
  current balance = opening balance + credit - debit

Only journal entries where `status = POSTED` are included.

This means:
- draft journal entries do not affect the COA balance
- voided journal entries do not affect the COA balance
- the COA reflects live posted accounting activity

## Account History
The history page for one account uses posted journal lines for that account and produces a running balance.

It shows:
- date
- reference number
- branch code
- memo/reference text
- debit
- credit
- running balance

Running balance starts from the account opening balance and then applies line-by-line movement using the account normal side.

## System Account Mapping
The project includes a `SystemAccountMapping` table keyed by `SystemAccountKey`.

Examples of system keys:
- `CASH`
- `BANK_DEFAULT`
- `AR_CONTROL`
- `AP_CONTROL`
- `INVENTORY`
- `INVENTORY_RAW_MATERIAL`
- `INVENTORY_FINISHED_GOODS`
- `WIP`
- `COGS`
- `SALES_REVENUE`
- `TAX_PAYABLE`
- `TAX_RECOVERABLE`
- `OPENING_BALANCE_EQUITY`

How resolution works:
- the service first looks for a branch-specific mapping
- if none exists, it falls back to the global mapping where `branchId = null`

Why this matters:
- operational modules can post correctly without hardcoding account ids
- different branches can override account mappings when needed

## Seeded COA Structure
The seed script creates a base COA and marks those accounts as `isSystem = true`.

Seed examples include:
- Assets
- Liabilities
- Equity
- Income
- Expenses
- specialized accounts like COGS, discount given, purchase expense, and others

Some seeded accounts are also immediately linked into `SystemAccountMapping`.

Practical consequence:
- core accounting structure exists from the beginning
- business-critical accounts are protected from deletion
- automated posting flows can resolve the right accounts

## Editing Behavior
Editing supports:
- code change
- name change
- parent change
- posting/control toggle
- branch reassignment
- opening balance and descriptive fields
- active status

Important edit rules:
- system accounts cannot change `code` or `type`
- reparenting cannot create cycles
- descendant `path` values are recalculated when parent path changes

## Activation And Deactivation
Accounts can be toggled active or inactive.

Rules:
- inactive accounts remain in data but should not be used operationally
- system accounts cannot be deactivated through the COA toggle flow

The main COA page exposes this as a status switch.

## Deletion Rules
Deletion is intentionally strict.
An account cannot be deleted if:
- it is a system account
- it has child accounts
- it has journal line history
- it is mapped as a system account

This protects accounting integrity and avoids orphaned structures.

## How The Main COA UI Is Organized
The main COA page groups the list in three levels:
- account type
- detail type
- individual accounts

The UI also includes:
- filters by detail type, name, and status
- totals by major account type
- add-new modal
- activate/deactivate toggle
- delete action
- history link

Type summary cards are shown for:
- Income
- Liability
- Equity
- Expense
- Asset

The group totals come from the same computed current balances used for account rows.

## Detail Type Classification
The UI uses a predefined detail-type catalog such as:
- Cash and cash equivalents
- Accounts Receivable
- Current assets
- Fixed assets
- Accounts Payable
- Owner's equity
- Income
- Cost of sales
- Expenses

Each detail type has:
- a label
- target `type`
- expected normal side
- recommended code range
- description text

These are UI and validation helpers, not separate database tables.

## Recommended Code Ranges
The project ships with guidance like:
- 1000-1999 for assets
- 2000-2999 for liabilities
- 3000-3999 for equity
- 4000-4999 for income
- 5000-8999 for expense-related ranges

This helps keep the chart organized and aligns the UI grouping with standard accounting structure.

## How COA Connects To Journals And Reports
The COA is used directly by the accounts service for:
- journal validation
- account ledger views
- trial balance
- income statement
- balance sheet
- cash flow calculations

Key posting rule:
- only `POSTED` journal entries affect balances and reports

This is one of the most important design choices in the accounting module.

## Practical Workflow For Users
Typical user workflow:
1. Seed or configure the base COA.
2. Review system accounts and mappings.
3. Add branch-specific accounts when necessary.
4. Use posting accounts for journals.
5. Keep grouping/header accounts non-posting.
6. Use operational modules for control-account flows.
7. Review balances and history from the COA and ledger pages.

## Current Design Strengths
- clear separation between header and posting accounts
- strong protection for system accounts
- branch-aware account scope
- automatic audit logging
- direct integration with journals and financial reports
- global plus branch-specific system account mapping

## Current Limitations Or Things To Know
- account `code` is globally unique, not unique per branch
- current COA balance logic uses `openingBalance` on the account rather than `OpeningBalanceEntry`
- quick-create flow is optimized for common account setup and exposes fewer fields than the full edit/create form
- some UI classifications are helper labels and ranges, not hard accounting constraints

## Summary
In this project, the Chart of Accounts is a structured, branch-aware ledger master that drives manual accounting, automated business postings, account history, and reporting.

Its key ideas are:
- tree-based hierarchy with `parentId`, `path`, and `depth`
- strict distinction between posting, header, and control accounts
- branch-aware visibility with support for global accounts
- system mappings for automated journal generation
- balances derived from opening balance plus posted journal movement

For developers, the main implementation centers are:
- `prisma/schema.prisma`
- `src/server/services/coa.service.ts`
- `src/server/services/accounts.service.ts`
- `src/server/actions/coa.ts`
- `src/components/coa/coa-client.tsx`
- `src/app/(app)/coa/*`
