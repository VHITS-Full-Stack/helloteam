# HelloTeam — Product Roadmap

> Last updated: 2026-02-14

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

## 1. Employee Onboarding Portal `[ ]`

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

## 2. Client Access Control `[ ]`

**Goal:** Clients cannot access the portal until their contract is signed.

**Rules:**
- Contract not signed → redirect to onboarding / block login
- Contract signed (`onboardingStatus === 'COMPLETED'`) → unlock portal
- Client cannot see or contact employees before contract signing

---

## 3. Client Portal `[ ]` *blocked by #2*

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

## 6. Timesheet Auto-Approval `[ ]` *blocked by #3*

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

## 7. Auto Billing & Invoicing `[ ]` *blocked by #6*

**Goal:** Approved timesheets automatically generate invoices and charge the client.

**Flow:**
```
Approved Timesheets → Generate Invoice → Charge CC on file → Done
```

**Details:**
- Invoice frequency based on agreement type (weekly / monthly)
- Auto-charge client's credit card on file
- Invoice PDF generation
- Invoice history for client and admin
- Continuous automated cycle

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
Phase 1 — Core                    Phase 2 — Operations           Phase 3 — Communication
─────────────────                 ──────────────────────          ───────────────────────
1. Employee Onboarding      ───▶  4. Timesheet Auto-Approval     7. Chat System
2. Client Access Control    ───▶  5. Auto Billing & Invoicing    8. Task Management
3. Client Portal                  6. Employee Termination

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

---

## Already Completed

- [x] Client onboarding (3-step wizard: business info → payment → sign)
- [x] Admin client management (table view)
- [x] Admin client detail (compact 2-column layout)
- [x] Agreement PDF generation with pdf-lib
- [x] Client portal basic structure
- [x] Employee management (CRUD, groups, assignments)
- [x] Time tracking (clock in/out)
- [x] Overtime flow
