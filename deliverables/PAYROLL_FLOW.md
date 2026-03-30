# Payroll Flow

## 1. Pay Periods (Semi-Monthly)

Each month has **2 pay periods**:

| Period | Dates | Auto-Generated |
|--------|-------|----------------|
| Period 1 | 8th - 21st of the month | On the 22nd |
| Period 2 | 22nd - 7th of next month | On the 8th |

- Pay periods are generated locally on the frontend for the dropdown selector.
- `PayrollPeriod` records in the database are created per-client when admin sets a payroll date or finalizes payroll.

---

## 2. Daily Time Tracking

1. Employees clock in/out daily via the dashboard.
2. System creates a **WorkSession** for each clock-in/clock-out.
3. System auto-generates a **TimeRecord** per day containing:
   - `totalMinutes` - Total worked minutes
   - `breakMinutes` - Break time
   - `overtimeMinutes` - Overtime detected
4. TimeRecord status flow:
   - `PENDING` → `AUTO_APPROVED` (if no OT) or stays `PENDING` (if OT needs approval)
   - Client/Admin approves → `APPROVED`
   - Client/Admin rejects → `REJECTED`
5. If overtime is detected, an **OvertimeRequest** is created:
   - Type: `SHIFT_EXTENSION` (stayed late) or `OFF_SHIFT` (worked outside schedule)
   - Status: `PENDING`

---

## 3. OT Approval (Before Payroll)

- Client or admin approves/rejects OT requests from the Approvals page.
- On approve:
  - `OvertimeRequest.status` → `APPROVED`
  - `TimeRecord.shiftExtensionStatus` or `extraTimeStatus` → `APPROVED`
  - If all OT for that day is approved, `TimeRecord.status` → `APPROVED`
- On reject:
  - OT minutes are excluded from payable time (denied OT deducted).

### Outstanding Approved OT

If OT is approved **after** a payroll period has been finalized:
- System automatically creates a **bonus adjustment** in the **next** payroll period.
- Labeled as: "Outstanding approved OT from [date] ([hours]h x $[rate])"
- This ensures employees are paid for late-approved overtime.

---

## 4. Payroll Page (Admin)

### Action Cards

| Card | Description |
|------|-------------|
| **Next Payroll Date** | Shows cutoff date for the current period. Admin can update with confirmation. Notifications sent to all employees and clients. |
| **Unapproved OT** | Shows count of pending OT entries. Admin can send reminders (see Notifications section below). |

### Employees Tab

- **Stats Pills**: Hours, OT, Approved, Pending, Bonuses, Deductions, Gross Pay
- **Employee Table**: Expandable rows showing:
  - Hours Worked (with OT breakdown)
  - PTO / VTO Hours
  - Pending Approval hours
  - Total Hours
  - Bonuses / Deductions
  - Gross Pay
  - Action: Add Adjustment (Bonus or Deduction)
- **Expanded Row**: Daily time records with clock in/out, hours, OT, breaks, status. Adjustments list with delete option.

### Payroll Periods Tab

- Shows all pay periods grouped by date range across all clients.
- Columns: Period, Cutoff Date, Total Hours, Gross Pay, Status, Actions
- Actions:
  - **Lock** - Prevents changes to time records (OPEN periods only)
  - **Unlock** - Re-opens a locked period
  - **Finalize** - Generates payslips (available for OPEN and LOCKED periods)
  - **Report** - Opens detailed payroll report page

---

## 5. Pay Calculation

### Per Employee

```
Payable Minutes = Total Minutes - Denied OT Minutes
Regular Minutes = Payable Minutes - Approved OT Minutes
OT Minutes = Approved OT Minutes

Regular Pay = (Regular Minutes / 60) x Hourly Rate
OT Pay = (OT Minutes / 60) x Overtime Rate (default: 1x hourly)
Gross Pay = Regular Pay + OT Pay + Bonuses - Deductions - Employee Default Deduction
```

### Rate Resolution Order

Rates are resolved in this priority (first match wins):

1. `ClientEmployee.hourlyRate` — Per-employee assignment rate override
2. `Employee.billingRate` — Employee's billing rate
3. `ClientGroup.billingRate` — Client-group specific billing rate
4. `Group.billingRate` — Group default billing rate
5. `ClientPolicy.defaultHourlyRate` — Client policy default

Overtime rate follows the same priority. If no overtime rate is set, defaults to **1x hourly rate**.

---

## 6. Finalize Payroll (Process Payroll)

When admin clicks "Process Payroll" and confirms:

1. **Payslips Generated** — Creates a `Payslip` record per employee-client combination containing:
   - Regular hours, overtime hours, total hours
   - Hourly rate, overtime rate
   - Regular pay, overtime pay
   - Total bonuses, total deductions
   - Gross pay, work days
   - Status: `GENERATED`
2. **PayrollPeriod Finalized** — Status set to `FINALIZED`, stores total hours, finalized timestamp.
3. Uses `upsert` — Running again updates existing payslips rather than creating duplicates.

### Warnings

- Pending OT records are excluded from payroll.
- If approved later, they become "Outstanding approved OT" bonuses in the next period.

---

## 7. Notifications & Reminders

### Payroll Date Updated (triggered when admin updates payroll cutoff date)

| Recipient | Channel | Message |
|-----------|---------|---------|
| All active employees | In-app notification | "The next payroll date has been updated to [date]. Please ensure all your time entries are submitted and approved before this date." |
| All active clients | In-app notification | "The next payroll date has been updated to [date]. Please ensure all time entries are approved before this date." |

- Employee notification links to `/employee/payslips`
- Client notification links to `/client/approvals`

### Send OT Reminder (triggered manually by admin from Payroll page)

| Recipient | Channel | Message |
|-----------|---------|---------|
| Clients with pending OT | In-app notification + Email | "You have X unapproved overtime entries (Yh total) pending approval. Please review and approve before payroll processing." |
| Employees with pending OT | In-app notification | "You have overtime entries pending client approval. Please ensure your time entries are accurate." |

- Client notification links to `/client/approvals?type=auto-overtime`
- Groups pending OT by client and sends one notification per client
- Shows summary: "Reminders sent to X client(s) and Y employee(s)"
- If no pending OT exists, shows: "No pending OT to send reminders for"

### Payroll Deadline Reminder (automated cron job)

| Recipient | Channel | Trigger |
|-----------|---------|---------|
| Clients | In-app notification + Email | 3 days and 1 day before cutoff date |

---

## 8. Employee Side

| Feature | Description |
|---------|-------------|
| **Dashboard** | Shows "Next Payroll Date" card with cutoff date and days remaining |
| **Payslips Page** (`/employee/payslips`) | Lists all generated payslips by period |
| **Payslip Detail** | Daily timesheet table, pay calculation breakdown (regular + OT + bonuses - deductions = gross pay), CSV export |

---

## 9. Client Side

| Feature | Description |
|---------|-------------|
| **Dashboard** | Shows "Next Payroll Date" card |
| **Notifications** | Receives notification when payroll date is updated |
| **Approvals** | Approve/reject employee OT before payroll cutoff |

---

## 10. Payroll Audit Logs

Separate page (`/admin/payroll/audit-logs`) in the sidebar showing:

- History of all payroll date changes
- Previous date → New date
- Who changed it and when
- Notes

Logs are stored in `PayrollDateLog` table and created automatically whenever `updatePayrollCutoff` is called.

---

## 11. Payroll Report

Accessed from Payroll Periods tab → Report button.

- Per-employee breakdown: Days worked, Total Hours, OT Hours, Rate, Gross Pay
- Supports mid-period rate changes (splits into sub-rows per rate period)
- Grand total row
- Download as CSV

---

## Flow Diagram

```
Employee clocks in/out daily
         |
         v
WorkSession created → TimeRecord auto-generated
         |
         v
OT detected? → OvertimeRequest created (PENDING)
         |
         v
Client/Admin approves time records + OT requests
         |
         v
Admin opens Payroll page
  - Reviews hours, OT, pending items
  - Adds bonus/deduction adjustments
  - Updates payroll date if needed (notifications sent)
         |
         v
Admin clicks "Process Payroll" → Confirmation dialog
         |
         v
Payslips generated for all employees across all clients
PayrollPeriod status → FINALIZED
         |
         v
Employees see payslips in their portal
Clients notified
         |
         v
Any OT approved after finalization?
  → Auto-creates "Outstanding approved OT" bonus
    in the next payroll period
```

---

## Database Models

| Model | Purpose |
|-------|---------|
| `WorkSession` | Individual clock-in/clock-out session |
| `TimeRecord` | Daily aggregated time record per employee |
| `OvertimeRequest` | OT approval request (SHIFT_EXTENSION / OFF_SHIFT) |
| `PayrollPeriod` | Pay period per client with status and cutoff date |
| `PayrollAdjustment` | Bonus or deduction for an employee in a period |
| `Payslip` | Generated pay record per employee-client-period |
| `PayrollDateLog` | Audit log for payroll date changes |

---

## Cron Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| Weekly Invoice | Every Wednesday 05:10 UTC | Generate invoices for weekly clients |
| Bi-Weekly Invoice | 3rd & 17th 05:15 UTC | Generate invoices for bi-weekly clients |
| Monthly Invoice | 3rd of month 05:05 UTC | Generate invoices for monthly clients |
| Payroll Deadline Reminder | Daily | Notify clients 3 days and 1 day before cutoff |
