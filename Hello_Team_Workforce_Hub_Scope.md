# Hello Team Workforce Hub Platform

**Proposal Document**

| | |
|---|---|
| **Prepared For** | The Hello Team |
| **Prepared By** | Dev Thakkar |
| **Authorized By** | Kiran Patel |
| **Issued On** | 18.12.2025 |
| **Valid Till** | 23.12.2025 |

---

## Project Understanding

The Hello Team Workforce Platform is designed as a centralized operational platform to manage remote workforce activity, client approvals, payroll preparation, monitoring integrations, and employee engagement within a single, fully branded environment owned by Hello Team.

### Objective

Replace fragmented tools, manual coordination, and approval gaps with a structured system that delivers:
- Clarity
- Accountability
- Operational consistency
- Supportive and organized experience for employees

### Platform Structure

The solution is built around three interconnected portals:

| Portal | Description |
|--------|-------------|
| **Employee Workspace** | Supportive, structured, people-focused |
| **Client Oversight Console** | Clear, approval-driven, authoritative |
| **Operations Panel** | Controlled, auditable, policy-managed |

Each environment functions independently while remaining connected through shared workflows, approvals, and system controls.

---

## Technical Specifications & Team Involvement

### Technology Stack

| Module | Technology |
|--------|------------|
| Design | Figma or XD |
| Frontend | React JS |
| Backend | Node JS |
| Database | MongoDB |
| Server | AWS Cloud or relevant |

### Team Composition

1. Project Manager
2. Business Analyst
3. UI/UX Designer
4. Frontend Developer
5. Backend Developer
6. Quality Analyst
7. DevOps Engineer

---

## Working Methodology

A dynamic framework enabling iterative and collaborative development:

1. Project Discovery
2. Project Kick-Off Call
3. Sprint Planning for the Project
4. User Stories Creation
5. Wire-framing and UI/UX
6. Development Stage (Milestone Based)
7. QA Stage and Bug Fixing
8. Sprint Demo and Delivery
9. Milestone Demo and Delivery
10. Final UAT
11. Deployment and Go Live
12. Training and Support

---

## Scope of Work

### Client Side Portal

**Visibility, Approval & Workforce Control**

The Client Oversight Console provides clients with real-time insight and structured control over their assigned workforce. It ensures transparency, timely approvals, and billing readiness without manual follow-ups.

#### Client Access & Login
- Secure client login environment
- Password recovery functionality
- Role-based access within the client organization (if applicable)
- Session timeout and security enforcement
- Compatible across desktop and modern devices

#### Client Dashboard
The dashboard provides immediate visibility into:
- All employees assigned to the client
- Employees currently in active work sessions
- Session start times
- Live work duration for the current day
- Items requiring action (approvals, requests, payroll alerts)

#### Live Workforce View
Clients can access a real-time workforce view displaying:
- Employee name and profile photo
- Current work status (working, on break, logged out)
- Session start time
- Live active duration
- Monitoring indicators from Teramind (active, idle, offline)
- Direct access to detailed monitoring within Teramind

#### Work Time Review & Confirmation
Clients are able to:
- Review daily and weekly work records
- Approve or decline submitted time entries
- Modify entries with mandatory justification
- Review and approve adjustments made by Hello Team
- Approve or reject additional work requests
- Approve previously unconfirmed work time

#### Alerts & Notifications
The system proactively notifies clients of:
- Pending work confirmations
- Additional work requests awaiting approval
- Unconfirmed hours approaching payroll cut-off
- Payroll deadline reminders
- Pending manual adjustments

*Alerts remain visible until action is taken.*

#### Monitoring Visibility (Teramind Integration)
Clients can view:
- Productivity summaries
- Activity timelines
- Screenshots (where enabled)
- Online and offline patterns
- Direct links to detailed employee views within Teramind

#### Billing & Payment Review
Clients can manage billing-related items including:
- Invoice history
- PDF invoice downloads
- Approved work summary downloads
- Payment history
- Securely stored payment methods
- Automatic weekly billing based on approved work
- Approval of bonuses or rate adjustments

#### QuickBooks Desktop (On-Premise)
- Invoices can be pushed to QuickBooks, or
- Generated internally, with QuickBooks used for accounting records only

---

### Employee Side Portal

**Digital Work Environment for Remote Employees**

The Employee Workspace is designed as a structured digital office that supports daily work routines, clarity of expectations, and easy access to internal support.

From login onward, the system clearly communicates:
- Work expectations and assigned schedules
- Current system time and work status
- Required actions for the day
- Availability of internal assistance

#### Employee Access & Authentication
- Secure login using assigned employee credentials
- Password reset and recovery functionality
- Session controls to prevent unauthorized or parallel logins
- Automatic logout after a defined period of inactivity
- Optimized for desktop usage with modern browsers
- Upon successful login, employees are taken directly to their daily work overview

#### Work Session Start & End (Clock In / Clock Out)

**Session Start Interface Displays:**
- Current system time
- Assigned shift details for the day
- Arrival status indicator (early, on time, delayed)
- Primary action button to start or end the session

**During an Active Session:**
- Live counter showing total active work time
- Break duration tracking (where applicable)
- Clear indication of current work status

*Optional branded confirmations (visual or audio) provide positive feedback when sessions start or end.*

#### Schedule Visibility
Employees have continuous access to their schedules, including:
- Current day schedule
- Weekly schedule overview
- Upcoming schedule changes
- Automatic notifications when schedules are updated

#### Availability & Leave Requests

Availability and leave options are governed by client-specific policies and enforced by the system.

**Unpaid Availability Requests:**
- Employees see only options enabled by their assigned client
- Standard notice expectation of two weeks
- Requests submitted with shorter notice remain allowed but are flagged with a system message
- Approval flow: **Employee -> Client -> Hello Team**

**Paid Leave Requests (Where Applicable):**
- Fixed annual allocations
- Accrued entitlements over time
- Milestone-based eligibility
- No paid leave entitlement

**System Controls Include:**
- Automatic tracking of available balance
- Prevention of requests exceeding entitlement
- Clear display of remaining balance
- Allowance for short-notice requests with advisory messaging

#### Work Records & Time History
Employees can review a transparent record of their work activity, including:
- Complete history of logged work sessions
- Approved work hours
- Approved additional work time
- Adjusted or rejected entries with visible explanations
- Optional summarized view for payroll reference

#### Employee Support & Internal Communication
Employees can privately communicate with Hello Team through:
- Support request submissions
- Direct internal messaging
- Meeting or call requests
- Secure document uploads
- Follow-up communications

*All communication in this section is strictly private and not visible to clients.*

#### Engagement & Wellbeing Check-Ins
To promote engagement and emotional connection, the workspace includes:
- Optional daily wellbeing status check
- Short comments or feedback entries
- Encouraging system messages
- Internal announcements from Hello Team

---

### Admin & Management Portal

#### Admin Access & Security

**Administrative Login:**
- Secure admin login with credential-based authentication
- Completely separate admin environment from employee and client portals
- Password recovery and session timeout controls

**Role-Based Access Control:**
- Ability to define multiple admin roles (e.g., Super Admin, Operations, HR, Finance, Support)
- Permissions controlled per role, including:
  - View-only access
  - Edit permissions
  - Approval authority
  - Override capabilities

#### Operations Dashboard (System-Wide Overview)

The dashboard includes:
- Total active employees
- Total active clients
- Employees currently in active work sessions
- Pending time approvals across all clients
- Outstanding availability and leave requests
- Pending additional work (overtime) requests
- Payroll readiness indicators
- Open employee support tickets
- Alerts requiring immediate attention

*This dashboard functions as the daily command center for Hello Team operations.*

#### Employee Administration

Capabilities include:
- Viewing complete employee profiles
- Assigning or reassigning employees to clients
- Reviewing employee schedules
- Viewing historical work patterns and attendance trends
- Reviewing approved and declined work time
- Monitoring additional work history
- Viewing employee wellbeing check-ins (internal visibility only)
- Activating or deactivating employee access when required

#### Client Administration

This includes:
- Creating and maintaining client accounts
- Assigning employees to specific clients
- Defining client-specific operational rules
- Configuring availability, leave, and additional work policies
- Reviewing client approval behavior (pending, delayed, completed)
- Monitoring payroll readiness per client
- Triggering reminders or escalation alerts

#### Time Record Adjustments & Corrections

Supported actions include:
- Adding or removing work hours
- Adjusting session start and end times
- Splitting work sessions
- Marking time as non-working
- Applying paid or unpaid leave manually

**Governance & Controls:**
- Mandatory notes required for every adjustment
- Original entries remain visible for audit purposes
- All changes are automatically routed to the client for confirmation
- Adjusted time does not affect payroll or billing until approved

#### Availability & Leave Policy Management

Capabilities include:
- Enabling or disabling paid leave options
- Configuring unpaid availability-only clients
- Defining accrual or allocation logic
- Setting fixed, milestone-based, or time-based eligibility
- Manually adjusting balances when required
- Reviewing historical usage per employee

*All rules are enforced automatically across employee and client views.*

#### Additional Work (Overtime) Oversight

This includes:
- Pending additional work requests
- Client-approved additional work
- Client-rejected additional work
- Approved but unbilled additional work
- Unapproved work that may impact payroll

#### Payroll Readiness & Validation

Admins can:
- Review payroll-ready hours per client
- Identify unapproved or disputed work time
- Trigger payroll cut-off reminders
- Override payroll dates when necessary
- Confirm which hours will be included in payroll
- Prevent unapproved time from being processed

#### Billing & Invoice Administration

Capabilities include:
- Generating invoices based on approved work time
- Applying bonuses, adjustments, or rate changes
- Reviewing billing summaries before release
- Pushing invoices to QuickBooks Desktop (On-Premise)
- Generating invoices internally where required
- Tracking invoice status and payment history

#### Internal Support & Communication Management

This includes:
- Viewing all employee support requests
- Accessing private employee conversations
- Tracking ticket status (open, in progress, resolved)
- Assigning tickets internally to team members
- Responding directly within the platform
- Adding internal notes (admin-only visibility)

*Clients do not have access to this area.*

#### Notifications & System Controls

Capabilities include:
- Triggering platform-wide notifications
- Sending targeted alerts to specific clients
- Sending approval and payroll reminders
- Controlling automated notification settings
- Monitoring alert effectiveness

#### Monitoring Integration Management (Teramind)

Admins can:
- Configure Teramind integration settings
- Map employees to monitoring accounts
- Control data visibility permissions
- Troubleshoot synchronization issues
- Ensure monitoring data is accurately reflected in client views

#### Audit Logs & Activity History

Logs include:
- Login activity (employees, clients, admins)
- Time record changes and approvals
- Availability and leave actions
- Additional work approvals
- Payroll and billing actions
- Support interactions

*Every significant action within the system is fully traceable.*

---

## Phases

The platform will be delivered in three structured phases, ensuring operational stability first, followed by approvals & billing, and finally advanced controls, integrations, and governance.

### Phase 1 - Core Workforce Operations & Visibility

**Foundation Release (MVP - Operational Readiness)**

This phase establishes secure access, workforce visibility, and time tracking without any monitoring integration.

#### 1. Client Side Portal - Workforce Visibility

**Objective:** Provide real-time visibility into assigned employees.

**Features Included:**
- Secure client login & authentication
- Password recovery
- Session timeout and security enforcement
- Responsive design for desktop and modern devices
- Client dashboard displaying:
  - All assigned employees
  - Employees currently in active work sessions
  - Session start times
  - Live work duration
  - Items requiring attention (non-monitoring related)
- Live workforce view:
  - Employee name & profile photo
  - Current work status (working, on break, logged out)
  - Session start time
  - Live active duration

#### 2. Employee Side Portal - Daily Work Environment

**Objective:** Enable structured work sessions and schedule clarity.

**Features Included:**
- Secure employee login & authentication
- Session controls to prevent parallel logins
- Automatic logout on inactivity
- Clock In / Clock Out functionality
- Live work timer and break tracking (where applicable)
- Work session interface displaying:
  - Current system time
  - Assigned shift details
  - Arrival status indicator
- Schedule visibility:
  - Daily and weekly schedules
  - Notifications for schedule changes
- Work records & time history:
  - Logged sessions
  - Approved work hours
  - Adjusted or rejected entries with explanations

#### 3. Admin & Management Portal - Operational Control

**Objective:** Centralized administration and real-time operational oversight.

**Features Included:**
- Secure admin login (separate environment)
- Role-based access control
- Operations dashboard showing:
  - Active employees and clients
  - Employees currently working
  - Pending approvals
  - Open support tickets
- Employee administration:
  - Employee profile management
  - Client assignments
  - Schedule visibility
  - Access activation/deactivation
- Client administration:
  - Client account creation
  - Employee assignment to clients
  - Basic client rule configuration

---

### Phase 2 - Approvals, Requests & Payroll Readiness

**Process Control & Validation Phase**

This phase introduces approval workflows and payroll validation without monitoring data.

#### 1. Client Side Portal - Approvals & Confirmations

**Features Included:**
- Review daily and weekly work records
- Approve or decline submitted time
- Modify time entries with mandatory justification
- Approve or reject:
  - Additional work (overtime)
  - Unconfirmed work time
- Review and approve Hello Team adjustments
- Alerts & notifications:
  - Pending approvals
  - Additional work requests
  - Unconfirmed hours approaching payroll cutoff
  - Payroll deadline reminders
- Alerts persist until action is taken

#### 2. Employee Side Portal - Availability & Leave

**Features Included:**
- Availability and leave requests governed by client rules
- Unpaid availability requests with notice guidance
- Paid leave options (where applicable):
  - Fixed, accrued, milestone-based, or none
- Automatic leave balance tracking
- Prevention of requests exceeding entitlement
- Approval flow: **Employee -> Client -> Hello Team**

#### 3. Admin Portal - Time, Policy & Payroll Oversight

**Features Included:**
- Time record adjustments with full audit trail
- Mandatory notes for all manual changes
- Client re-approval required before payroll impact
- Availability & leave policy management per client
- Additional work oversight:
  - Pending, approved, rejected, and unbilled overtime
- Payroll readiness controls:
  - Review payroll-ready hours
  - Identify unapproved or disputed time
  - Enforce payroll cutoffs

---

### Phase 3 - Billing, Monitoring Integrations & Governance

**Financial Automation & Advanced Controls**

This phase introduces Teramind monitoring, billing automation, accounting integrations, and compliance governance.

#### 1. Monitoring Integration (Teramind)

**Admin-Controlled Integration Capabilities:**
- Configuration of Teramind integration
- Employee-to-monitoring account mapping
- Permission and visibility controls
- Synchronization monitoring and issue handling
- Ensuring accurate reflection of monitoring status in the platform

**Client Visibility:**
- Productivity summaries
- Activity timelines
- Online / offline patterns
- Screenshots (where enabled)
- Direct links to Teramind employee views

#### 2. Billing & Invoice Management

**Client & Admin Capabilities:**
- Invoice generation based on approved work time
- Invoice history and PDF downloads
- Approved work summaries
- Bonus and rate adjustment approvals
- Payment history tracking
- Secure payment method storage
- Automatic weekly billing
- QuickBooks integration:
  - Push invoices to QuickBooks, or
  - Generate invoices internally with accounting sync

#### 3. Payroll Validation & System Governance

**Features Included:**
- Final payroll validation before processing
- Override payroll dates (admin-controlled)
- Prevention of unapproved time processing
- Internal support & communication management:
  - Employee support tickets
  - Internal messaging
  - Ticket assignment and resolution
- Notifications & system controls:
  - Platform-wide alerts
  - Client-specific reminders
- Audit logs & activity history:
  - Login events
  - Time record changes
  - Approvals
  - Leave and availability actions
  - Payroll and billing activities
  - Support interactions

---

## Out of Scope

- Mobile applications (iOS / Android)
- Multi-language support
- Advanced compliance requirements (HIPAA, SOC 2, etc.)
- Third-party license or subscription costs (Teramind, payment gateways, etc.)
- Data migration from existing or legacy systems

---

## Change Management

Any changes or additions beyond the agreed scope will be handled through a formal Change Request process, including:
- Scope impact
- Timeline impact
- Cost impact

*Development will proceed only after mutual agreement and written approval.*

---

## Hello Team Responsibilities

- Timely feedback and approvals
- Access to Teramind APIs and related documentation
- Provision of branding assets (logos, colors, brand guidelines)
- Designation of a single point of contact

---

## General Terms and Conditions

- The client is responsible for providing a server for deployment. However, the technical team will deploy a test and staging server for development and testing purposes.
- Any paid API or third-party API required for real-time data retrieval must be provided by the client. The team will facilitate the integration of these APIs into the platform as per project requirements.
- Any additional requirements not specified in this Proposal will be quoted separately. The client will be notified of the cost and timeline associated with such requirements before proceeding with implementation.
- Standard security features will be implemented within the platform to safeguard user data and ensure secure transactions. These security measures will be in accordance with industry best practices and standards.
- All intellectual property rights associated with the deliverables, including but not limited to code, designs, and documentation, shall belong to the client upon final payment, unless otherwise specified in the contract agreement.
- This Proposal, together with any attachments or exhibits, constitutes the entire agreement between the parties regarding the subject matter herein and supersedes all prior or contemporaneous agreements and understandings, whether oral or written.

---

## Contact Information

| | |
|---|---|
| **Email** | hello@web30india.com |
| **Phone (India)** | +91 95109 87700 |
| **Phone (UK)** | +44 20 3290 7090 |
| **Website** | www.web30india.com |

---

*Prepared by Web 3.0 India - A Unit of Virtual Height IT Services Pvt. Ltd.*
