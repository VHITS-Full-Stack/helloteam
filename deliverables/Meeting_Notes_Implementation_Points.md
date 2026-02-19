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
