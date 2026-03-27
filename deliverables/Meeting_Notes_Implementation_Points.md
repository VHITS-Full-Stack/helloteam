# Meeting Notes - Implementation Points

**Date:** February 19, 2026

---

## 1. Employee-Client Assignment (Mandatory)

- **Cannot create a client without assigning at least one employee** — employee name must appear in the contract
- One employee works for **one client only** at a time
- Employees can be **switched/reassigned** from one client to another (remove from old client, assign to new)

---

## 2. Paid Time Off (PTO) — Per Client & Per Employee

- PTO must be configurable **per client** (client allows or disallows PTO)
- PTO schedule must also be configurable **per employee** under a client
  - Example: Employee A gets 3 days PTO every 6 months
  - Example: Employee B gets 14 days PTO per year
  - Example: Employee C has no PTO
- Different employees under the same client can have **different PTO schedules**

---

## 3. Rate Change History (Separate Page)

- Track **all changes** to employee billing rate and payment rate
- Record the **date of each change**
- This must be a **dedicated, separate page** — not just in the general activity history
- Page name suggestion: **"Billing & Pay Raise History"**
- Purpose: Clients and admins need to quickly look up when the last rate change was made

---

## 4. Auto Clock-Out & Overtime System

### 4.1 Automatic Clock-Out

- The system **automatically clocks out** the employee at the end of their scheduled shift
- **30 minutes before** the shift ends: system sends a notification
  - "You will be automatically clocked out at [time]. If you need overtime, please request it now."
- This gives the client time to review and approve/deny the overtime request before the shift ends

### 4.2 If Overtime Is Pre-Approved

- The system will **NOT auto clock-out** the employee
- System asks: "You have approved overtime. Do you want to use it?"
- If employee presses **Yes** → stays clocked in, overtime period begins
- The shift continues seamlessly (no separate clock-in needed for pre-approved shift extensions)

### 4.3 If Overtime Is NOT Approved

- System **automatically clocks the employee out** at shift end
- Employee **can still clock back in**, but the system shows a warning:
  - "You have no approved overtime. If you clock in, you may not get paid for these hours. This is unapproved overtime and requires special approval at the client's discretion."
- Employee can choose to proceed or not

### 4.4 Early Clock-In (Before Schedule)

- Employees are **allowed** to clock in early (e.g., schedule starts at 9 AM, employee clocks in at 7 AM)
- System shows a warning: "Your shift hasn't started yet. You may not get paid for these hours."
- The early hours are logged as **overtime** within the same timesheet
- The timesheet is **one continuous entry**, but early hours are marked differently (e.g., red/orange) as overtime
- These early overtime hours need **separate approval**
- **Remove the current 15-minute buffer** — all pre-schedule time is considered overtime

### 4.5 Two Types of Overtime

| Type | Description | Flow |
|------|------------|------|
| **Shift Extension** | Employee needs to continue working past their scheduled shift end | Requested 30 min before shift ends. Employee picks a time to extend to (e.g., extend to 7 PM). If approved, no auto clock-out. |
| **Off-Shift Hours** | Employee needs to work at a completely different time outside their schedule | Employee requests specific date + time range (e.g., 10 PM - 1 AM). If approved, system treats it as a scheduled block. Employee clocks in/out for that block. |

---

## 5. Timesheet Display & Color Coding

### 5.1 Time Records Page

- **Weekly timesheet** broken down by day (default view)
- Filterable by specific date
- Show three totals:
  1. **Total Regular Hours** (scheduled)
  2. **Total Approved Overtime**
  3. **Total Unapproved Overtime** (worked but not yet approved)

### 5.2 Color Coding

| Color | Meaning |
|-------|---------|
| **Green** | Scheduled hours AND approved overtime (both are payable) |
| **Red / Orange** | Unapproved overtime — needs client approval |

- Once overtime is approved, it turns green (same as regular hours)
- Unapproved overtime **cannot be billed** until approved

### 5.3 Timesheet Approval Rules

- **Regular timesheets cannot be denied** — client can only **request revisions**
- **Overtime can be approved or denied**

---

## 6. Approvals Page vs. Time Records Page

### Time Records Page
- For viewing and approving **timesheets** (actual worked hours)
- Shows regular hours + overtime hours with color coding
- Overtime approval/denial happens here

### Approvals Page
- For **future requests** only:
  - PTO / VTO leave requests
  - Future overtime requests (pre-approval for upcoming overtime)
- Two types of overtime requests on this page:
  1. **Overtime Work Requests** — Employee requests to work overtime in the future (pre-approval). If approved, the system schedules it and treats it as a regular shift block.
  2. **Overtime Approval Requests** — Employee already worked overtime without pre-approval and is requesting retroactive approval to get paid.

---

## 7. Aggressive Overtime Approval Notifications

**Critical requirement:** Unapproved overtime must trigger persistent, aggressive notifications to clients.

### Notification Channels
- **Dashboard:** Prominent "Pending Actions" section showing unapproved overtime count
- **Login Blocker:** Before accessing the app, a large pop-up/modal:
  - "Your employee(s) have worked overtime that has not been approved. Please approve or deny. Employees will NOT get paid until this is resolved."
- **Daily Email Notifications** to the client about pending unapproved overtime
- **Daily Text/SMS Notifications** to the client about pending unapproved overtime

### Messaging Tone
- Urgent and clear
- Emphasize: "We cannot pay your employee for these hours until you approve or deny"
- Continue notifications **daily** until all overtime is approved or denied

---

## 8. Employee Personal Tasks

- Employees should be able to **create their own personal tasks**
- Personal tasks are **private** — the client cannot see them
- This is separate from client-assigned tasks (which are already implemented)

---

## 9. Completed Features (Confirmed Working)

- **Chat:** Client can message their employees (done)
- **Tasks (Client-side):** Client can create tasks with title, description, priority (high/medium/low), due date, employee assignment, status management (To Do / In Progress / Done), comments, table view, board view, filtering by employee and priority (done)

---

## 10. Invoice Page

- Invoice page needs to be **fully functional** — marked as the **most important** deliverable
- (Details to be discussed further)

---

## 21. MASTER FLOW — Shift Extension & Extra Time `[x]`

**Date:** February 24, 2026

> This note supersedes and expands upon notes #4, #5, #6, and #7 with comprehensive overtime logic.

### 21.1 Core Definitions `[x]`

#### Scheduled Time `[x]`
- [x] Work performed **inside the assigned schedule** (e.g., 9:00 AM–5:00 PM)
- [x] Automatically approved, billable, and payable — no client action required

#### Shift Extension `[x]`
- [x] A type of overtime **tied to an active scheduled shift**
- [x] Employee continues working past the scheduled end of the shift
- [x] **Shift Extension is NOT an approval status** — it is only a type of time
- [x] Shift Extension can occur: with approval, without approval, with a pending request, or without any request
- [x] Examples: 9:00 AM–5:00 PM extended until 6:00 PM; employee stays late without asking; employee requests extension during shift
- [x] Always remains tied to the original shift

#### Extra Time `[x]`
- [x] Work **not tied to an active scheduled shift**
- [x] Employee works outside assigned shift hours at another time
- [x] Examples: Early clock-in before shift starts (8:45 AM), separate evening work block (9:00 PM–12:00 AM), work on unscheduled day
- [x] Separate category from Shift Extension

---

### 21.2 Employee Clock-In Logic `[x]`

| Scenario | Result |
|----------|--------|
| **Clock-in during schedule** | Scheduled Time (normal behavior) |
| **Early clock-in (before shift start)** | Extra Time — system warns: "You are clocking in before your scheduled shift. This will be recorded as Extra Time and may require client approval before payment." |

- [x] Early clock-in is **Extra Time** (not Shift Extension) because the shift has not started yet

---

### 21.3 Shift Extension Flow `[x]`

#### Request During Active Shift
- [x] Employee may request: **Shift Extension** (stay longer today) or **Extra Time later** (separate off-shift work)
- [x] Employee selects: time needed + optional reason
- [x] Client receives: SMS, Email, Portal notification

#### Approval States (Important Clarity)
Shift Extension itself **never changes name** — only the approval status changes:

| State | Meaning |
|-------|---------|
| **Shift Extension — Approved** | Client approved the extension |
| **Shift Extension — Pending Request** | Request submitted but not yet decided |
| **Shift Extension — Unapproved Worked Time** | Employee worked extension without approval |

---

### 21.4 End of Shift Flow `[x]`

#### 30 Minutes Before End
- [x] Popup: "Your shift ends at 5:00 PM. Do you need more time today?"
- [x] Buttons: **Request Shift Extension** | **No, I'm good**
- [x] Only Shift Extension is offered here (employee is inside an active shift)
> Verified: `shiftEnd.job.ts` line 92 checks `minutesUntilEnd <= 30`. Frontend `Dashboard.jsx` shows shift-ending modal.

#### Scheduled End Time Arrives (e.g., 5:00 PM)
- [x] System automatically begins clock-out process — this is a **controlled pause**, NOT a normal clock-out
- [x] Timer pauses. Employee sees: "The system is automatically clocking you out now."
- [x] Options: **Continue Working** | **Stay Clocked Out**
> Verified: `shiftEnd.job.ts` sets `shiftEndPausedAt`, frontend shows 2-min countdown modal.

| Employee Action | Result |
|----------------|--------|
| **Continues working** | [x] Reason is **mandatory**. Time resumes from exactly 5:00 PM. Same timesheet continues. Color changes to Shift Extension (unapproved). Status: **Shift Extension — Unapproved Worked Time** |
| **Does nothing (2 min timeout)** | [x] System completes clock-out. Clock-out time = exactly 5:00 PM |
| **Has pending request (not yet approved)** | [x] Status: **Shift Extension — Pending Request**. If employee continues working, status becomes **Shift Extension — Unapproved Worked Time** (pending ≠ approved) |

---

### 21.5 Extra Time Flow `[x]`

- [x] Occurs only when work is **outside any active shift** (early start, evening work, off-day work)
- [x] Employee may request approval in advance
- [x] If worked without approval: status = **Extra Time — Unapproved Worked Time**

---

### 21.6 Client Experience (Clear Separation) `[x]`

Client portal contains **TWO completely separate areas**:

#### 6.1 Approvals Page — Requests (Future / Live) `[x]`
- [x] Purpose: Approval decisions **before** work is finalized
- [x] Client sees: Shift Extension requests, Extra Time requests
- [x] Status examples: Pending Shift Extension Request, Pending Extra Time Request
- [x] Actions: **Approve** | **Deny**
- [x] If approved → employee works without risk warnings

#### 6.2 Timesheet Page — Work Already Done (MOST IMPORTANT) `[x]`
- [x] Purpose: Approve or deny **time already worked**
- [x] This page receives **highest system pressure**

| Timesheet Section | Client Action |
|-------------------|---------------|
| **Scheduled Time** | [x] Auto approved. No action required. |
| **Shift Extension (Worked)** — e.g., 5:00 PM–5:22 PM | [x] Approve or Deny (reason required if denied) |
| **Extra Time (Worked)** — e.g., Early Start 8:45 AM–9:00 AM | [x] Approve or Deny |

---

### 21.7 Client Pressure System (Critical) `[x]`

- [x] System heavily nags **ONLY for worked time not approved yet**:
  - Shift Extension — Unapproved Worked Time
  - Extra Time — Unapproved Worked Time
- [x] Notifications occur: before weekly billing closes, before payroll dates
- [x] Message intent: "Employee already worked this time. Approval is needed so they can be paid."
- [x] **Prioritized over future requests**

---

### 21.8 Invoice Logic `[x]`

| Invoice Includes | Invoice Excludes |
|-----------------|------------------|
| [x] Scheduled Time | [x] Unapproved worked time |
| [x] Approved Shift Extensions | [x] Pending requests not yet worked |
| [x] Approved Extra Time | |

- [x] Before invoice generation: system checks for unapproved worked Shift Extensions and Extra Time, sends approval reminders

---

### 21.9 Payroll Logic `[x]`

- [x] Employee paid **only for**: Scheduled Time, Approved Shift Extensions, Approved Extra Time
- [x] Unapproved worked time remains **unpaid until approved**

---

### 21.10 Timesheet Visual Structure (Color System) `[x]`

| Color | Meaning |
|-------|---------|
| [x] **Blue** | Scheduled Time |
| [x] **Green** | Approved OT (Shift Extension or Extra Time) |
| [x] **Orange** | Worked but Unapproved |
| [x] **Red** | Denied |

---

### 21.11 Final System Model `[x]`

| Employee Action | System Classification |
|----------------|----------------------|
| [x] Staying late after shift | Shift Extension |
| [x] Working at a different time | Extra Time |
| [x] Early clock-in | Extra Time |

---

## Summary of Implementation Priorities

1. **Auto Clock-Out + Overtime System** (shift extension + off-shift hours + early clock-in)
2. **Invoice Page** (most important deliverable)
3. **Timesheet color coding & approval flow** (green/red, approve/deny/request revisions)
4. **Aggressive overtime notifications** (dashboard, login blocker, daily email + SMS)
5. **Approvals page** (PTO/VTO requests + overtime requests — both pre-approval and retroactive)
6. **Employee-Client mandatory assignment**
7. **PTO per client & per employee**
8. **Rate Change History page**
9. **Employee personal tasks**

---
---

# Meeting Notes — March 26, 2026

**Attendees:** Zevi Rubin (Client), Nikita Karanpuria (Dev), Hitendrasinh Chauhan (Dev Lead)

---

## 1. OT Without Prior Approval — Must Show in Timesheets & Approvals

- When an employee clicks **"Continue Working"** past their shift end (without prior approval) and clocks out, that extra time **must appear** as **"OT Without Prior Approval"** in:
  - Client Approvals page (OT Without Prior Approval tab)
  - Client Time Records / Timesheets
  - Admin Approvals page
- **Bug found during demo:** OT was not showing up after the Continue Working flow. Needs fix.

---

## 2. Rename Overtime Column

- The **"Overtime"** column in timesheets should be renamed to **"Approved Overtime"** to distinguish from unapproved OT.

---

## 3. "Continue Working" Warning

- When employee clicks **"Continue Working"**, show a **warning** that they might not get paid (since it's not pre-approved).

---

## 4. Overtime Logic (Confirmed)

| Scenario | Result |
|----------|--------|
| Employee requests extension, client **approves**, works OT | Approved Overtime |
| Employee requests extension, **not approved**, stays late | OT Without Prior Approval |
| Employee presses nothing, continues past shift | OT Without Prior Approval |
| Employee clicks "Continue Working", works past shift | OT Without Prior Approval |

---

## 5. Sandbox / Demo Environment

- Zevi needs a **sandbox** where system time can be changed for testing (no waiting in real-time for shift-end popups).

---

## 6. Timesheet Approval Flow (Client Side)

- Regular timesheets: Client should have **Approve/Reject buttons** (not just auto-approve).
- **Auto-approve after 24 hours** if client doesn't act.
- OT Without Prior Approval: Regular hours auto-approve, but unapproved OT does **NOT** auto-approve — client must explicitly approve/reject.

---

## 7. PDF Timesheets

- PDF format confirmed good by Zevi.
- **Admin side needs:** PDF timesheet download with custom date ranges (1 week, 1 month, custom), per employee, per group filtering.
- **Client side needs:** Custom date filtering for time records.

---

## 8. Groups (Admin Only)

- Groups needed on **admin side only** (move from client side to admin).
- Purpose: Organize employees for easier management (timesheets by group, review by group).
- Invoices remain per individual employee, not per group.

---

## 9. CRM / Ticket Management

- No CRM currently for employee tickets/support. Need to add (already in scope).

---

## 10. Check Digit / Payment Integration

- Open Check Digit account for payment API testing.
- Zevi to provide credentials.

---

## Action Items — March 26, 2026

| # | Action | Owner |
|---|--------|-------|
| 1 | Fix OT Without Prior Approval not showing after "Continue Working" flow | Nikita |
| 2 | Rename "Overtime" to "Approved Overtime" in timesheets | Nikita |
| 3 | Add warning to "Continue Working" popup about possible non-payment | Nikita |
| 4 | Add Approve/Reject buttons for regular timesheets (auto-approve after 24h) | Nikita / Hitendrasinh |
| 5 | Add custom date range filters to client-side time records | Nikita |
| 6 | Add PDF timesheet download from admin with date/employee/group filters | Nikita |
| 7 | Move Groups from client to admin side | Hitendrasinh |
| 8 | Provide sandbox with time control for testing | Hitendrasinh |
| 9 | Add CRM / ticket management | Hitendrasinh |
| 10 | Set up Check Digit account for payment API testing | Zevi / Hitendrasinh |
