/// <reference types="node" />
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ROLE_PERMISSIONS } from '../src/config/permissions';

const prisma = new PrismaClient();

// Default roles configuration
const DEFAULT_ROLES = [
  {
    name: 'SUPER_ADMIN',
    displayName: 'Super Admin',
    description: 'Full system access. Can manage all settings, users, and permissions.',
    isSystem: true,
  },
  {
    name: 'ADMIN',
    displayName: 'Administrator',
    description: 'Full operational access. Can manage employees, clients, and most settings.',
    isSystem: true,
  },
  {
    name: 'OPERATIONS',
    displayName: 'Operations Manager',
    description: 'Manages day-to-day operations. Can view/edit employees, clients, and handle approvals.',
    isSystem: true,
  },
  {
    name: 'HR',
    displayName: 'Human Resources',
    description: 'Handles HR functions. Can manage employees, schedules, and leave requests.',
    isSystem: true,
  },
  {
    name: 'FINANCE',
    displayName: 'Finance Manager',
    description: 'Manages financial aspects. Can view time records, process payroll, and generate reports.',
    isSystem: true,
  },
  {
    name: 'SUPPORT',
    displayName: 'Support Staff',
    description: 'Handles support tickets. Limited access to employee and client information.',
    isSystem: true,
  },
  {
    name: 'CLIENT',
    displayName: 'Client',
    description: 'Client portal access. Can view assigned employees and approve time records.',
    isSystem: true,
  },
  {
    name: 'EMPLOYEE',
    displayName: 'Employee',
    description: 'Employee portal access. Can clock in/out and view own records.',
    isSystem: true,
  },
];

async function seedRolesAndPermissions() {
  console.log('Seeding roles and permissions...');

  for (const roleConfig of DEFAULT_ROLES) {
    const role = await prisma.role.upsert({
      where: { name: roleConfig.name },
      update: {
        displayName: roleConfig.displayName,
        description: roleConfig.description,
      },
      create: {
        name: roleConfig.name,
        displayName: roleConfig.displayName,
        description: roleConfig.description,
        isSystem: roleConfig.isSystem,
        isActive: true,
      },
    });

    const permissions = ROLE_PERMISSIONS[roleConfig.name] || [];

    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id },
    });

    if (permissions.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissions.map((permission: string) => ({
          roleId: role.id,
          permission,
        })),
        skipDuplicates: true,
      });
    }

    console.log(`  ${role.displayName}: ${permissions.length} permissions`);
  }

  console.log('Roles and permissions seeded.');
}

async function main() {
  console.log('Starting seed...\n');

  // ── Roles & Permissions ──
  await seedRolesAndPermissions();
  console.log('');

  const hashedPassword = await bcrypt.hash('demo123456', 10);

  const superAdminRole = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
  const clientRole = await prisma.role.findUnique({ where: { name: 'CLIENT' } });
  const employeeRole = await prisma.role.findUnique({ where: { name: 'EMPLOYEE' } });

  // ── Admin ──
  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: { roleId: superAdminRole?.id },
    create: {
      email: 'admin@demo.com',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      roleId: superAdminRole?.id,
      status: 'ACTIVE',
      admin: {
        create: {
          firstName: 'Admin',
          lastName: 'User',
          department: 'Operations',
        },
      },
    },
    include: { admin: true },
  });
  console.log('Created admin:', admin.email);

  // ── Employees ──
  const emp1 = await prisma.user.upsert({
    where: { email: 'employee@demo.com' },
    update: { roleId: employeeRole?.id },
    create: {
      email: 'employee@demo.com',
      password: hashedPassword,
      role: 'EMPLOYEE',
      roleId: employeeRole?.id,
      status: 'ACTIVE',
      employee: {
        create: {
          firstName: 'John',
          lastName: 'Doe',
          phone: '+1 234 567 8900',
          billingRate: 35.00,
          payableRate: 25.00,
          onboardingStatus: 'COMPLETED',
        },
      },
    },
    include: { employee: true },
  });
  console.log('Created employee:', emp1.email);

  const emp2 = await prisma.user.upsert({
    where: { email: 'jigar@demo.com' },
    update: { roleId: employeeRole?.id },
    create: {
      email: 'jigar@demo.com',
      password: hashedPassword,
      role: 'EMPLOYEE',
      roleId: employeeRole?.id,
      status: 'ACTIVE',
      employee: {
        create: {
          firstName: 'Jigar',
          lastName: 'Patel',
          phone: '+1 234 567 8902',
          billingRate: 40.00,
          payableRate: 28.00,
          onboardingStatus: 'COMPLETED',
        },
      },
    },
    include: { employee: true },
  });
  console.log('Created employee:', emp2.email);

  const emp3 = await prisma.user.upsert({
    where: { email: 'sarah@demo.com' },
    update: { roleId: employeeRole?.id },
    create: {
      email: 'sarah@demo.com',
      password: hashedPassword,
      role: 'EMPLOYEE',
      roleId: employeeRole?.id,
      status: 'ACTIVE',
      employee: {
        create: {
          firstName: 'Sarah',
          lastName: 'Johnson',
          phone: '+1 234 567 8903',
          billingRate: 38.00,
          payableRate: 26.00,
          onboardingStatus: 'COMPLETED',
        },
      },
    },
    include: { employee: true },
  });
  console.log('Created employee:', emp3.email);

  // ── Clients ──
  const client1 = await prisma.user.upsert({
    where: { email: 'client@demo.com' },
    update: { roleId: clientRole?.id },
    create: {
      email: 'client@demo.com',
      password: hashedPassword,
      role: 'CLIENT',
      roleId: clientRole?.id,
      status: 'ACTIVE',
      client: {
        create: {
          companyName: 'ABC Corporation',
          contactPerson: 'Jane Smith',
          phone: '+1 234 567 8901',
          timezone: 'America/New_York',
          agreementType: 'WEEKLY',
          onboardingStatus: 'COMPLETED',
        },
      },
    },
    include: { client: true },
  });
  console.log('Created client:', client1.email);

  const client2 = await prisma.user.upsert({
    where: { email: 'vhits@demo.com' },
    update: { roleId: clientRole?.id },
    create: {
      email: 'vhits@demo.com',
      password: hashedPassword,
      role: 'CLIENT',
      roleId: clientRole?.id,
      status: 'ACTIVE',
      client: {
        create: {
          companyName: 'Virtual Height',
          contactPerson: 'Nikita K',
          phone: '+1 555 123 4567',
          timezone: 'America/New_York',
          agreementType: 'MONTHLY',
          onboardingStatus: 'COMPLETED',
        },
      },
    },
    include: { client: true },
  });
  console.log('Created client:', client2.email);

  const c1 = client1.client!;
  const c2 = client2.client!;
  const e1 = emp1.employee!;
  const e2 = emp2.employee!;
  const e3 = emp3.employee!;

  // ── Client Contacts (skip if already exist for this client) ──
  const existingC1Contacts = await prisma.clientContact.count({ where: { clientId: c1.id } });
  const existingC2Contacts = await prisma.clientContact.count({ where: { clientId: c2.id } });
  if (existingC1Contacts === 0) {
    await prisma.clientContact.createMany({
      data: [
        { clientId: c1.id, name: 'Jane Smith', position: 'CEO', phone: '+1 234 567 8901', email: 'jane@abc.com', isPrimary: true },
        { clientId: c1.id, name: 'Mike Brown', position: 'HR Manager', phone: '+1 234 567 8910', email: 'mike@abc.com', isPrimary: false },
      ],
    });
  }
  if (existingC2Contacts === 0) {
    await prisma.clientContact.createMany({
      data: [
        { clientId: c2.id, name: 'Nikita K', position: 'Director', phone: '+1 555 123 4567', email: 'nikita@vhits.com', isPrimary: true },
      ],
    });
  }
  console.log('Created client contacts');

  // ── Client Agreements (upsert to avoid unique constraint on clientId) ──
  await prisma.clientAgreement.upsert({
    where: { clientId: c1.id },
    update: {},
    create: { clientId: c1.id, agreementType: 'WEEKLY', signedAt: new Date('2026-01-15'), signedByName: 'Jane Smith' },
  });
  await prisma.clientAgreement.upsert({
    where: { clientId: c2.id },
    update: {},
    create: { clientId: c2.id, agreementType: 'MONTHLY', signedAt: new Date('2026-01-20'), signedByName: 'Nikita K' },
  });
  console.log('Created client agreements');

  // ── Default Group ──
  const defaultGroup = await prisma.group.upsert({
    where: { id: 'default-group' },
    update: {},
    create: { id: 'default-group', name: 'Default', description: 'Auto-generated group', isActive: true },
  });

  await prisma.clientGroup.upsert({
    where: { clientId_groupId: { clientId: c1.id, groupId: defaultGroup.id } },
    update: {},
    create: { clientId: c1.id, groupId: defaultGroup.id },
  });
  await prisma.clientGroup.upsert({
    where: { clientId_groupId: { clientId: c2.id, groupId: defaultGroup.id } },
    update: {},
    create: { clientId: c2.id, groupId: defaultGroup.id },
  });
  console.log('Created groups');

  // ── Assign Employees to Clients ──
  // John Doe & Sarah → ABC Corporation, Jigar → Virtual Height
  const assignments = [
    { clientId: c1.id, employeeId: e1.id },
    { clientId: c1.id, employeeId: e3.id },
    { clientId: c2.id, employeeId: e2.id },
  ];
  for (const a of assignments) {
    await prisma.clientEmployee.upsert({
      where: { clientId_employeeId: { clientId: a.clientId, employeeId: a.employeeId } },
      update: {},
      create: { ...a, isActive: true },
    });
  }
  console.log('Assigned employees to clients');

  // ── Client Policies (auto-approve ON for ABC, OFF for Virtual Height) ──
  await prisma.clientPolicy.upsert({
    where: { clientId: c1.id },
    update: {
      autoApproveTimesheets: true,
      autoApproveMinutes: 1440,
    },
    create: {
      clientId: c1.id,
      defaultHourlyRate: 35.00,
      defaultOvertimeRate: 52.50,
      allowPaidLeave: true,
      paidLeaveEntitlementType: 'FIXED',
      annualPaidLeaveDays: 15,
      allowUnpaidLeave: true,
      requireTwoWeeksNotice: true,
      requireTwoWeeksNoticePaidLeave: true,
      requireTwoWeeksNoticeUnpaidLeave: true,
      allowOvertime: true,
      overtimeRequiresApproval: true,
      autoApproveTimesheets: true,
      autoApproveMinutes: 1440, // 24 hours
    },
  });

  await prisma.clientPolicy.upsert({
    where: { clientId: c2.id },
    update: {
      autoApproveTimesheets: false,
      autoApproveMinutes: 1440,
    },
    create: {
      clientId: c2.id,
      defaultHourlyRate: 40.00,
      defaultOvertimeRate: 60.00,
      allowPaidLeave: true,
      paidLeaveEntitlementType: 'FIXED',
      annualPaidLeaveDays: 10,
      allowUnpaidLeave: true,
      requireTwoWeeksNotice: true,
      requireTwoWeeksNoticePaidLeave: true,
      requireTwoWeeksNoticeUnpaidLeave: true,
      allowOvertime: true,
      overtimeRequiresApproval: true,
      autoApproveTimesheets: false,
      autoApproveMinutes: 1440,
    },
  });
  console.log('Created client policies (ABC: auto-approve ON, VH: OFF)');

  // ── Schedules (Mon-Fri 9am-5pm) — skip if employee already has schedules ──
  const scheduleStart = new Date('2026-01-01');
  for (const empId of [e1.id, e2.id, e3.id]) {
    const existingSchedules = await prisma.schedule.count({ where: { employeeId: empId } });
    if (existingSchedules === 0) {
      for (let day = 1; day <= 5; day++) {
        await prisma.schedule.create({
          data: {
            employeeId: empId,
            dayOfWeek: day,
            startTime: '09:00',
            endTime: '17:00',
            isActive: true,
            effectiveFrom: scheduleStart,
          },
        });
      }
    }
  }
  console.log('Created schedules for all employees (Mon-Fri 9am-5pm)');

  // ── Time Records for auto-approval testing (skip if already seeded) ──
  const existingTimeRecords = await prisma.timeRecord.count();
  if (existingTimeRecords > 0) {
    console.log(`Skipping time record/scenario seeding — ${existingTimeRecords} records already exist`);
  } else {
  // All dates are past, >24h since scheduled end, so auto-approval should trigger
  // ABC Corporation (c1) — auto-approve ON
  const timeRecords = [
    // John Doe — Feb 9 Mon, 8h, no OT → should auto-approve
    {
      employeeId: e1.id, clientId: c1.id,
      date: new Date(Date.UTC(2026, 1, 9)),
      actualStart: new Date('2026-02-09T14:00:00Z'), actualEnd: new Date('2026-02-09T22:00:00Z'),
      scheduledStart: new Date('2026-02-09T14:00:00Z'), scheduledEnd: new Date('2026-02-09T22:00:00Z'),
      totalMinutes: 480, breakMinutes: 0, overtimeMinutes: 0, status: 'PENDING' as const,
    },
    // John Doe — Feb 10 Tue, 7.5h, no OT → should auto-approve
    {
      employeeId: e1.id, clientId: c1.id,
      date: new Date(Date.UTC(2026, 1, 10)),
      actualStart: new Date('2026-02-10T14:00:00Z'), actualEnd: new Date('2026-02-10T21:30:00Z'),
      scheduledStart: new Date('2026-02-10T14:00:00Z'), scheduledEnd: new Date('2026-02-10T22:00:00Z'),
      totalMinutes: 450, breakMinutes: 30, overtimeMinutes: 0, status: 'PENDING' as const,
    },
    // John Doe — Feb 11 Wed, 9h, 60m OT → should NOT auto-approve (overtime)
    {
      employeeId: e1.id, clientId: c1.id,
      date: new Date(Date.UTC(2026, 1, 11)),
      actualStart: new Date('2026-02-11T14:00:00Z'), actualEnd: new Date('2026-02-11T23:00:00Z'),
      scheduledStart: new Date('2026-02-11T14:00:00Z'), scheduledEnd: new Date('2026-02-11T22:00:00Z'),
      totalMinutes: 540, breakMinutes: 0, overtimeMinutes: 60, status: 'PENDING' as const,
    },
    // Sarah Johnson — Feb 9 Mon, 8h, no OT → should auto-approve
    {
      employeeId: e3.id, clientId: c1.id,
      date: new Date(Date.UTC(2026, 1, 9)),
      actualStart: new Date('2026-02-09T14:00:00Z'), actualEnd: new Date('2026-02-09T22:00:00Z'),
      scheduledStart: new Date('2026-02-09T14:00:00Z'), scheduledEnd: new Date('2026-02-09T22:00:00Z'),
      totalMinutes: 480, breakMinutes: 0, overtimeMinutes: 0, status: 'PENDING' as const,
    },
    // Sarah Johnson — Feb 10 Tue, 8h, no OT → should auto-approve
    {
      employeeId: e3.id, clientId: c1.id,
      date: new Date(Date.UTC(2026, 1, 10)),
      actualStart: new Date('2026-02-10T14:00:00Z'), actualEnd: new Date('2026-02-10T22:00:00Z'),
      scheduledStart: new Date('2026-02-10T14:00:00Z'), scheduledEnd: new Date('2026-02-10T22:00:00Z'),
      totalMinutes: 480, breakMinutes: 0, overtimeMinutes: 0, status: 'PENDING' as const,
    },
    // --- This week records ---
    // John Doe — Feb 16 Mon, 8h, no OT → should auto-approve (scheduledEnd was yesterday)
    {
      employeeId: e1.id, clientId: c1.id,
      date: new Date(Date.UTC(2026, 1, 16)),
      actualStart: new Date('2026-02-16T14:00:00Z'), actualEnd: new Date('2026-02-16T22:00:00Z'),
      scheduledStart: new Date('2026-02-16T14:00:00Z'), scheduledEnd: new Date('2026-02-16T22:00:00Z'),
      totalMinutes: 480, breakMinutes: 0, overtimeMinutes: 0, status: 'PENDING' as const,
    },
    // Sarah Johnson — Feb 16 Mon, 8.5h, 30m OT → should NOT auto-approve
    {
      employeeId: e3.id, clientId: c1.id,
      date: new Date(Date.UTC(2026, 1, 16)),
      actualStart: new Date('2026-02-16T14:00:00Z'), actualEnd: new Date('2026-02-16T22:30:00Z'),
      scheduledStart: new Date('2026-02-16T14:00:00Z'), scheduledEnd: new Date('2026-02-16T22:00:00Z'),
      totalMinutes: 510, breakMinutes: 0, overtimeMinutes: 30, status: 'PENDING' as const,
    },
    // --- Virtual Height (c2) — auto-approve OFF, so these stay PENDING regardless ---
    // Jigar Patel — Feb 9 Mon, 8h
    {
      employeeId: e2.id, clientId: c2.id,
      date: new Date(Date.UTC(2026, 1, 9)),
      actualStart: new Date('2026-02-09T14:00:00Z'), actualEnd: new Date('2026-02-09T22:00:00Z'),
      scheduledStart: new Date('2026-02-09T14:00:00Z'), scheduledEnd: new Date('2026-02-09T22:00:00Z'),
      totalMinutes: 480, breakMinutes: 0, overtimeMinutes: 0, status: 'PENDING' as const,
    },
    // Jigar Patel — Feb 10 Tue, 8h
    {
      employeeId: e2.id, clientId: c2.id,
      date: new Date(Date.UTC(2026, 1, 10)),
      actualStart: new Date('2026-02-10T14:00:00Z'), actualEnd: new Date('2026-02-10T22:00:00Z'),
      scheduledStart: new Date('2026-02-10T14:00:00Z'), scheduledEnd: new Date('2026-02-10T22:00:00Z'),
      totalMinutes: 480, breakMinutes: 0, overtimeMinutes: 0, status: 'PENDING' as const,
    },
  ];

  for (const rec of timeRecords) {
    // Create a corresponding WorkSession (COMPLETED) so the employee view shows them
    const workSession = await prisma.workSession.create({
      data: {
        employeeId: rec.employeeId,
        startTime: rec.actualStart!,
        endTime: rec.actualEnd!,
        status: 'COMPLETED',
        totalBreakMinutes: rec.breakMinutes,
        notes: null,
      },
    });

    // Create a clock-in log for the work session
    await prisma.sessionLog.create({
      data: {
        workSessionId: workSession.id,
        action: 'CLOCK_IN',
        message: `Clocked in (seeded)`,
      },
    });
    await prisma.sessionLog.create({
      data: {
        workSessionId: workSession.id,
        action: 'CLOCK_OUT',
        message: `Clocked out (seeded)`,
      },
    });

    await prisma.timeRecord.create({ data: rec });
  }
  console.log(`Created ${timeRecords.length} time records + work sessions for auto-approval testing`);

  // ══════════════════════════════════════════════════════════════
  // SCENARIO SEED DATA — Request Revisions, Overtime, Shift Warnings
  // ══════════════════════════════════════════════════════════════

  // ── Scenario 1: REVISION_REQUESTED records ──
  // John Doe — Feb 17 Tue, regular 8h, client requested revision
  const revisionSession1 = await prisma.workSession.create({
    data: {
      employeeId: e1.id,
      startTime: new Date('2026-02-17T14:00:00Z'),
      endTime: new Date('2026-02-17T22:00:00Z'),
      status: 'COMPLETED',
      totalBreakMinutes: 0,
    },
  });
  await prisma.sessionLog.createMany({
    data: [
      { workSessionId: revisionSession1.id, action: 'CLOCK_IN', message: 'Clocked in (seeded)' },
      { workSessionId: revisionSession1.id, action: 'CLOCK_OUT', message: 'Clocked out (seeded)' },
    ],
  });
  await prisma.timeRecord.create({
    data: {
      employeeId: e1.id, clientId: c1.id,
      date: new Date(Date.UTC(2026, 1, 17)),
      actualStart: new Date('2026-02-17T14:00:00Z'), actualEnd: new Date('2026-02-17T22:00:00Z'),
      scheduledStart: new Date('2026-02-17T14:00:00Z'), scheduledEnd: new Date('2026-02-17T22:00:00Z'),
      totalMinutes: 480, breakMinutes: 0, overtimeMinutes: 0,
      status: 'REVISION_REQUESTED',
      revisionReason: 'Hours do not match the task log. Please verify your clock-in time was correct.',
      revisionRequestedBy: client1.id,
      revisionRequestedAt: new Date('2026-02-18T10:00:00Z'),
    },
  });
  console.log('Created REVISION_REQUESTED record: John Doe — Feb 17');

  // Sarah Johnson — Feb 17 Tue, regular 8h, client requested revision
  const revisionSession2 = await prisma.workSession.create({
    data: {
      employeeId: e3.id,
      startTime: new Date('2026-02-17T14:00:00Z'),
      endTime: new Date('2026-02-17T22:00:00Z'),
      status: 'COMPLETED',
      totalBreakMinutes: 30,
    },
  });
  await prisma.sessionLog.createMany({
    data: [
      { workSessionId: revisionSession2.id, action: 'CLOCK_IN', message: 'Clocked in (seeded)' },
      { workSessionId: revisionSession2.id, action: 'CLOCK_OUT', message: 'Clocked out (seeded)' },
    ],
  });
  await prisma.timeRecord.create({
    data: {
      employeeId: e3.id, clientId: c1.id,
      date: new Date(Date.UTC(2026, 1, 17)),
      actualStart: new Date('2026-02-17T14:00:00Z'), actualEnd: new Date('2026-02-17T22:00:00Z'),
      scheduledStart: new Date('2026-02-17T14:00:00Z'), scheduledEnd: new Date('2026-02-17T22:00:00Z'),
      totalMinutes: 450, breakMinutes: 30, overtimeMinutes: 0,
      status: 'REVISION_REQUESTED',
      revisionReason: 'Missing break time entry for lunch. Please update and resubmit.',
      revisionRequestedBy: client1.id,
      revisionRequestedAt: new Date('2026-02-18T11:30:00Z'),
    },
  });
  console.log('Created REVISION_REQUESTED record: Sarah Johnson — Feb 17');

  // ── Scenario 2: Overtime request records (approved, pending, rejected) ──
  // John Doe — Approved OT request for Feb 18 (shift extension)
  await prisma.overtimeRequest.create({
    data: {
      employeeId: e1.id, clientId: c1.id,
      date: new Date(Date.UTC(2026, 1, 18)),
      type: 'SHIFT_EXTENSION',
      requestedMinutes: 60,
      estimatedEndTime: '18:00',
      reason: 'Need to finish quarterly report deadline',
      status: 'APPROVED',
      approvedBy: client1.id,
      approvedAt: new Date('2026-02-18T20:00:00Z'),
    },
  });
  // John Doe — Feb 18, 9h with 1h approved OT
  const otApprovedSession = await prisma.workSession.create({
    data: {
      employeeId: e1.id,
      startTime: new Date('2026-02-18T14:00:00Z'),
      endTime: new Date('2026-02-18T23:00:00Z'),
      status: 'COMPLETED',
      totalBreakMinutes: 0,
    },
  });
  await prisma.sessionLog.createMany({
    data: [
      { workSessionId: otApprovedSession.id, action: 'CLOCK_IN', message: 'Clocked in (seeded)' },
      { workSessionId: otApprovedSession.id, action: 'CLOCK_OUT', message: 'Clocked out (seeded)' },
    ],
  });
  await prisma.timeRecord.create({
    data: {
      employeeId: e1.id, clientId: c1.id,
      date: new Date(Date.UTC(2026, 1, 18)),
      actualStart: new Date('2026-02-18T14:00:00Z'), actualEnd: new Date('2026-02-18T23:00:00Z'),
      scheduledStart: new Date('2026-02-18T14:00:00Z'), scheduledEnd: new Date('2026-02-18T22:00:00Z'),
      totalMinutes: 540, breakMinutes: 0, overtimeMinutes: 60,
      status: 'APPROVED',
      approvedBy: client1.id,
      approvedAt: new Date('2026-02-18T23:30:00Z'),
    },
  });
  console.log('Created APPROVED OT record: John Doe — Feb 18 (1h OT)');

  // Sarah Johnson — Pending OT request for Feb 19 (off-shift)
  await prisma.overtimeRequest.create({
    data: {
      employeeId: e3.id, clientId: c1.id,
      date: new Date(Date.UTC(2026, 1, 19)),
      type: 'OFF_SHIFT',
      requestedMinutes: 120,
      requestedStartTime: '19:00',
      requestedEndTime: '21:00',
      reason: 'Client presentation prep — need evening hours',
      status: 'PENDING',
    },
  });
  console.log('Created PENDING OT request: Sarah Johnson — Feb 19 (off-shift 7-9pm)');

  // Jigar Patel — Rejected OT request for Feb 18 (shift extension)
  await prisma.overtimeRequest.create({
    data: {
      employeeId: e2.id, clientId: c2.id,
      date: new Date(Date.UTC(2026, 1, 18)),
      type: 'SHIFT_EXTENSION',
      requestedMinutes: 30,
      estimatedEndTime: '17:30',
      reason: 'Finishing up deployment tasks',
      status: 'REJECTED',
      rejectedBy: 'vhits@demo.com',
      rejectedAt: new Date('2026-02-18T21:00:00Z'),
      rejectionReason: 'Deployment can wait until tomorrow',
    },
  });
  console.log('Created REJECTED OT request: Jigar Patel — Feb 18');

  // ── Scenario 3: Today's records for live testing ──
  // Use dynamic "today" so these always work when seed is run
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  // Sarah Johnson — Active session today (clocked in 30 min ago, simulates 30-min warning test)
  // When the cron runs, if shift end is near, it will trigger the warning
  const sarahActiveSession = await prisma.workSession.create({
    data: {
      employeeId: e3.id,
      startTime: new Date(now.getTime() - 7 * 60 * 60 * 1000), // 7 hours ago
      endTime: null,
      status: 'ACTIVE',
      totalBreakMinutes: 0,
    },
  });
  await prisma.sessionLog.create({
    data: {
      workSessionId: sarahActiveSession.id,
      action: 'CLOCK_IN',
      message: 'Clocked in (seeded — active session for shift-end warning test)',
    },
  });
  console.log('Created ACTIVE session: Sarah Johnson — today (7h ago, for shift-end warning test)');

  // Jigar Patel — Completed session today (auto-clocked out, for post-shift clock-in test)
  const jigarPostShiftSession = await prisma.workSession.create({
    data: {
      employeeId: e2.id,
      startTime: new Date(now.getTime() - 9 * 60 * 60 * 1000), // 9 hours ago
      endTime: new Date(now.getTime() - 1 * 60 * 60 * 1000),   // 1 hour ago
      status: 'COMPLETED',
      totalBreakMinutes: 0,
    },
  });
  await prisma.sessionLog.createMany({
    data: [
      { workSessionId: jigarPostShiftSession.id, action: 'CLOCK_IN', message: 'Clocked in (seeded)' },
      { workSessionId: jigarPostShiftSession.id, action: 'AUTO_CLOCK_OUT', message: 'Auto-clocked out at shift end (seeded — for post-shift test)' },
    ],
  });
  await prisma.timeRecord.create({
    data: {
      employeeId: e2.id, clientId: c2.id,
      date: todayUTC,
      actualStart: new Date(now.getTime() - 9 * 60 * 60 * 1000),
      actualEnd: new Date(now.getTime() - 1 * 60 * 60 * 1000),
      scheduledStart: new Date(now.getTime() - 9 * 60 * 60 * 1000),
      scheduledEnd: new Date(now.getTime() - 1 * 60 * 60 * 1000),
      totalMinutes: 480, breakMinutes: 0, overtimeMinutes: 0,
      status: 'PENDING',
    },
  });
  console.log('Created COMPLETED + auto-clocked-out session: Jigar Patel — today (for post-shift clock-in test)');

  // ── Scenario 4: Mix of statuses for admin approvals page ──
  // John Doe — Feb 19, regular 8h, PENDING (for admin to test "Request Revisions" button)
  const pendingRegSession = await prisma.workSession.create({
    data: {
      employeeId: e1.id,
      startTime: new Date('2026-02-19T14:00:00Z'),
      endTime: new Date('2026-02-19T22:00:00Z'),
      status: 'COMPLETED',
      totalBreakMinutes: 0,
    },
  });
  await prisma.sessionLog.createMany({
    data: [
      { workSessionId: pendingRegSession.id, action: 'CLOCK_IN', message: 'Clocked in (seeded)' },
      { workSessionId: pendingRegSession.id, action: 'CLOCK_OUT', message: 'Clocked out (seeded)' },
    ],
  });
  await prisma.timeRecord.create({
    data: {
      employeeId: e1.id, clientId: c1.id,
      date: new Date(Date.UTC(2026, 1, 19)),
      actualStart: new Date('2026-02-19T14:00:00Z'), actualEnd: new Date('2026-02-19T22:00:00Z'),
      scheduledStart: new Date('2026-02-19T14:00:00Z'), scheduledEnd: new Date('2026-02-19T22:00:00Z'),
      totalMinutes: 480, breakMinutes: 0, overtimeMinutes: 0,
      status: 'PENDING',
    },
  });
  console.log('Created PENDING regular record: John Doe — Feb 19 (for admin "Request Revisions" test)');

  // Sarah Johnson — Feb 18, 9h with 1h OT, PENDING (for admin to test "Reject" on OT)
  const pendingOtSession = await prisma.workSession.create({
    data: {
      employeeId: e3.id,
      startTime: new Date('2026-02-18T14:00:00Z'),
      endTime: new Date('2026-02-18T23:00:00Z'),
      status: 'COMPLETED',
      totalBreakMinutes: 0,
    },
  });
  await prisma.sessionLog.createMany({
    data: [
      { workSessionId: pendingOtSession.id, action: 'CLOCK_IN', message: 'Clocked in (seeded)' },
      { workSessionId: pendingOtSession.id, action: 'CLOCK_OUT', message: 'Clocked out (seeded)' },
    ],
  });
  await prisma.timeRecord.create({
    data: {
      employeeId: e3.id, clientId: c1.id,
      date: new Date(Date.UTC(2026, 1, 18)),
      actualStart: new Date('2026-02-18T14:00:00Z'), actualEnd: new Date('2026-02-18T23:00:00Z'),
      scheduledStart: new Date('2026-02-18T14:00:00Z'), scheduledEnd: new Date('2026-02-18T22:00:00Z'),
      totalMinutes: 540, breakMinutes: 0, overtimeMinutes: 60,
      status: 'PENDING',
    },
  });
  console.log('Created PENDING OT record: Sarah Johnson — Feb 18 (1h OT, for admin "Reject" test)');

  } // end if (existingTimeRecords === 0)

  // ══════════════════════════════════════════════════════════════
  // ADDITIONAL TEST EMPLOYEES & CLIENTS (5 employees, 3 clients)
  // ══════════════════════════════════════════════════════════════

  const newClientDefs = [
    { email: 'techstart@demo.com', companyName: 'TechStart Inc', contactPerson: 'Amit Verma', phone: '+91 98765 43210', timezone: 'Asia/Kolkata', agreementType: 'WEEKLY' as const, hourlyRate: 30.00, overtimeRate: 45.00, shiftStart: '09:00', shiftEnd: '17:00' },
    { email: 'dataflow@demo.com', companyName: 'DataFlow Solutions', contactPerson: 'Robert Chen', phone: '+1 312 555 0101', timezone: 'America/Chicago', agreementType: 'BI_WEEKLY' as const, hourlyRate: 45.00, overtimeRate: 67.50, shiftStart: '09:00', shiftEnd: '17:00' },
    { email: 'cloudnine@demo.com', companyName: 'CloudNine Labs', contactPerson: 'Sophie Taylor', phone: '+44 20 7946 0958', timezone: 'Europe/London', agreementType: 'MONTHLY' as const, hourlyRate: 50.00, overtimeRate: 75.00, shiftStart: '08:00', shiftEnd: '16:00' },
    { email: 'westcoast@demo.com', companyName: 'West Coast Digital', contactPerson: 'Lisa Park', phone: '+1 415 555 0202', timezone: 'America/Los_Angeles', agreementType: 'WEEKLY' as const, hourlyRate: 55.00, overtimeRate: 82.50, shiftStart: '09:00', shiftEnd: '17:00' },
    { email: 'outback@demo.com', companyName: 'Outback Tech', contactPerson: 'James Murray', phone: '+61 2 9876 5432', timezone: 'Australia/Sydney', agreementType: 'MONTHLY' as const, hourlyRate: 60.00, overtimeRate: 90.00, shiftStart: '08:30', shiftEnd: '16:30' },
    { email: 'gulfstream@demo.com', companyName: 'Gulf Stream Corp', contactPerson: 'Omar Al-Rashid', phone: '+971 4 555 6789', timezone: 'Asia/Dubai', agreementType: 'BI_WEEKLY' as const, hourlyRate: 40.00, overtimeRate: 60.00, shiftStart: '09:00', shiftEnd: '18:00' },
  ];

  const newClients: Record<string, any> = {};
  for (const def of newClientDefs) {
    const user = await prisma.user.upsert({
      where: { email: def.email },
      update: { roleId: clientRole?.id },
      create: {
        email: def.email, password: hashedPassword, role: 'CLIENT', roleId: clientRole?.id, status: 'ACTIVE',
        client: { create: { companyName: def.companyName, contactPerson: def.contactPerson, phone: def.phone, timezone: def.timezone, agreementType: def.agreementType, onboardingStatus: 'COMPLETED' } },
      },
      include: { client: true },
    });
    newClients[def.email] = { ...user.client!, def };
    console.log(`Created client: ${def.email} → ${def.companyName} (${def.timezone})`);
  }

  // Client contacts, agreements, policies for new clients
  for (const def of newClientDefs) {
    const c = newClients[def.email];
    const contactCount = await prisma.clientContact.count({ where: { clientId: c.id } });
    if (contactCount === 0) {
      await prisma.clientContact.create({ data: { clientId: c.id, name: def.contactPerson, position: 'Director', phone: def.phone, email: def.email, isPrimary: true } });
    }
    await prisma.clientAgreement.upsert({ where: { clientId: c.id }, update: {}, create: { clientId: c.id, agreementType: def.agreementType, signedAt: new Date('2026-02-01'), signedByName: def.contactPerson } });
    await prisma.clientPolicy.upsert({
      where: { clientId: c.id }, update: {},
      create: {
        clientId: c.id, defaultHourlyRate: def.hourlyRate, defaultOvertimeRate: def.overtimeRate,
        allowPaidLeave: true, paidLeaveEntitlementType: 'FIXED', annualPaidLeaveDays: 12, allowUnpaidLeave: true,
        requireTwoWeeksNotice: true, requireTwoWeeksNoticePaidLeave: true, requireTwoWeeksNoticeUnpaidLeave: true,
        allowOvertime: true, overtimeRequiresApproval: true, autoApproveTimesheets: false, autoApproveMinutes: 1440,
      },
    });
    await prisma.clientGroup.upsert({
      where: { clientId_groupId: { clientId: c.id, groupId: defaultGroup.id } },
      update: {}, create: { clientId: c.id, groupId: defaultGroup.id },
    });
  }
  console.log('Created contacts, agreements, policies for new clients');

  // New employees
  const newEmpDefs = [
    { email: 'mike@demo.com', firstName: 'Mike', lastName: 'Wilson', phone: '+1 555 100 2001', billingRate: 32.00, payableRate: 22.00, clientEmail: 'techstart@demo.com' },
    { email: 'priya@demo.com', firstName: 'Priya', lastName: 'Sharma', phone: '+91 99887 76655', billingRate: 28.00, payableRate: 20.00, clientEmail: 'techstart@demo.com' },
    { email: 'alex@demo.com', firstName: 'Alex', lastName: 'Rivera', phone: '+1 555 100 2003', billingRate: 42.00, payableRate: 30.00, clientEmail: 'dataflow@demo.com' },
    { email: 'emma@demo.com', firstName: 'Emma', lastName: 'Chen', phone: '+44 7700 900123', billingRate: 48.00, payableRate: 35.00, clientEmail: 'cloudnine@demo.com' },
    { email: 'raj@demo.com', firstName: 'Raj', lastName: 'Kumar', phone: '+91 98765 11223', billingRate: 46.00, payableRate: 33.00, clientEmail: 'cloudnine@demo.com' },
    { email: 'tyler@demo.com', firstName: 'Tyler', lastName: 'Brooks', phone: '+1 415 555 3001', billingRate: 52.00, payableRate: 38.00, clientEmail: 'westcoast@demo.com' },
    { email: 'mia@demo.com', firstName: 'Mia', lastName: 'Nguyen', phone: '+1 415 555 3002', billingRate: 50.00, payableRate: 36.00, clientEmail: 'westcoast@demo.com' },
    { email: 'liam@demo.com', firstName: 'Liam', lastName: 'O\'Brien', phone: '+61 4 1234 5678', billingRate: 58.00, payableRate: 42.00, clientEmail: 'outback@demo.com' },
    { email: 'fatima@demo.com', firstName: 'Fatima', lastName: 'Hassan', phone: '+971 50 555 1234', billingRate: 38.00, payableRate: 27.00, clientEmail: 'gulfstream@demo.com' },
    { email: 'carlos@demo.com', firstName: 'Carlos', lastName: 'Mendez', phone: '+1 312 555 4001', billingRate: 44.00, payableRate: 31.00, clientEmail: 'dataflow@demo.com' },
  ];

  const newEmployees: Record<string, any> = {};
  for (const def of newEmpDefs) {
    const user = await prisma.user.upsert({
      where: { email: def.email },
      update: { roleId: employeeRole?.id },
      create: {
        email: def.email, password: hashedPassword, role: 'EMPLOYEE', roleId: employeeRole?.id, status: 'ACTIVE',
        employee: { create: { firstName: def.firstName, lastName: def.lastName, phone: def.phone, billingRate: def.billingRate, payableRate: def.payableRate, onboardingStatus: 'COMPLETED' } },
      },
      include: { employee: true },
    });
    newEmployees[def.email] = { ...user.employee!, def };
    console.log(`Created employee: ${def.email} → ${def.firstName} ${def.lastName}`);
  }

  // Assign new employees to their clients + create schedules
  for (const def of newEmpDefs) {
    const emp = newEmployees[def.email];
    const client = newClients[def.clientEmail];
    const clientDef = newClientDefs.find(c => c.email === def.clientEmail)!;

    await prisma.clientEmployee.upsert({
      where: { clientId_employeeId: { clientId: client.id, employeeId: emp.id } },
      update: {}, create: { clientId: client.id, employeeId: emp.id, isActive: true },
    });

    const existingSchedules = await prisma.schedule.count({ where: { employeeId: emp.id } });
    if (existingSchedules === 0) {
      for (let day = 1; day <= 5; day++) {
        await prisma.schedule.create({
          data: { employeeId: emp.id, dayOfWeek: day, startTime: clientDef.shiftStart, endTime: clientDef.shiftEnd, isActive: true, effectiveFrom: scheduleStart },
        });
      }
    }
  }
  console.log('Assigned new employees to clients + created schedules');

  // ── Summary ──
  console.log('\n========================================');
  console.log('Seed completed!');
  console.log('========================================\n');
  console.log('Demo Credentials (all use: demo123456)');
  console.log('---------------------------------------');
  console.log('Admin:       admin@demo.com');
  console.log('');
  console.log('Employees:');
  console.log('  employee@demo.com    (John Doe → ABC Corp)');
  console.log('  jigar@demo.com       (Jigar Patel → Virtual Height)');
  console.log('  sarah@demo.com       (Sarah Johnson → ABC Corp)');
  console.log('  mike@demo.com        (Mike Wilson → TechStart Inc)');
  console.log('  priya@demo.com       (Priya Sharma → TechStart Inc)');
  console.log('  alex@demo.com        (Alex Rivera → DataFlow Solutions)');
  console.log('  carlos@demo.com      (Carlos Mendez → DataFlow Solutions)');
  console.log('  emma@demo.com        (Emma Chen → CloudNine Labs)');
  console.log('  raj@demo.com         (Raj Kumar → CloudNine Labs)');
  console.log('  tyler@demo.com       (Tyler Brooks → West Coast Digital)');
  console.log('  mia@demo.com         (Mia Nguyen → West Coast Digital)');
  console.log('  liam@demo.com        (Liam O\'Brien → Outback Tech)');
  console.log('  fatima@demo.com      (Fatima Hassan → Gulf Stream Corp)');
  console.log('');
  console.log('Clients:');
  console.log('  client@demo.com      (ABC Corporation    — America/New_York   UTC-5)');
  console.log('  vhits@demo.com       (Virtual Height     — America/New_York   UTC-5)');
  console.log('  techstart@demo.com   (TechStart Inc      — Asia/Kolkata       UTC+5:30)');
  console.log('  dataflow@demo.com    (DataFlow Solutions  — America/Chicago    UTC-6)');
  console.log('  cloudnine@demo.com   (CloudNine Labs     — Europe/London      UTC+0)');
  console.log('  westcoast@demo.com   (West Coast Digital  — America/Los_Angeles UTC-8)');
  console.log('  outback@demo.com     (Outback Tech       — Australia/Sydney   UTC+11)');
  console.log('  gulfstream@demo.com  (Gulf Stream Corp   — Asia/Dubai         UTC+4)');
  console.log('');
  console.log('Time Records (past weeks, all PENDING):');
  console.log('  ABC Corp:');
  console.log('    John Doe  — Feb 9 (8h), Feb 10 (7.5h), Feb 11 (9h+1h OT), Feb 16 (8h)');
  console.log('    Sarah J   — Feb 9 (8h), Feb 10 (8h), Feb 16 (8.5h+30m OT)');
  console.log('  Virtual Height:');
  console.log('    Jigar P   — Feb 9 (8h), Feb 10 (8h)');
  console.log('');
  console.log('═══ SCENARIO TEST DATA ═══');
  console.log('');
  console.log('1. REQUEST REVISIONS FLOW:');
  console.log('   John Doe  — Feb 17: REVISION_REQUESTED ("Hours do not match task log")');
  console.log('   Sarah J   — Feb 17: REVISION_REQUESTED ("Missing break time entry")');
  console.log('   → Employee login: see banner + "Resubmit" button');
  console.log('   → Client login: see amber "Revision Requested" badge');
  console.log('');
  console.log('2. OVERTIME REQUESTS:');
  console.log('   John Doe  — Feb 18: APPROVED shift extension (+1h), time record APPROVED');
  console.log('   Sarah J   — Feb 19: PENDING off-shift request (7-9pm)');
  console.log('   Jigar P   — Feb 18: REJECTED shift extension ("Deployment can wait")');
  console.log('');
  console.log('3. ADMIN APPROVALS PAGE:');
  console.log('   John Doe  — Feb 19: PENDING regular 8h → shows "Request Revisions" button (not Reject)');
  console.log('   Sarah J   — Feb 18: PENDING 9h + 1h OT → shows "Reject" button (OT can be denied)');
  console.log('');
  console.log('4. SHIFT-END WARNING (live):');
  console.log('   Sarah J   — ACTIVE session today (started 7h ago) → cron will trigger 30-min warning');
  console.log('');
  console.log('5. POST-SHIFT CLOCK-IN (live):');
  console.log('   Jigar P   — COMPLETED today (auto-clocked out 1h ago) → clock in again to see warning');
  console.log('');
  console.log('Expected auto-approval behavior:');
  console.log('  ABC Corp (auto-approve ON, 24h):');
  console.log('    Auto-approve: Feb 9, 10 (John), Feb 9, 10 (Sarah), Feb 16 (John)');
  console.log('    Stay PENDING: Feb 11 John (60m OT), Feb 16 Sarah (30m OT)');
  console.log('  Virtual Height (auto-approve OFF):');
  console.log('    Stay PENDING: all records (Jigar)');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
