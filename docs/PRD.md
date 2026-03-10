# Product Requirements Document (PRD)
## SDH Inventory Management (V1)

## 1. Summary
SDH Inventory is a multi-tenant fullstack app for companies to manage office assets assigned to employees, run annual verification audits, and track asset lifecycle status.

Primary users:
- Employee: view-only access to own assigned assets.
- Office Manager: full company dashboard and management controls.

## 2. Goals and Success Criteria
V1 is successful when:
- Office Manager can create and manage company structure: Office > Floor > Room.
- Office Manager can create/manage employees and assets with barcode identifiers.
- Assets can be assigned, reassigned, and tracked with history.
- Annual verification can be completed using either barcode scan or manual check.
- Asset compliance badges are visible (`Verified` / `Expired`).
- Employees can only view their own assets.

## 3. User Roles and Permissions

### 3.1 Employee
- Can view only assets assigned to themselves.
- Read-only access.
- No management actions.

### 3.2 Office Manager
- Full company access.
- Can manage:
  - Offices, floors, rooms
  - Employees
  - Assets
  - Asset assignment/transfers
  - Asset status updates (including broken)
  - Annual verification cycles and verification events
  - Dashboard filters and reports

## 4. Core Functional Requirements

### 4.1 Company and Location Structure
- Multi-tenant by company.
- Each company supports:
  - Multiple offices
  - Each office has multiple floors
  - Each floor has multiple rooms

### 4.2 Asset Management
Each asset includes:
- Internal asset ID
- Barcode value (unique within company)
- Name/title
- Category
- Tags
- Current assignee (employee)
- Current location (office/floor/room)
- Status (`Active`, `Broken`, optionally `Retired`)
- Timestamps and audit metadata

Grouping/filtering required by:
- Category
- Tags
- Employee
- Office/Floor/Room
- Status

### 4.3 Assignment and Transfer
- Office Manager can directly change destination/user.
- Transfer is immediate (no approval workflow in V1).
- Every change writes immutable audit history:
  - who changed
  - when
  - from/to values
  - optional note

### 4.4 Broken Assets
- Manager can mark asset as `Broken`.
- Broken asset remains assigned.
- Broken asset is excluded from verification compliance until reactivated.

### 4.5 Annual Verification
- Verification is company-wide annual cycle with start/end dates.
- For each eligible asset, manager can verify by:
  - `Scan` (mobile camera barcode scanner)
  - `Manual` (presence confirmed without scan)

Each verification event stores:
- Asset ID
- Cycle ID
- Verifier
- Timestamp
- Method (`scan` or `manual`)
- Office/Floor/Room
- Optional note/photo

Badge logic:
- `Verified`: asset has successful verification event in current cycle.
- `Expired`: asset required in cycle but not verified by cycle deadline.

## 5. Dashboard and Reporting
Office Manager dashboard must provide:
- Compliance overview (`Verified` vs `Expired`)
- Filtering by location hierarchy
- Grouping by category/tag/employee
- Lists of missing (expired) assets
- Verification progress tracking during active cycle

## 6. Employee Experience
Employee can:
- View own assigned assets
- View basic asset details/status/history (read-only)

Employee cannot:
- View other employees' assets
- Manage assets or verification
- Reassign assets

## 7. Non-Functional Requirements
- Strict tenant isolation by company.
- Role-based access control enforced backend + frontend.
- Auditability for all assignment/status/verification changes.
- Mobile-friendly verification flow for Office Managers.

## 8. Out of Scope (V1)
- HRIS integrations
- CSV import/export as required path
- Approval workflows for transfer
- Employee request workflows (replacement/transfer tickets)
- Dedicated hardware scanner support as primary path (can be added later)

## 9. Acceptance Criteria (V1)
- Manager can create full location hierarchy and assign assets to employees/rooms.
- Barcode uniqueness is enforced per company.
- Manager can transfer asset between employees with audit trail.
- Manager can mark asset as broken; asset excluded from compliance.
- During annual cycle, manager verifies assets via scan and manual methods.
- Unverified eligible assets become `Expired` after cycle end.
- Employee sees only own assets and cannot access manager capabilities.
- Multi-office filtering/reporting works correctly.
