# Hello Team Workforce Hub - Phase 2 Sprint Plan

## Phase 2: Approvals, Requests & Payroll Readiness

**Process Control & Validation Phase**

This phase introduces approval workflows and payroll validation. Building on the foundation of Phase 1, Phase 2 adds the business logic for time approvals, leave management, and payroll preparation.

---

## Phase 2 Overview

### Objectives
- Implement comprehensive approval workflows for time entries
- Build leave and availability request system with policy enforcement
- Create payroll readiness and validation tools
- Add notification system for pending actions
- Implement audit trails for all changes

### Key Features
1. **Client Portal**: Time approval workflows, overtime management, alerts
2. **Employee Portal**: Leave requests, availability management, balance tracking
3. **Admin Portal**: Time adjustments, policy management, payroll controls

---

## Sprint 8: Client Portal - Time Approvals & Notifications ✅

**Duration:** 2 weeks
**Status:** COMPLETE

### Objectives
- Enable clients to review and approve/reject time entries
- Implement modification workflow with justification
- Build notification system for pending actions

### Tasks

#### 8.1 Time Entry Review System
| ID | Task | Acceptance Criteria | Status |
|----|------|---------------------|--------|
| T-8.1.1 | Create time entry review page | - Daily/weekly view toggle<br>- Filter by employee, status, date | ✅ |
| T-8.1.2 | Implement bulk selection | - Select all/none<br>- Select by employee | ✅ |
| T-8.1.3 | Add approve/reject actions | - Single and bulk actions<br>- Confirmation dialogs | ✅ |
| T-8.1.4 | Build modification form | - Edit start/end times<br>- Mandatory justification field<br>- Original vs modified comparison | ✅ |

#### 8.2 Overtime Management
| ID | Task | Acceptance Criteria | Status |
|----|------|---------------------|--------|
| T-8.2.1 | Create overtime requests list | - Pending requests highlighted<br>- Sort by date/employee | ✅ |
| T-8.2.2 | Implement overtime approval flow | - Approve with optional notes<br>- Reject with mandatory reason | ✅ |
| T-8.2.3 | Add overtime summary dashboard | - Weekly overtime by employee<br>- Cost projections | ✅ |

#### 8.3 Notifications & Alerts (Partial - Deferred)
| ID | Task | Acceptance Criteria | Status |
|----|------|---------------------|--------|
| T-8.3.1 | Create notification center | - Bell icon with count badge<br>- Dropdown notification list | Deferred |
| T-8.3.2 | Implement alert persistence | - Alerts remain until actioned<br>- Mark as read functionality | Deferred |
| T-8.3.3 | Add payroll deadline reminders | - Countdown to payroll cutoff<br>- Warning for unapproved hours | Deferred |
| T-8.3.4 | Build email notification service | - Pending approval emails<br>- Daily digest option | Deferred |

#### 8.4 Backend API Development
| ID | Task | Acceptance Criteria | Status |
|----|------|---------------------|--------|
| T-8.4.1 | Time approval endpoints | - GET/PUT for approvals<br>- Bulk approval endpoint | ✅ |
| T-8.4.2 | Overtime management endpoints | - CRUD for overtime requests<br>- Approval/rejection endpoints | ✅ |
| T-8.4.3 | Notification endpoints | - GET notifications<br>- Mark read/unread | Deferred |

#### 8.5 Additional Features Completed
| Feature | Description |
|---------|-------------|
| Time Entries Page | Employee portal with tabs (Timesheets, Manual Time Card, Time Slider) |
| Week/Day Toggle | Switch between weekly and daily views with date navigation |
| Collapsible Sections | Group entries by date with collapse/expand functionality |
| Session Logs | Comprehensive audit trail with Timesheet History modal |
| Approval Logging | Client and admin approval actions logged with timestamps |
| Sound Effects | Audio feedback for clock in/out actions |
| Floating Notes | Quick notes feature in time clock section |

### Deliverables
- [x] Time entry review and approval UI
- [x] Overtime management system
- [ ] Notification center (Deferred to future sprint)
- [ ] Email notification integration (Deferred to future sprint)
- [x] API endpoints for core features
- [x] Session logs and audit trail
- [x] Time Entries page with tabs and views

---

## Sprint 9: Employee Portal - Leave & Availability ✅

**Duration:** 2 weeks
**Status:** COMPLETE (Leave System - Availability Deferred)

### Objectives
- Build leave request submission system
- Implement availability management
- Create balance tracking and display
- Enforce client-specific policies

### Tasks

#### 9.1 Leave Request System
| ID | Task | Acceptance Criteria | Status |
|----|------|---------------------|--------|
| T-9.1.1 | Create leave request form | - Date range selector<br>- Leave type dropdown<br>- Reason field | ✅ |
| T-9.1.2 | Implement leave type options | - Based on client policy<br>- Paid/unpaid indication | ✅ |
| T-9.1.3 | Add short notice warning | - Flag requests < 2 weeks<br>- Advisory message display | ✅ |
| T-9.1.4 | Build request history view | - Status tracking<br>- Filter by status/date | ✅ |

#### 9.2 Leave Balance Management
| ID | Task | Acceptance Criteria | Status |
|----|------|---------------------|--------|
| T-9.2.1 | Display leave balances | - By leave type<br>- Used vs remaining | ✅ |
| T-9.2.2 | Implement balance validation | - Prevent over-request<br>- Warning for low balance | ✅ |
| T-9.2.3 | Add accrual tracking | - Show accrual schedule<br>- Projected balance | Partial (Schema ready) |

#### 9.3 Availability Requests (Deferred)
| ID | Task | Acceptance Criteria | Status |
|----|------|---------------------|--------|
| T-9.3.1 | Create availability request form | - Date/time selection<br>- Recurring option | Deferred |
| T-9.3.2 | Build availability calendar | - Visual availability display<br>- Edit/delete options | Deferred |
| T-9.3.3 | Implement request cancellation | - Cancel pending requests<br>- Reason for cancellation | ✅ (For Leave) |

#### 9.4 Approval Status Tracking
| ID | Task | Acceptance Criteria | Status |
|----|------|---------------------|--------|
| T-9.4.1 | Create approval flow visualization | - Employee -> Client -> Admin<br>- Current status highlight | ✅ |
| T-9.4.2 | Add status notifications | - Approval/rejection alerts<br>- In-app and email | Deferred |

#### 9.5 Backend API Development
| ID | Task | Acceptance Criteria | Status |
|----|------|---------------------|--------|
| T-9.5.1 | Leave request endpoints | - CRUD operations<br>- Validation logic | ✅ |
| T-9.5.2 | Balance calculation service | - Accrual logic<br>- Usage tracking | ✅ |
| T-9.5.3 | Availability endpoints | - Request submission<br>- Calendar data | Deferred |

#### 9.6 Additional Features Completed
| Feature | Description |
|---------|-------------|
| Leave Balance Model | Database schema with LeaveBalance and LeaveBalanceAdjustment tables |
| Policy-Based Leave Options | Leave types filtered based on client policy settings |
| Paid Leave Entitlement Types | Support for NONE, FIXED, ACCRUED, MILESTONE entitlement types |
| Short Notice Detection | Automatic flagging for requests < 2 weeks in advance |
| Balance Tracking | Pending requests tracked separately from used balance |
| Carryover Support | Schema supports leave balance carryover between years |
| Detail Modal | View leave request details with approval flow visualization |

### Deliverables
- [x] Leave request form and history
- [x] Balance display and tracking
- [ ] Availability request system (Deferred to future sprint)
- [x] Approval status visualization
- [x] Policy-enforced validation
- [x] API endpoints for leave system

---

## Sprint 10: Admin Portal - Time Adjustments & Audit Trail ✅

**Duration:** 2 weeks
**Status:** COMPLETE

### Objectives
- Enable admin time record adjustments
- Implement full audit trail
- Build client re-approval workflow
- Create adjustment reporting

### Tasks

#### 10.1 Time Record Adjustments
| ID | Task | Acceptance Criteria | Status |
|----|------|---------------------|--------|
| T-10.1.1 | Create adjustment interface | - Search employee records<br>- Date range filter | ✅ |
| T-10.1.2 | Build edit form | - Modify start/end times<br>- Add/remove hours<br>- Split sessions | ✅ |
| T-10.1.3 | Implement mandatory notes | - Required field validation<br>- Character minimum (10 chars) | ✅ |
| T-10.1.4 | Add original value preservation | - Show before/after<br>- No data loss | ✅ |

#### 10.2 Audit Trail System
| ID | Task | Acceptance Criteria | Status |
|----|------|---------------------|--------|
| T-10.2.1 | Create audit log table | - All changes recorded<br>- User, timestamp, action | ✅ |
| T-10.2.2 | Build audit log viewer | - Filterable by user/date/type<br>- Export functionality (CSV) | ✅ |
| T-10.2.3 | Add change comparison view | - Side-by-side diff<br>- Highlight changes | ✅ |

#### 10.3 Client Re-approval Workflow
| ID | Task | Acceptance Criteria | Status |
|----|------|---------------------|--------|
| T-10.3.1 | Implement re-approval trigger | - Auto-flag adjusted records<br>- Notify client | ✅ |
| T-10.3.2 | Block payroll until approved | - Status check before processing<br>- Warning indicators | ✅ |
| T-10.3.3 | Add escalation mechanism | - Reminder schedule<br>- Admin override option | Deferred |

#### 10.4 Backend API Development
| ID | Task | Acceptance Criteria | Status |
|----|------|---------------------|--------|
| T-10.4.1 | Adjustment endpoints | - Create/update adjustments<br>- History retrieval | ✅ |
| T-10.4.2 | Audit log service | - Automatic logging<br>- Query endpoints | ✅ |
| T-10.4.3 | Re-approval workflow endpoints | - Trigger re-approval<br>- Check approval status | ✅ |

#### 10.5 Additional Features Completed
| Feature | Description |
|---------|-------------|
| TimeAdjustment Model | Database schema tracking all adjustments with before/after values |
| AuditLog Enhanced Model | Uses AuditAction enum (CREATE, UPDATE, DELETE, APPROVE, REJECT, etc.) |
| Adjustment History Modal | View complete history of adjustments for any time record |
| Stats Dashboard | Audit log stats showing counts by action type and entity |
| CSV Export | Export audit logs to CSV with all relevant fields |
| Re-approval Workflow | Adjusted approved records automatically flagged for client re-approval |
| Pending Re-approvals Page | Admin view of all records awaiting client re-approval |

### Deliverables
- [x] Time adjustment interface
- [x] Comprehensive audit trail
- [x] Client re-approval workflow
- [x] Adjustment reports
- [x] API endpoints

---

## Sprint 11: Admin Portal - Leave Policy Management ✅

**Duration:** 2 weeks
**Status:** COMPLETE

### Objectives
- Build leave policy configuration per client
- Implement policy enforcement engine
- Create manual balance adjustment tools
- Add policy reporting

### Tasks

#### 11.1 Policy Configuration
| ID | Task | Acceptance Criteria | Status |
|----|------|---------------------|--------|
| T-11.1.1 | Create policy settings UI | - Per-client configuration<br>- Enable/disable options | ✅ |
| T-11.1.2 | Implement paid leave config | - Type selection (fixed/accrued/milestone/none)<br>- Annual allocation | ✅ |
| T-11.1.3 | Build unpaid leave config | - Enable/disable<br>- Notice requirements | ✅ |
| T-11.1.4 | Add overtime policy settings | - Requires approval toggle<br>- Threshold configuration | ✅ |

#### 11.2 Accrual Logic
| ID | Task | Acceptance Criteria | Status |
|----|------|---------------------|--------|
| T-11.2.1 | Implement accrual calculation | - Based on policy type<br>- Pro-rated for partial years | ✅ |
| T-11.2.2 | Build milestone tracking | - Anniversary dates<br>- Milestone triggers | Partial |
| T-11.2.3 | Add carryover rules | - Max carryover amount<br>- Expiration dates | ✅ |

#### 11.3 Manual Adjustments
| ID | Task | Acceptance Criteria | Status |
|----|------|---------------------|--------|
| T-11.3.1 | Create balance adjustment form | - Add/deduct balance<br>- Mandatory reason | ✅ |
| T-11.3.2 | Build adjustment history | - Track all manual changes<br>- Filter by employee | ✅ |

#### 11.4 Leave Approval Admin
| ID | Task | Acceptance Criteria | Status |
|----|------|---------------------|--------|
| T-11.4.1 | Create pending requests queue | - All clients view<br>- Filter by status/client | ✅ |
| T-11.4.2 | Implement admin approval | - Final approval step<br>- Override capability | ✅ |
| T-11.4.3 | Add rejection workflow | - Reason required<br>- Notification to employee | ✅ |

#### 11.5 Backend API Development
| ID | Task | Acceptance Criteria | Status |
|----|------|---------------------|--------|
| T-11.5.1 | Policy configuration endpoints | - CRUD for policies<br>- Validation rules | ✅ |
| T-11.5.2 | Accrual service | - Calculation logic<br>- Scheduled updates | ✅ |
| T-11.5.3 | Balance management endpoints | - Adjustments<br>- History retrieval | ✅ |

#### 11.6 Additional Features Completed
| Feature | Description |
|---------|-------------|
| Leave Policy Page | Tabbed UI with Policy Config, Leave Balances, and Approvals tabs |
| Policy Config Modal | Configure paid/unpaid leave, entitlement type, carryover, overtime per client |
| Balance Management | View employee balances by client/year with adjustment capabilities |
| Manual Adjustments | ADD, DEDUCT, CARRYOVER, RESET balance with mandatory reason |
| Run Accrual | Manual trigger for monthly accrual calculation (ACCRUED policy type) |
| Approval Queue | All pending leave requests with bulk approve, individual approve/reject |
| Stats Dashboard | Leave approval stats (pending, client-approved, approved, rejected) |

### Deliverables
- [x] Policy configuration UI
- [x] Accrual calculation engine
- [x] Manual balance adjustment tools
- [x] Admin leave approval queue
- [x] Policy enforcement
- [x] API endpoints

---

## Sprint 12: Payroll Readiness & Controls

**Duration:** 2 weeks
**Status:** Pending

### Objectives
- Build payroll readiness dashboard
- Implement cutoff enforcement
- Create payroll export/reports
- Add override capabilities

### Tasks

#### 12.1 Payroll Dashboard
| ID | Task | Acceptance Criteria |
|----|------|---------------------|
| T-12.1.1 | Create payroll overview | - Hours by client<br>- Approval status summary |
| T-12.1.2 | Build readiness indicators | - Green/yellow/red status<br>- Action required list |
| T-12.1.3 | Add unapproved time report | - List all pending<br>- Filter by client/employee |
| T-12.1.4 | Implement disputed time view | - Show modified entries<br>- Awaiting re-approval |

#### 12.2 Cutoff Management
| ID | Task | Acceptance Criteria |
|----|------|---------------------|
| T-12.2.1 | Create cutoff configuration | - Set payroll period<br>- Define cutoff date/time |
| T-12.2.2 | Implement cutoff enforcement | - Block late submissions<br>- Warning before cutoff |
| T-12.2.3 | Add override functionality | - Admin override option<br>- Audit log entry |

#### 12.3 Payroll Reports
| ID | Task | Acceptance Criteria |
|----|------|---------------------|
| T-12.3.1 | Create payroll summary report | - Hours by employee<br>- Regular vs overtime |
| T-12.3.2 | Build export functionality | - CSV/Excel export<br>- PDF generation |
| T-12.3.3 | Add historical payroll view | - Past payroll periods<br>- Comparison tools |

#### 12.4 Approval Finalization
| ID | Task | Acceptance Criteria |
|----|------|---------------------|
| T-12.4.1 | Create finalization workflow | - Lock payroll period<br>- Prevent further changes |
| T-12.4.2 | Implement confirmation step | - Review summary<br>- Admin sign-off |

#### 12.5 Backend API Development
| ID | Task | Acceptance Criteria |
|----|------|---------------------|
| T-12.5.1 | Payroll endpoints | - Readiness check<br>- Summary data |
| T-12.5.2 | Report generation service | - PDF/Excel generation<br>- Scheduled reports |
| T-12.5.3 | Cutoff management endpoints | - Configuration<br>- Override |

### Deliverables
- [ ] Payroll readiness dashboard
- [ ] Cutoff enforcement system
- [ ] Export and reporting tools
- [ ] Finalization workflow
- [ ] API endpoints

---

## Sprint 13: Integration & Testing Phase 2

**Duration:** 2 weeks
**Status:** Pending

### Objectives
- End-to-end testing of all Phase 2 features
- Performance optimization
- Bug fixes and polish
- Documentation

### Tasks

#### 13.1 Integration Testing
| ID | Task | Acceptance Criteria |
|----|------|---------------------|
| T-13.1.1 | Test approval workflows | - All scenarios covered<br>- Edge cases handled |
| T-13.1.2 | Test leave request flow | - Policy enforcement working<br>- Balance tracking accurate |
| T-13.1.3 | Test payroll readiness | - Correct calculations<br>- Export working |
| T-13.1.4 | Test notifications | - All triggers working<br>- Email delivery |

#### 13.2 Performance & Security
| ID | Task | Acceptance Criteria |
|----|------|---------------------|
| T-13.2.1 | Performance testing | - Response times < 2s<br>- No memory leaks |
| T-13.2.2 | Security audit | - All endpoints protected<br>- Input validation |
| T-13.2.3 | Load testing | - Handle concurrent users<br>- No degradation |

#### 13.3 Documentation
| ID | Task | Acceptance Criteria |
|----|------|---------------------|
| T-13.3.1 | API documentation | - All endpoints documented<br>- Example requests |
| T-13.3.2 | User guides | - Admin workflow guide<br>- Client approval guide |

### Deliverables
- [ ] All tests passing
- [ ] Performance benchmarks met
- [ ] Security audit complete
- [ ] Documentation complete

---

## Summary

| Sprint | Focus Area | Duration | Key Deliverables | Status |
|--------|-----------|----------|------------------|--------|
| Sprint 8 | Client Portal - Time Approvals | 2 weeks | Approval UI, Overtime, Session Logs | ✅ Complete |
| Sprint 9 | Employee Portal - Leave & Availability | 2 weeks | Leave Requests, Balance Tracking, Policy Enforcement | ✅ Complete |
| Sprint 10 | Admin Portal - Time Adjustments | 2 weeks | Adjustments, Audit Trail, Re-approval | ✅ Complete |
| Sprint 11 | Admin Portal - Leave Policy Management | 2 weeks | Policy Config, Accruals, Admin Approval | ✅ Complete |
| Sprint 12 | Payroll Readiness & Controls | 2 weeks | Dashboard, Cutoffs, Reports | Pending |
| Sprint 13 | Integration & Testing | 2 weeks | Testing, Security, Documentation | Pending |

**Total Phase 2 Duration: 12 weeks**
**Current Progress: 4/6 sprints complete**

### Sprint 9 Notes
- Availability requests deferred to future sprint (leave system prioritized)
- In-app/email notifications deferred (aligned with Sprint 8 notification deferral)
- Automated accrual calculation ready in schema, requires scheduled job implementation

### Sprint 10 Notes
- Escalation mechanism (reminders, admin override) deferred to future sprint
- TimeAdjustment model tracks all field changes with before/after values
- AuditLog enhanced with AuditAction enum for better categorization
- Client re-approval workflow automatically triggers when approved records are adjusted
- CSV export available for audit logs with comprehensive filtering

### Sprint 11 Notes
- Milestone-based tracking partially implemented (schema ready, UI supports config)
- Manual accrual trigger available for monthly calculation
- Balance adjustment supports ADD, DEDUCT, CARRYOVER, RESET types with audit trail
- Leave approval queue supports bulk approve with individual approve/reject actions
- LeavePolicy page accessible at /admin/leave-policy

---

## Database Schema Additions for Phase 2

```prisma
// Notification System
model Notification {
  id          String    @id @default(uuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  type        NotificationType
  title       String
  message     String
  data        Json?
  isRead      Boolean   @default(false)
  actionUrl   String?
  createdAt   DateTime  @default(now())
  readAt      DateTime?
}

enum NotificationType {
  APPROVAL_REQUIRED
  APPROVAL_RECEIVED
  LEAVE_REQUEST
  OVERTIME_REQUEST
  PAYROLL_REMINDER
  SYSTEM_ALERT
}

// Audit Log
model AuditLog {
  id          String    @id @default(uuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  action      String
  entityType  String
  entityId    String
  oldValue    Json?
  newValue    Json?
  notes       String?
  ipAddress   String?
  createdAt   DateTime  @default(now())
}

// Payroll Period
model PayrollPeriod {
  id          String    @id @default(uuid())
  clientId    String
  client      Client    @relation(fields: [clientId], references: [id])
  startDate   DateTime
  endDate     DateTime
  cutoffDate  DateTime
  status      PayrollStatus @default(OPEN)
  finalizedAt DateTime?
  finalizedBy String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

enum PayrollStatus {
  OPEN
  LOCKED
  FINALIZED
}
```

---

## Dependencies

- Phase 1 must be complete (all sprints done)
- Email service configuration required
- PDF generation library needed
- Excel export library needed

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Complex approval logic | High | Clear state machine design |
| Policy variations | Medium | Flexible configuration system |
| Payroll accuracy | Critical | Comprehensive testing |
| Notification overload | Medium | Smart batching and preferences |

---

*Document Created: January 30, 2026*
*Project: Hello Team Workforce Hub Platform*
*Version: 1.0 - Phase 2 Planning*
