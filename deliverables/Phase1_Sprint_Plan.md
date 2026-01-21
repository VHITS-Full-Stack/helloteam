# Phase 1 Sprint Plan - Core Workforce Operations & Visibility

**Project:** Hello Team Workforce Hub Platform
**Phase:** Phase 1 - Foundation Release (MVP - Operational Readiness)
**Total Duration:** 12 weeks (6 sprints)

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React.js + Vite + Tailwind CSS |
| **Backend** | Node.js + TypeScript + Express |
| **Database** | PostgreSQL + Prisma ORM |
| **Authentication** | JWT (JSON Web Tokens) |
| **API** | RESTful API |

---

## Overview

Phase 1 establishes secure access, workforce visibility, and time tracking across three interconnected portals:
- Employee Workspace
- Client Oversight Console
- Operations Panel (Admin)

---

## Sprint 1: Authentication & Core Infrastructure ✅

**Duration:** 2 weeks
**Status:** COMPLETE

### Objectives
- Implement secure authentication system for all user types
- Establish role-based access control
- Build core UI component library

### User Stories

#### 1.1 Authentication System
| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-1.1.1 | As a user, I can log in securely with my credentials | - Login form with email/password validation<br>- Error messages for invalid credentials<br>- Redirect to appropriate dashboard based on role |
| US-1.1.2 | As a user, I can recover my password | - Password reset request form<br>- Email verification flow<br>- Secure password reset link |
| US-1.1.3 | As an employee, I cannot have parallel login sessions | - Detect existing sessions<br>- Force logout of previous session<br>- Notification to user |
| US-1.1.4 | As a user, I am automatically logged out after inactivity | - Configurable timeout period<br>- Warning before logout<br>- Secure session termination |

#### 1.2 Role-Based Access Control
| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-1.2.1 | As an admin, I can define user roles | - Super Admin, Operations, HR, Finance, Support roles<br>- Role assignment during user creation |
| US-1.2.2 | As a system, I enforce route protection | - Unauthorized routes redirect to login<br>- Role-specific route access |
| US-1.2.3 | As a user, I see only features permitted for my role | - Dynamic menu based on permissions<br>- Hidden/disabled actions for unauthorized features |

#### 1.3 Core UI Components
| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-1.3.1 | Build responsive layout system | - Desktop-optimized design<br>- Modern browser compatibility<br>- Consistent spacing and typography |
| US-1.3.2 | Create reusable component library | - Button, Card, Input, Modal, Table, Badge, Avatar, StatCard<br>- Consistent styling across portals |

### Deliverables
- [x] Login page for all user types
- [x] Password recovery flow (forgot password + reset password pages)
- [x] Session management system (with timeout warning modal)
- [x] Role-based routing (ProtectedRoute component)
- [x] Core component library (Button, Card, Input, Modal, Table, Badge, Avatar, StatCard)
- [x] Remember me functionality
- [x] Email service placeholder for password reset

### Completion Status: **COMPLETE**

---

## Sprint 1.5: Employee & Client Management ✅

**Duration:** 1 week
**Status:** COMPLETE

### Objectives
- Implement CRUD operations for employee management
- Implement CRUD operations for client management
- Build dedicated detail pages for clients
- Establish basic RBAC on API routes

### User Stories

#### 1.5.1 Employee Management
| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-1.5.1.1 | As an admin, I can view all employees | - Employee list with pagination<br>- Search and filter functionality<br>- Status badges (Active/Inactive) |
| US-1.5.1.2 | As an admin, I can create new employees | - Employee creation form with validation<br>- Auto-create user account with credentials<br>- Success feedback and list refresh |
| US-1.5.1.3 | As an admin, I can edit employee details | - Edit form pre-populated with current data<br>- Update status (Active/Inactive)<br>- Modal closes on success |
| US-1.5.1.4 | As an admin, I can delete employees | - Confirmation dialog before deletion<br>- Soft delete (deactivation)<br>- List refresh after deletion |
| US-1.5.1.5 | As an admin, I can assign employees to clients | - Client selection dropdown<br>- Assignment feedback<br>- Update employee's client info |

#### 1.5.2 Client Management
| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-1.5.2.1 | As an admin, I can view all clients | - Client cards with company info<br>- Employee count per client<br>- Policy badges |
| US-1.5.2.2 | As an admin, I can create new clients | - Client creation form with policy config<br>- Auto-create user account<br>- Leave and overtime policy setup |
| US-1.5.2.3 | As an admin, I can view client details | - Dedicated detail page (not popup)<br>- Contact info, policies, assigned employees<br>- Navigation from client list |
| US-1.5.2.4 | As an admin, I can edit client details | - Edit form with all client fields<br>- Policy configuration update<br>- Status management |
| US-1.5.2.5 | As an admin, I can delete clients | - Confirmation dialog<br>- Soft delete (deactivation)<br>- Cascade handling for assignments |
| US-1.5.2.6 | As an admin, I can manage client employees | - View assigned employees<br>- Assign/remove employees<br>- Bulk assignment support |

#### 1.5.3 Basic RBAC Implementation
| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-1.5.3.1 | API routes protected by role | - `authorizeRoles` middleware<br>- Different access levels per endpoint |
| US-1.5.3.2 | Delete operations restricted | - Only SUPER_ADMIN and ADMIN can delete<br>- Other roles can view/edit |

### Deliverables
- [x] Employee list page with CRUD operations
- [x] Client list page with CRUD operations
- [x] Client detail page with full information
- [x] Employee service (`employee.service.js`)
- [x] Client service (`client.service.js`)
- [x] Employee API routes with RBAC (`employee.routes.ts`)
- [x] Client API routes with RBAC (`client.routes.ts`)
- [x] Employee controller (`employee.controller.ts`)
- [x] Client controller (`client.controller.ts`)
- [x] Modal fixes (proper closing, transparent backdrop)

### Completion Status: **COMPLETE**

### Implementation Summary

#### Backend API Endpoints - Employees
| Method | Endpoint | Allowed Roles | Description |
|--------|----------|---------------|-------------|
| GET | `/api/employees` | SUPER_ADMIN, ADMIN, OPERATIONS, HR | List all employees |
| GET | `/api/employees/stats` | SUPER_ADMIN, ADMIN, OPERATIONS, HR | Employee statistics |
| GET | `/api/employees/:id` | SUPER_ADMIN, ADMIN, OPERATIONS, HR | Get single employee |
| POST | `/api/employees` | SUPER_ADMIN, ADMIN, OPERATIONS, HR | Create employee |
| PUT | `/api/employees/:id` | SUPER_ADMIN, ADMIN, OPERATIONS, HR | Update employee |
| DELETE | `/api/employees/:id` | SUPER_ADMIN, ADMIN | Delete (deactivate) employee |
| POST | `/api/employees/:id/assign` | SUPER_ADMIN, ADMIN, OPERATIONS, HR | Assign to client |
| POST | `/api/employees/:id/unassign` | SUPER_ADMIN, ADMIN, OPERATIONS, HR | Remove from client |

#### Backend API Endpoints - Clients
| Method | Endpoint | Allowed Roles | Description |
|--------|----------|---------------|-------------|
| GET | `/api/clients` | SUPER_ADMIN, ADMIN, OPERATIONS, HR, FINANCE | List all clients |
| GET | `/api/clients/stats` | SUPER_ADMIN, ADMIN, OPERATIONS, HR, FINANCE | Client statistics |
| GET | `/api/clients/:id` | SUPER_ADMIN, ADMIN, OPERATIONS, HR, FINANCE | Get single client |
| POST | `/api/clients` | SUPER_ADMIN, ADMIN | Create client |
| PUT | `/api/clients/:id` | SUPER_ADMIN, ADMIN, OPERATIONS | Update client |
| DELETE | `/api/clients/:id` | SUPER_ADMIN, ADMIN | Delete (deactivate) client |
| GET | `/api/clients/:id/employees` | SUPER_ADMIN, ADMIN, OPERATIONS, HR, FINANCE | Get client's employees |
| POST | `/api/clients/:id/employees` | SUPER_ADMIN, ADMIN, OPERATIONS, HR, FINANCE | Assign employees |
| DELETE | `/api/clients/:id/employees/:employeeId` | SUPER_ADMIN, ADMIN, OPERATIONS, HR, FINANCE | Remove employee |

#### Frontend Pages
| Page | Location | Description |
|------|----------|-------------|
| Employees | `pages/admin/Employees.jsx` | Employee list with CRUD modals |
| Clients | `pages/admin/Clients.jsx` | Client cards with CRUD modals |
| ClientDetail | `pages/admin/ClientDetail.jsx` | Dedicated client detail page |

#### Current RBAC Matrix (Basic)
| Role | Employees | Clients | Delete Access |
|------|-----------|---------|---------------|
| SUPER_ADMIN | Full | Full | Yes |
| ADMIN | Full | Full | Yes |
| OPERATIONS | View/Edit/Assign | View/Edit | No |
| HR | View/Edit/Assign | View | No |
| FINANCE | No | View | No |
| SUPPORT | No | No | No |

---

## Sprint 1.6: Granular RBAC & Permissions System ✅

**Duration:** 1 week
**Status:** COMPLETE

### Objectives
- Implement granular permission-based access control
- Create permissions matrix for all admin roles
- Build UI-level feature hiding based on permissions
- Add role management settings page

### User Stories

#### 1.6.1 Permission System
| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-1.6.1.1 | Define permission constants | - Create permissions enum/constants<br>- Group by feature area (employees, clients, reports, etc.) |
| US-1.6.1.2 | Map roles to permissions | - Permission matrix per role<br>- Configurable via database or config |
| US-1.6.1.3 | Backend permission middleware | - `hasPermission(permission)` middleware<br>- Granular route protection |

#### 1.6.2 UI-Level Access Control
| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-1.6.2.1 | Hide unauthorized actions | - Hide buttons/links user can't access<br>- `usePermissions` hook |
| US-1.6.2.2 | Dynamic navigation menu | - Show only accessible menu items<br>- Role-specific sidebar |
| US-1.6.2.3 | Disabled state for restricted features | - Grey out features without access<br>- Tooltip explaining restriction |

#### 1.6.3 Role Management (Admin Settings)
| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-1.6.3.1 | View role permissions | - Matrix view of roles vs permissions<br>- Read-only for non-SUPER_ADMIN |
| US-1.6.3.2 | Create custom roles | - SUPER_ADMIN can create new roles<br>- Assign permissions to role |
| US-1.6.3.3 | Edit role permissions | - SUPER_ADMIN can modify permissions<br>- Audit log for changes |

### Permission Categories (Proposed)
```
EMPLOYEES:
- employees.view
- employees.create
- employees.edit
- employees.delete
- employees.assign

CLIENTS:
- clients.view
- clients.create
- clients.edit
- clients.delete
- clients.manage_employees

TIME_RECORDS:
- time_records.view
- time_records.approve
- time_records.adjust
- time_records.export

REPORTS:
- reports.view
- reports.export
- reports.analytics

PAYROLL:
- payroll.view
- payroll.process
- payroll.export

SETTINGS:
- settings.view
- settings.edit
- settings.roles_manage

SUPPORT:
- support.view
- support.respond
- support.escalate
```

### Deliverables
- [x] Permission constants/enum definition (`backend/src/config/permissions.ts`)
- [x] Role-permission mapping configuration (database-driven with `Role` and `RolePermission` models)
- [x] `hasPermission` backend middleware (`backend/src/middleware/auth.middleware.ts`)
- [x] `usePermissions` React hook (`frontend/src/hooks/usePermissions.js`)
- [x] `PermissionGate` wrapper component (`frontend/src/components/auth/PermissionGate.jsx`)
- [x] Dynamic sidebar based on permissions (`frontend/src/components/layout/Sidebar.jsx`)
- [x] Role management page in Admin Settings (`frontend/src/pages/admin/Settings.jsx`)
- [x] Permission caching (5-minute TTL) with invalidation support

### Completion Status: **COMPLETE**

### Implementation Summary

#### Database Models (Prisma)
- **Role** - Stores custom roles with name, display name, description, and system flag
- **RolePermission** - Many-to-many relationship between roles and permission strings

#### Backend API Endpoints - Roles
| Method | Endpoint | Required Permission | Description |
|--------|----------|---------------------|-------------|
| GET | `/api/roles/my-permissions` | (authenticated) | Get current user's permissions |
| GET | `/api/roles/available-permissions` | settings.view | Get all available permissions |
| GET | `/api/roles` | settings.view | List all roles with permissions |
| GET | `/api/roles/:id` | settings.view | Get single role |
| POST | `/api/roles` | settings.manage_roles | Create new role |
| PUT | `/api/roles/:id` | settings.manage_roles | Update role |
| DELETE | `/api/roles/:id` | settings.manage_roles | Delete role |
| POST | `/api/roles/assign` | settings.manage_roles | Assign role to user |

#### Default Roles Seeded (8 roles)
1. **Super Administrator** - All permissions
2. **Administrator** - Most permissions except some settings
3. **Operations Manager** - Employees, clients, time records, reports
4. **HR Manager** - Employees, time records, approvals
5. **Finance Manager** - Clients, payroll, reports
6. **Support Agent** - Support tickets, basic views
7. **Employee** - Basic self-service permissions
8. **Client** - Client-specific view permissions

#### Permission Categories
- **EMPLOYEES** - view, create, edit, delete, assign, view_sensitive
- **CLIENTS** - view, create, edit, delete, manage_employees
- **TIME_RECORDS** - view, view_all, approve, adjust, export
- **REPORTS** - view, export, analytics
- **PAYROLL** - view, process, export
- **SETTINGS** - view, edit, manage_roles
- **SUPPORT** - view, respond, escalate, manage
- **APPROVALS** - view, approve_time, approve_leave, approve_overtime
- **SCHEDULING** - view, create, edit, delete

---

### Implementation Summary

#### Authentication System
- **Login Page** (`frontend/src/pages/auth/Login.jsx`)
  - Email/password validation with real-time feedback
  - Remember me checkbox for persistent sessions
  - Role-based redirect after login (Employee → /employee/dashboard, Client → /client/dashboard, Admin → /admin/dashboard)
  - Password visibility toggle

- **Forgot Password** (`frontend/src/pages/auth/ForgotPassword.jsx`)
  - Email input with validation
  - Password reset token generation
  - Beautiful HTML email templates (logged to console in development)

- **Reset Password** (`frontend/src/pages/auth/ResetPassword.jsx`)
  - Token-based password reset
  - Password strength validation (minimum 8 characters)
  - Confirmation on successful reset

- **Session Management**
  - 30-minute session timeout (configurable via `SESSION_TIMEOUT_MINUTES`)
  - Session timeout warning modal 5 minutes before expiry (`SessionTimeoutModal.jsx`)
  - Activity tracking (mousedown, keydown, scroll, touchstart, click events)
  - Session extension via API call
  - Parallel login prevention for employees

#### Role-Based Access Control
- **ProtectedRoute** (`frontend/src/components/auth/ProtectedRoute.jsx`)
  - Route protection based on user roles
  - Automatic redirect to login for unauthenticated users
  - Role-specific access enforcement

- **Supported Roles:**
  - SUPER_ADMIN, ADMIN, OPERATIONS, HR, FINANCE, SUPPORT (Admin Portal)
  - CLIENT (Client Portal)
  - EMPLOYEE (Employee Portal)

#### Backend API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login with JWT token |
| POST | `/api/auth/register` | User registration |
| POST | `/api/auth/logout` | User logout (invalidates session) |
| GET | `/api/auth/profile` | Get authenticated user profile |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password with token |
| POST | `/api/auth/change-password` | Change password (authenticated) |
| GET | `/api/auth/validate-session` | Validate & extend session |

#### Email Service
- **Email Templates** (`backend/src/services/email.service.ts`)
  - `sendPasswordResetEmail()` - Beautiful HTML password reset email
  - `sendWelcomeEmail()` - New user welcome email
  - `sendNotificationEmail()` - Generic notification email
  - Development mode: Logs to console
  - Production ready: Placeholder for SendGrid/AWS SES/Mailgun integration

#### Core UI Components
| Component | Location | Description |
|-----------|----------|-------------|
| Button | `components/common/Button.jsx` | Primary, secondary, outline, ghost variants |
| Card | `components/common/Card.jsx` | Container with padding and shadow |
| Input | `components/common/Input.jsx` | Form input with icon, label, error support |
| Modal | `components/common/Modal.jsx` | Dialog with backdrop |
| Badge | `components/common/Badge.jsx` | Status indicators |
| Avatar | `components/common/Avatar.jsx` | User profile images |
| StatCard | `components/common/StatCard.jsx` | Dashboard statistics display |
| Table | `components/common/Table.jsx` | Data table with sorting |

#### Demo Credentials
| Role | Email | Password |
|------|-------|----------|
| Employee | employee@demo.com | demo123456 |
| Client | client@demo.com | demo123456 |
| Admin | admin@demo.com | demo123456 |

---

## Sprint 2: Employee Portal - Work Sessions

**Duration:** 2 weeks

### Objectives
- Implement clock in/clock out functionality
- Build employee dashboard
- Create work session controls

### User Stories

#### 2.1 Clock In / Clock Out
| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-2.1.1 | As an employee, I can start my work session | - Clock In button clearly visible<br>- Display current system time<br>- Confirm session start |
| US-2.1.2 | As an employee, I can see my assigned shift details | - Shift start/end time displayed<br>- Break allowances shown |
| US-2.1.3 | As an employee, I can see my arrival status | - Early, On Time, or Delayed indicator<br>- Color-coded status |
| US-2.1.4 | As an employee, I can end my work session | - Clock Out button during active session<br>- Confirmation before ending<br>- Session summary displayed |

#### 2.2 Live Work Timer
| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-2.2.1 | As an employee, I can see my live work duration | - Real-time counter during active session<br>- Hours:Minutes:Seconds format |
| US-2.2.2 | As an employee, I can track my break time | - Break start/end functionality<br>- Break duration counter<br>- Total break time summary |

#### 2.3 Employee Dashboard
| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-2.3.1 | As an employee, I can see my current work status | - Working, On Break, or Logged Out status<br>- Visual status indicator |
| US-2.3.2 | As an employee, I can see today's schedule | - Shift times displayed<br>- Remaining work time shown |

### Deliverables
- [ ] Clock In/Out interface
- [ ] Live work timer component
- [ ] Break tracking system
- [ ] Employee dashboard
- [ ] Session state management

---

## Sprint 3: Employee Portal - Schedule & Time History

**Duration:** 2 weeks

### Objectives
- Implement schedule visibility features
- Build work records and time history views

### User Stories

#### 3.1 Schedule Visibility
| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-3.1.1 | As an employee, I can view my daily schedule | - Today's shift details<br>- Start time, end time, breaks |
| US-3.1.2 | As an employee, I can view my weekly schedule | - 7-day schedule overview<br>- Calendar or list view<br>- Total scheduled hours |
| US-3.1.3 | As an employee, I can see upcoming schedule changes | - Highlighted changes<br>- Change effective date |
| US-3.1.4 | As an employee, I receive notifications for schedule updates | - In-app notification<br>- Visual indicator for new changes |

#### 3.2 Work Records & Time History
| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-3.2.1 | As an employee, I can view my work session history | - List of all logged sessions<br>- Date, start time, end time, duration |
| US-3.2.2 | As an employee, I can see approved work hours | - Approved hours highlighted<br>- Approval date shown |
| US-3.2.3 | As an employee, I can see adjusted/rejected entries | - Visible explanations for changes<br>- Original vs adjusted values |
| US-3.2.4 | As an employee, I can view a payroll summary | - Total hours per pay period<br>- Breakdown by approved/pending |

### Deliverables
- [ ] Daily schedule view
- [ ] Weekly schedule calendar
- [ ] Schedule change notifications
- [ ] Work history list
- [ ] Time records summary

---

## Sprint 4: Client Portal - Dashboard & Live Workforce

**Duration:** 2 weeks

### Objectives
- Build client dashboard with workforce overview
- Implement live workforce monitoring view

### User Stories

#### 4.1 Client Dashboard
| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-4.1.1 | As a client, I can see all assigned employees | - Employee list with profile photos<br>- Total employee count |
| US-4.1.2 | As a client, I can see currently active employees | - Real-time count of working employees<br>- Visual distinction from offline |
| US-4.1.3 | As a client, I can see session start times | - Start time for each active employee<br>- Sorted by most recent |
| US-4.1.4 | As a client, I can see live work duration | - Real-time duration counter<br>- Per-employee display |
| US-4.1.5 | As a client, I can see items requiring attention | - Pending actions count<br>- Quick access to action items |

#### 4.2 Live Workforce View
| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-4.2.1 | As a client, I can see employee name and photo | - Profile photo display<br>- Full name visible |
| US-4.2.2 | As a client, I can see current work status | - Working, On Break, Logged Out<br>- Color-coded status badges |
| US-4.2.3 | As a client, I can see real-time updates | - Auto-refresh status<br>- No manual refresh required |
| US-4.2.4 | As a client, I can filter workforce view | - Filter by status<br>- Search by employee name |

### Deliverables
- [ ] Client dashboard
- [ ] Employee overview cards
- [ ] Live workforce grid/list
- [ ] Real-time status updates
- [ ] Action items summary

---

## Sprint 5: Admin Portal - Operations Dashboard

**Duration:** 2 weeks

### Objectives
- Build operations dashboard with system-wide overview
- Implement employee and client administration

### User Stories

#### 5.1 Operations Dashboard
| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-5.1.1 | As an admin, I can see total active employees | - Real-time count<br>- Trend indicator |
| US-5.1.2 | As an admin, I can see total active clients | - Real-time count<br>- Quick access to client list |
| US-5.1.3 | As an admin, I can see employees currently working | - Live count of active sessions<br>- Drill-down to details |
| US-5.1.4 | As an admin, I can see pending approvals | - Count of pending items<br>- Categorized by type |
| US-5.1.5 | As an admin, I can see open support tickets | - Ticket count<br>- Priority indicators |
| US-5.1.6 | As an admin, I can see alerts requiring attention | - Critical alerts highlighted<br>- Action links |

#### 5.2 Employee Administration
| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-5.2.1 | As an admin, I can view employee profiles | - Complete profile information<br>- Employment details |
| US-5.2.2 | As an admin, I can assign employees to clients | - Client selection dropdown<br>- Multiple client assignment |
| US-5.2.3 | As an admin, I can manage employee schedules | - Schedule creation/editing<br>- Shift assignment |
| US-5.2.4 | As an admin, I can activate/deactivate employee access | - Toggle access status<br>- Immediate effect |

#### 5.3 Client Administration
| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-5.3.1 | As an admin, I can create client accounts | - Client registration form<br>- Initial setup configuration |
| US-5.3.2 | As an admin, I can assign employees to clients | - Employee selection interface<br>- Bulk assignment option |
| US-5.3.3 | As an admin, I can configure basic client rules | - Work hour settings<br>- Notification preferences |

### Deliverables
- [ ] Operations dashboard
- [ ] Employee management interface
- [ ] Client management interface
- [ ] Assignment management
- [ ] System alerts display

---

## Sprint 6: Integration, Testing & Polish

**Duration:** 2 weeks

### Objectives
- Connect frontend to backend APIs
- Comprehensive testing and QA
- Bug fixes and UI polish

### Tasks

#### 6.1 Backend Integration
| ID | Task | Acceptance Criteria |
|----|------|---------------------|
| T-6.1.1 | Connect authentication to API | - Login/logout working with backend<br>- Token management |
| T-6.1.2 | Integrate employee portal APIs | - Clock in/out persisted<br>- Schedule data from backend |
| T-6.1.3 | Integrate client portal APIs | - Real-time workforce data<br>- Dashboard metrics accurate |
| T-6.1.4 | Integrate admin portal APIs | - CRUD operations functional<br>- Real-time dashboard data |
| T-6.1.5 | Implement error handling | - User-friendly error messages<br>- Retry mechanisms |
| T-6.1.6 | Add loading states | - Skeleton loaders<br>- Progress indicators |

#### 6.2 Testing & QA
| ID | Task | Acceptance Criteria |
|----|------|---------------------|
| T-6.2.1 | Unit testing | - Component tests passing<br>- >80% coverage |
| T-6.2.2 | Integration testing | - API integration tests<br>- User flow tests |
| T-6.2.3 | Cross-browser testing | - Chrome, Firefox, Safari, Edge<br>- No critical issues |
| T-6.2.4 | Security testing | - Authentication flows secure<br>- No unauthorized access |

#### 6.3 Bug Fixes & Polish
| ID | Task | Acceptance Criteria |
|----|------|---------------------|
| T-6.3.1 | UI/UX refinements | - Consistent styling<br>- Improved usability |
| T-6.3.2 | Performance optimization | - Fast page loads<br>- Optimized bundle size |
| T-6.3.3 | Documentation | - Component documentation<br>- API integration guide |

### Deliverables
- [ ] Fully integrated frontend
- [ ] Test reports
- [ ] Bug-free release candidate
- [ ] Documentation

---

## Summary

| Sprint | Focus Area | Duration | Key Deliverables | Status |
|--------|-----------|----------|------------------|--------|
| Sprint 1 | Authentication & Core Infrastructure | 2 weeks | Login, RBAC, Components | ✅ Complete |
| Sprint 1.5 | Employee & Client Management | 1 week | CRUD Operations, Detail Pages, Basic RBAC | ✅ Complete |
| Sprint 1.6 | Granular RBAC & Permissions | 1 week | Permissions System, Role Management, UI Access Control | ✅ Complete |
| Sprint 2 | Employee Portal - Work Sessions | 2 weeks | Clock In/Out, Timer | 🔲 Pending |
| Sprint 3 | Employee Portal - Schedule & History | 2 weeks | Schedule, Time Records | 🔲 Pending |
| Sprint 4 | Client Portal - Dashboard & Workforce | 2 weeks | Dashboard, Live View | 🔲 Pending |
| Sprint 5 | Admin Portal - Operations Dashboard | 2 weeks | Admin Dashboard, Management | 🔲 Pending |
| Sprint 6 | Integration, Testing & Polish | 2 weeks | Full Integration, QA | 🔲 Pending |

**Total Phase 1 Duration: 14 weeks**
**Current Progress: Sprint 1 + 1.5 + 1.6 Complete (3/8 sprints)**

---

## Dependencies

- Backend API development must be aligned with frontend sprints
- Design assets (Figma/XD) should be ready before each sprint
- Test environment setup required by Sprint 6

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Backend API delays | High | Use mock data for frontend development |
| Design changes mid-sprint | Medium | Lock designs before sprint start |
| Integration issues | High | Early API contract definition |

---

## Backend Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma       # Database schema (PostgreSQL)
│   └── seed.ts             # Demo data seeding
├── src/
│   ├── config/             # Configuration files
│   │   ├── index.ts        # App configuration
│   │   └── database.ts     # Prisma client
│   ├── controllers/        # Route handlers
│   │   └── auth.controller.ts
│   ├── middleware/         # Express middleware
│   │   ├── auth.middleware.ts
│   │   └── error.middleware.ts
│   ├── routes/             # API routes
│   │   ├── index.ts
│   │   └── auth.routes.ts
│   ├── services/           # Business logic services
│   │   ├── index.ts
│   │   └── email.service.ts  # Email templates & sending
│   ├── types/              # TypeScript types
│   │   └── index.ts
│   ├── utils/              # Utility functions
│   │   └── helpers.ts
│   ├── app.ts              # Express app setup
│   └── index.ts            # Server entry point
├── .env                    # Environment variables (local)
├── .env.example            # Environment variables template
├── package.json
└── tsconfig.json
```

---

## Database Schema (Prisma)

### Core Models:
- **User** - Authentication & role management
- **Employee** - Employee profiles & assignments
- **Client** - Client accounts & policies
- **Admin** - Admin profiles
- **WorkSession** - Clock in/out tracking
- **Break** - Break time tracking
- **TimeRecord** - Daily time records with approval status
- **Schedule** - Employee schedules
- **LeaveRequest** - Leave/availability requests
- **SupportTicket** - Employee support tickets
- **Notification** - System notifications
- **AuditLog** - Activity tracking

---

*Document Created: January 2026*
*Last Updated: January 21, 2026*
*Project: Hello Team Workforce Hub Platform*
*Version: 1.3 - Completed Sprint 1.6 (Granular RBAC & Permissions System)*
