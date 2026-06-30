# Annex Leather ERP Project Report

Date: 2026-06-27
Repository: Annex-Leather-Front-End
Primary application: Root Next.js app

## 1. Executive Summary

This repository contains a modern ERP rebuild implemented as a single Next.js application at the repository root. The old `client/` and `server/` folders are legacy MERN reference code and are not the primary runtime path for the current project.

The active application is organized into 25 navigable business modules. The architecture is strongly centered on:

- branch-aware data access
- role and permission based security
- approval-driven sensitive actions
- transaction-safe inventory and finance updates
- audit logging for business-critical changes
- shared reporting across sales, purchase, inventory, HR, and finance

## 2. Architecture Snapshot

Core stack:

- Frontend and app shell: Next.js 15 App Router
- Backend logic: server-side services under `src/server/services`
- Database: PostgreSQL with Prisma
- Auth: Auth.js credentials flow
- Validation: Zod validators
- UI access control: permissions plus server-side authorization

Cross-cutting technical layers:

- `Branches`: controls business-unit scope and currency context
- `Users & Roles`: controls access and action permissions
- `Approvals`: gates sensitive actions by module, action, and amount
- `Audit Log`: records who changed what and when
- `Notifications`: pushes alerts for approvals, stock, and operational events
- `Reports`: consolidates data from operational modules

## 3. Implemented Module Inventory

### 1. Admin Dashboard

- Route: `/dashboard`
- Submodules: dashboard overview
- Purpose: executive visibility and KPI summary
- Primary dependencies: Reports, Accounts, Inventory, Sales modules, HR, Notifications

### 2. Barcode

- Route: `/barcode`
- Submodules: overview, print labels
- Purpose: barcode lookup and label printing
- Primary dependencies: Inventory products, Warehouse stock

### 3. Inventory

- Route: `/inventory`
- Submodules: overview, products, categories, stock balance, ledger
- Purpose: product master data, stock visibility, ledger review
- Primary dependencies: Branches, Warehouse, Barcode, Reports

### 4. Warehouse

- Route: `/warehouse`
- Submodules: overview, receive, issue/adjust out, customer returns, faulty stock, transfer, physical count
- Purpose: physical stock movement execution
- Primary dependencies: Inventory, Branches, Approvals, Audit, Notifications

### 5. Factory

- Route: `/factory`
- Submodules: production orders, new production order
- Purpose: production planning, material consumption, finished goods output
- Primary dependencies: Inventory, Warehouse, Branches, Approvals, Audit, Accounts

### 6. POS

- Route: `/pos`
- Submodules: terminal, sales, sessions
- Purpose: retail sales execution
- Primary dependencies: Inventory, Warehouse, CRM, Accounts, Branches, Audit

### 7. Corporate Sales

- Route: `/corporate-sales`
- Submodules: overview, quotes, orders, invoices
- Purpose: B2B quotation-to-cash flow
- Primary dependencies: CRM, Inventory, Warehouse, Accounts, Approvals, Branches, Audit

### 8. Wholesale

- Route: `/wholesale`
- Submodules: overview, new invoice, invoices
- Purpose: wholesale billing, collections, and returns
- Primary dependencies: CRM, Inventory, Warehouse, Accounts, Approvals, Branches, Audit

### 9. E-commerce

- Route: `/ecommerce`
- Submodules: overview and integration workflows in service layer
- Purpose: sync online orders, fulfillment, refunds, reconciliation
- Primary dependencies: Inventory, Warehouse, CRM, Accounts, Branches, Notifications

### 10. Export / Import

- Route: `/trade`
- Submodules: overview, orders, new order, letters of credit, new LC, shipments, payments
- Purpose: trade order lifecycle and LC/shipment/payment tracking
- Primary dependencies: Inventory, Suppliers, CRM, Accounts, Branches, Audit

### 11. Suppliers

- Route: `/suppliers`
- Submodules: all suppliers, payments
- Purpose: supplier master and supplier payment visibility
- Primary dependencies: Purchase, Accounts, Branches, Audit

### 12. CRM

- Route: `/crm`
- Submodules: customers, new customer
- Purpose: customer master and commercial relationship data
- Primary dependencies: Branches, Sales modules, Accounts, Reports

### 13. Purchase

- Route: `/purchase`
- Submodules: overview, requisitions, orders, goods receive, invoices
- Purpose: procure-to-pay processing
- Primary dependencies: Suppliers, Inventory, Warehouse, Accounts, Approvals, Branches, Audit

### 14. Accounts & Finance

- Route: `/accounts`
- Submodules: overview, journals, new journal, account ledger, trial balance, balance sheet, income statement, cash flow statement, changes in equity, financial notes, fiscal periods
- Purpose: financial posting, ledgers, statutory-style statements
- Primary dependencies: Chart of Accounts, Purchase, Sales modules, Assets, HR, Branches, Audit

### 15. Chart of Accounts

- Route: `/coa`
- Submodules: account list and account maintenance flows
- Purpose: general ledger account structure
- Primary dependencies: Accounts, Branches, Audit

### 16. Assets

- Route: `/assets`
- Submodules: all assets, categories
- Purpose: fixed asset register and asset movement accounting
- Primary dependencies: Accounts, Branches, Audit, Documents

### 17. Transactions

- Route: `/transactions`
- Submodules: finance transaction pages and voucher handling
- Purpose: operational transaction views around payments and vouchers
- Primary dependencies: Accounts, Documents, Audit

### 18. Reports & Analytics

- Route: `/reports`
- Submodules: overview, sales, top products, purchase, inventory valuation, HR summary
- Purpose: consolidated analytics across business modules
- Primary dependencies: POS, Wholesale, Corporate Sales, Purchase, Inventory, HR, Accounts, Branches

### 19. HR & Payroll

- Route: `/hr`
- Submodules: overview, employees, new employee, attendance, leaves, payroll
- Purpose: employee records, attendance, leave, and payroll
- Primary dependencies: Branches, Approvals, Accounts, Audit, Reports

### 20. Users & Roles

- Route: `/users`
- Submodules: users, roles
- Purpose: user administration and permission modeling
- Primary dependencies: Branches, Approvals, Audit

### 21. Audit Log

- Route: `/audit`
- Submodules: audit listing and detail view
- Purpose: traceability and compliance review
- Primary dependencies: all transactional modules

### 22. Notifications

- Route: `/notifications`
- Submodules: notification inbox and real-time event feed
- Purpose: user-facing operational alerts
- Primary dependencies: Approvals, Inventory, Purchase, Sales, HR

### 23. Branches

- Route: `/branches`
- Submodules: branch list, create branch, branch detail
- Purpose: organizational and operational scope control
- Primary dependencies: foundation module used by almost all others

### 24. Approvals

- Route: `/approvals`
- Submodules: queue, rules
- Purpose: approval routing by module, action, and amount
- Primary dependencies: Users & Roles, Notifications, Audit, Branches

### 25. Documents

- Route: `/documents`
- Submodules: document list, detail, create, settings
- Purpose: central document storage and reference linkage
- Primary dependencies: Users & Roles, Branches, Audit

## 4. Dependency Report

### 4.1 Foundation Dependency Layers

Layer 1: foundation modules

- Branches
- Users & Roles
- Approvals
- Audit Log
- Notifications
- Documents

Layer 2: master data and structure

- CRM
- Suppliers
- Chart of Accounts
- Inventory products and categories
- Assets categories

Layer 3: operational execution

- Warehouse
- Purchase
- POS
- Wholesale
- Corporate Sales
- E-commerce
- Factory
- Export / Import
- HR & Payroll

Layer 4: financial and analytical consolidation

- Accounts & Finance
- Transactions
- Reports & Analytics
- Admin Dashboard

### 4.2 Module-to-Module Dependency Summary

Admin Dashboard depends on:

- Reports & Analytics
- Accounts & Finance
- Inventory
- Purchase
- POS
- Wholesale
- Corporate Sales
- HR & Payroll
- Notifications

Inventory depends on:

- Branches
- Users & Roles for access
- Warehouse for movement execution
- Barcode for identification and printing

Warehouse depends on:

- Inventory
- Branches
- Approvals for exceptional actions
- Audit Log
- Notifications

Purchase depends on:

- Suppliers
- Inventory products
- Warehouse goods receipt
- Accounts & Finance for invoice and payment impact
- Approvals
- Branches
- Audit Log

CRM depends on:

- Branches
- Users & Roles
- Accounts & Finance for receivable context
- Sales modules that consume customer data

POS depends on:

- CRM
- Inventory
- Warehouse
- Accounts & Finance
- Branches
- Audit Log

Wholesale depends on:

- CRM
- Inventory
- Warehouse
- Accounts & Finance
- Approvals for discount override style control
- Audit Log

Corporate Sales depends on:

- CRM
- Inventory
- Warehouse
- Accounts & Finance
- Approvals
- Audit Log

E-commerce depends on:

- Inventory
- Warehouse
- CRM
- Accounts & Finance
- Notifications

Factory depends on:

- Inventory products and stock
- Warehouse source and destination locations
- Accounts & Finance for costing impact
- Approvals for controlled actions
- Audit Log

Export / Import depends on:

- CRM when customer-side trade orders exist
- Suppliers when import-side sourcing exists
- Inventory products
- Accounts & Finance for settlement and valuation
- Audit Log

Assets depends on:

- Accounts & Finance
- Branches
- Documents
- Audit Log

HR & Payroll depends on:

- Branches
- Approvals
- Accounts & Finance
- Audit Log
- Reports & Analytics

Reports & Analytics depends on:

- POS
- Wholesale
- Corporate Sales
- Purchase
- Inventory
- HR & Payroll
- Accounts & Finance

Approvals depends on:

- Users & Roles
- Notifications
- Audit Log
- Branches

Documents depends on:

- Users & Roles
- Branches
- Audit Log

## 5. Workflow Report

### 5.1 Cross-Cutting System Workflow

Most business actions follow this shared pattern:

1. User authenticates through credential login.
2. Server checks module permission.
3. Branch context and business validation are applied.
4. Data changes run inside a database transaction for sensitive operations.
5. Audit log entry is written.
6. Notifications are published when relevant.
7. Reports consume the resulting transaction data.

This makes the project consistent across procurement, inventory, finance, HR, and sales.

### 5.2 Procurement Workflow

Purchase workflow implemented in the service layer:

1. Create Purchase Requisition
2. Approve or reject requisition
3. Create Purchase Order
4. Receive goods through GRN
5. Create supplier invoice
6. Record payment
7. Update stock, payables, audit, and reporting

Main module chain:

- Purchase -> Approvals -> Suppliers -> Warehouse -> Inventory -> Accounts -> Audit -> Reports

### 5.3 Inventory and Warehouse Workflow

Inventory movement workflow:

1. Product is defined in Inventory
2. Stock enters through receipt, GRN, opening, or production output
3. Stock leaves through issue, sales, damage, transfer, or material consumption
4. Every movement writes Inventory Ledger rows
5. Low-stock notifications are generated when reorder thresholds are crossed
6. Reports consume the ledger for valuation and stock visibility

Main module chain:

- Inventory -> Warehouse -> Notifications -> Reports -> Audit

### 5.4 POS Workflow

Retail flow:

1. Operator opens terminal or session
2. Select customer if needed
3. Add items from stock
4. System validates inventory
5. Sale is posted
6. Payment is captured
7. Inventory is reduced and financial totals are updated

Main module chain:

- POS -> CRM -> Inventory -> Warehouse -> Accounts -> Audit -> Reports

### 5.5 Wholesale Workflow

Wholesale flow:

1. Select customer
2. Build invoice
3. Validate discounts and credit limits
4. Validate stock availability
5. Post invoice
6. Record initial or later payments
7. Handle returns or voids where applicable

Main module chain:

- Wholesale -> CRM -> Inventory -> Warehouse -> Accounts -> Approvals -> Audit -> Reports

### 5.6 Corporate Sales Workflow

Corporate B2B flow:

1. Create quote
2. Send and update quote status
3. Convert accepted quote to order
4. Record delivery
5. Create invoice
6. Record invoice payment
7. Track outstanding balance

Main module chain:

- Corporate Sales -> CRM -> Inventory -> Warehouse -> Accounts -> Approvals -> Audit -> Reports

### 5.7 Export / Import Workflow

Trade flow:

1. Create trade order
2. Track customer or supplier side commercial data
3. Open and manage Letter of Credit
4. Apply LC amendments
5. Create shipment records
6. Track drawdowns and payments
7. Update operational and financial visibility

Main module chain:

- Export / Import -> CRM or Suppliers -> Inventory -> Accounts -> Audit -> Reports

### 5.8 Factory Workflow

Production workflow:

1. Create production order
2. Define stages and material plan
3. Consume materials from warehouse stock
4. Track stage progress
5. Post finished output into destination warehouse
6. Record production cost entries
7. Derive production cost per unit

Main module chain:

- Factory -> Inventory -> Warehouse -> Accounts -> Approvals -> Audit -> Reports

### 5.9 HR and Payroll Workflow

HR flow:

1. Create employee
2. Mark attendance
3. Create and approve leave
4. Generate payroll run
5. Approve, pay, and lock payroll
6. Feed payroll cost into finance and reporting

Main module chain:

- HR & Payroll -> Approvals -> Accounts -> Audit -> Reports

### 5.10 Reporting Workflow

Reporting flow:

1. Operational modules write transactions
2. Ledger and invoice data accumulate in the database
3. Reports aggregate sales, purchases, inventory, and HR information
4. Dashboard surfaces the consolidated KPIs

Main module chain:

- Operational modules -> Accounts and ledgers -> Reports & Analytics -> Admin Dashboard

## 6. Practical Reading of the Project

If you want to understand the project in implementation order, this is the most useful learning sequence:

1. Branches
2. Users & Roles
3. Approvals
4. Inventory
5. Warehouse
6. CRM and Suppliers
7. Purchase
8. Sales modules: POS, Wholesale, Corporate Sales, E-commerce
9. Factory
10. Export / Import
11. Accounts & Finance plus Chart of Accounts
12. HR & Payroll
13. Reports, Dashboard, Audit, Notifications, Documents

## 7. Final Assessment

The project is structured as a real ERP platform rather than a set of isolated pages. Its strongest design theme is shared business control across modules: permissions, branch context, approval routing, audit trails, stock ledgers, and financial consistency.

The most central dependency hubs are:

- Branches
- Users & Roles
- Inventory
- Warehouse
- Accounts & Finance
- Approvals
- Audit Log

The most integration-heavy workflows are:

- Purchase to warehouse to accounts
- Sales to inventory to accounts
- Factory to inventory to costing
- HR to payroll to accounts
- Reports aggregating all transactional modules
