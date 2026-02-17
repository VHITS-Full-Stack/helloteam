# HelloTeam — Product Roadmap

> Last updated: 2026-02-17

---

## Overview

Full employee lifecycle: **Onboard Employee → Assign to Client → Client Portal → Timesheets → Auto-Approve → Invoice → Charge CC**

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Employee  │───▶│  Assign  │───▶│  Client  │───▶│Timesheet │───▶│  Auto    │
│ Onboard  │    │ to Client│    │  Portal  │    │ Approval │    │ Billing  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| `[ ]`  | Not started |
| `[~]`  | In progress |
| `[x]`  | Done |

---

## 1. Employee Onboarding Portal `[x]`

**Goal:** New employees receive an email link to complete their profile.

| Field | Required | Notes |
|-------|----------|-------|
| Government ID | Yes | Photo/scan upload |
| Address | Yes | Full mailing address |
| Phone number | Yes | Personal phone |
| Personal email | Yes | Non-work email |
| Emergency Contact 1 | Yes | Name, phone, relationship |
| Emergency Contact 2 | Yes | Name, phone, relationship |
| Emergency Contact 3 | Yes | Name, phone, relationship |

**Admin sets:** Payment rate (to employee), Billing rate (to client)

**Rules:**
- Employee starts as **general** (unassigned to any client)
- Assignment to client happens separately by admin

---

## 2. Client Access Control `[x]`

**Goal:** Clients cannot access the portal until their contract is signed.

**Rules:**
- Contract not signed → redirect to onboarding / block login
- Contract signed (`onboardingStatus === 'COMPLETED'`) → unlock portal
- Client cannot see or contact employees before contract signing

---

## 3. Client Portal `[x]`

**Goal:** After contract signed, clients see their assigned employees and timesheets.

**Views:**
- Employee list (assigned to this client)
- Clock in/out times per employee
- **Daily** timesheet view
- **Weekly** timesheet view
- Easy toggle between daily ↔ weekly

---

## 4. Chat System `[ ]`

**Goal:** Real-time communication between client and employee.

**Features:**
| Feature | Description |
|---------|-------------|
| Text chat | Standard messaging |
| Voice notes | Record & send audio |
| Calling | Voice/video calls |
| File uploads | Videos, docs, images (large files) |
| History | Full chat history preserved |
| Notifications | New message alerts |

---

## 5. Task Management `[ ]`

**Goal:** Clients create and assign tasks to their employees.

**Task fields:**
- Title, description
- Priority (low / medium / high / urgent)
- Due date
- Status (todo / in progress / done)
- Assigned employee

**Views:**
- Task list with filters (status, employee, priority)
- Employee can update task status

---

## 6. Timesheet Auto-Approval `[x]`

**Goal:** Streamline timesheet approval with a 24-hour auto-approve rule.

**Flow:**
```
Employee submits timesheet
        │
        ▼
┌─────────────────┐
│ Client has 24hrs │
│  to approve/deny │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
 Approved   Denied ──▶ Employee notified
    │                    (resubmit)
    ▼
  ┌──────────────────┐
  │ 24hrs passed with │
  │ no action?        │
  │ AUTO-APPROVED     │
  └──────────────────┘
```

**Rules:**
- Scheduled timesheets → auto-approved after 24 hours
- Client can approve or deny within the window
- Overtime → follows existing overtime approval flow
- Clear status indicators: pending / approved / denied / auto-approved

---

## 7. Auto Billing & Invoicing `[x]`

**Goal:** Approved timesheets automatically generate invoices and charge the client.

**Flow:**
```
Approved Timesheets → Generate Invoice → Charge CC on file → Done
```

**Details:**
- Invoice frequency based on agreement type (weekly / bi-weekly / monthly)
- Monthly invoices for MONTHLY clients, weekly invoices for WEEKLY and BI_WEEKLY clients
- Late-approved OT records automatically included in the next invoice
- Time records marked with `invoiceId` to prevent double-billing
- Invoice PDF generation
- Invoice history for client and admin
- Auto-charge client's credit card on file (TBD)

---

## 8. Employee Termination Process `[ ]`

**Goal:** HR workflow for terminating an employee.

**Steps:**
1. Admin initiates termination
2. Select reason: voluntary / involuntary / end of contract / other
3. Set termination date (immediate or future)
4. System handles:
   - Unassign from all clients on termination date
   - Deactivate employee account/login
   - Final timesheet settlement (all hours billed)
   - Notify affected clients
   - Archive records (never delete — compliance)
5. Handle notice period if required by client policy (e.g. 2 weeks)
6. Generate termination documentation

---

## 9. Integration — Deal CRM `[ ]`

**Goal:** Sync with Deal (current CRM).

**TBD:**
- Identify specific data to sync (employees, clients, contacts)
- Research Deal API
- Define sync direction (one-way vs two-way)

---

## 10. Integration — Tickler `[ ]`

**Goal:** Connect with Tickler.

**TBD:**
- Clarify what Tickler is used for in current workflow
- Research Tickler API
- Define integration points

---

## Build Order

```
Phase 1 — Core [DONE]             Phase 2 — Operations [IN PROGRESS]   Phase 3 — Communication
─────────────────                 ──────────────────────                ───────────────────────
1. Employee Onboarding  ✓   ───▶  6. Timesheet Auto-Approval  ✓        4. Chat System
2. Client Access Control ✓  ───▶  7. Auto Billing & Invoicing ✓        5. Task Management
3. Client Portal ✓                8. Employee Termination

                                  Phase 4 — Integrations
                                  ──────────────────────
                                  9. Deal CRM
                                  10. Tickler
```

---

## Tech Notes

| Layer | Stack |
|-------|-------|
| Frontend | React + Vite, Tailwind CSS, React Router v6 |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT |
| Icons | Lucide React |
| PDF | pdf-lib |
| Email | Nodemailer (Ethereal fallback in dev) |
| SMS | Twilio |
| Jobs | node-cron |

---

## Already Completed

- [x] Client onboarding (3-step wizard: business info → payment → sign)
- [x] Admin client management (table view with multiple contacts)
- [x] Admin client detail (compact 2-column layout with contact persons)
- [x] Agreement PDF generation with pdf-lib (recalibrated coordinates, employee names on cover + Exhibit A)
- [x] Client portal basic structure
- [x] Employee management (CRUD, groups, assignments)
- [x] Time tracking (clock in/out with break tracking)
- [x] Overtime flow (pre-approved OT, end-of-shift flow, auto-clock-out)
- [x] Timesheet auto-approval (24-hour window, OT excluded)
- [x] Invoice generation (weekly + monthly, late OT carry-forward, double-billing prevention)
- [x] OT notifications (in-app + email + SMS, billing cycle reminders)
- [x] Shift-end job (5-min warning, auto-clock-out, stay-clocked-in modal)
- [x] SMS notifications via Twilio (with dev fallback logging)
- [x] Email service with Ethereal fallback for dev/test

---

## Meeting Notes — 2026-02-16

### Client Setup Page

- [x] Support **multiple contact persons** per client, each with a **position/title** field
- [x] Agreement type options: **Weekly, Monthly, Bi-weekly**
- [x] Remove ACH / Credit Card from client setup (handled in onboarding)

### Leave Policy Fixes

- [x] Rename "Annual Days" label — make it **dynamic based on leave frequency**:
  - Fixed Annual → "Annual Days" (e.g., 6 days/year)
  - Fixed Half-Yearly → "Half-Yearly Days" (e.g., 3 days/6 months)
- [x] Add **"Require 2 weeks notice"** toggle separately for **paid leave** and **unpaid leave**

### Timesheet Auto-Approval

- [x] Regular scheduled timesheets → **auto-approve after 24 hours** (not 15 minutes)
- [x] Overtime timesheets are **never auto-approved** — follow OT approval flow

### Overtime System (Major Feature Rework)

#### Pre-Approved Overtime
- [x] Employees can request OT **at any time during the day** with an estimated end time
- [x] Client gets notified to approve/deny
- [x] If approved → OT hours are **auto-approved immediately** when clocked

#### End-of-Shift Flow (5 min before shift ends)
- [x] **5 min before shift end** → notify employee: "Your shift is ending. Click here to stay clocked in."
- [x] **If no action** → system auto-clocks out at shift end
- [x] **If "Stay Clocked In"** → trigger OT request flow:
  - Ask duration: **15 / 30 / 60 min / Custom**
  - **Reason** (required)
  - **Risk warning**: "OT should ideally be requested earlier. May not be approved/paid."
  - Employee submits

#### OT Notifications to Client
- [x] Client receives **3 simultaneous notifications**: in-app, email, SMS
- [x] Message: "OT request pending for [Employee] [Date] [Time] — Approve / Deny"

#### Unapproved Overtime Section
- [x] Unapproved OT goes to a separate **"Unapproved Overtime"** section
- [x] Never auto-approved — client must manually approve
- [x] OT timesheet entries shown in **different color**, labeled: **Pending / Approved / Denied**

#### OT Billing Cycle Reminders
- [x] **Immediately after OT shift ends** → email + SMS to client: "Employee worked OT. Approve or deny."
- [x] **3 days before billing cycle ends** → nagging notifications: "Unapproved hours won't appear on invoice."
- [x] **1 day before payroll** → final notification for all pending OT with payment deadline
- [x] Late-approved OT → charges on **next invoice**

### Onboarding Process Changes

- [x] **Remove manual password creation** — system auto-generates `Welcome@123`
- [x] **Remove SSN field** from onboarding, contract, and schema
- [x] Keep only business entity field (EIN)

### Contract / Agreement Page Fixes

- [x] Fix text positioning — PDF_FIELDS coordinates recalibrated against template grid overlay
- [x] Make text **bigger and clearer** — switched to HelveticaBold, increased font sizes
- [x] Fix **date fields** — new `formatPdfDate` helper avoids `toLocaleDateString` locale inconsistencies
- [x] Add **employee name** to contract — Exhibit A (Page 7) personnel table + cover page names
- [x] Overall layout and field placement rework — white-out rectangles for yellow placeholders, all coordinates recalibrated
