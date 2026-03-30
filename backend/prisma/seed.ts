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

  // Use fewer rounds for seed data — this is demo/dev only
  const hashedPassword = await bcrypt.hash('demo123456', 4);

  const [superAdminRole, clientRole, employeeRole] = await Promise.all([
    prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } }),
    prisma.role.findUnique({ where: { name: 'CLIENT' } }),
    prisma.role.findUnique({ where: { name: 'EMPLOYEE' } }),
  ]);

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
  const [existingC1Contacts, existingC2Contacts] = await Promise.all([
    prisma.clientContact.count({ where: { clientId: c1.id } }),
    prisma.clientContact.count({ where: { clientId: c2.id } }),
  ]);
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
  await Promise.all([
    prisma.clientAgreement.upsert({
      where: { clientId: c1.id },
      update: {},
      create: { clientId: c1.id, agreementType: 'WEEKLY', signedAt: new Date('2026-01-15'), signedByName: 'Jane Smith' },
    }),
    prisma.clientAgreement.upsert({
      where: { clientId: c2.id },
      update: {},
      create: { clientId: c2.id, agreementType: 'MONTHLY', signedAt: new Date('2026-01-20'), signedByName: 'Nikita K' },
    }),
  ]);
  console.log('Created client agreements');

  // ── Default Group ──
  const defaultGroup = await prisma.group.upsert({
    where: { id: 'default-group' },
    update: {},
    create: { id: 'default-group', name: 'Default', description: 'Auto-generated group', isActive: true },
  });

  await Promise.all([
    prisma.clientGroup.upsert({
      where: { clientId_groupId: { clientId: c1.id, groupId: defaultGroup.id } },
      update: {},
      create: { clientId: c1.id, groupId: defaultGroup.id },
    }),
    prisma.clientGroup.upsert({
      where: { clientId_groupId: { clientId: c2.id, groupId: defaultGroup.id } },
      update: {},
      create: { clientId: c2.id, groupId: defaultGroup.id },
    }),
  ]);
  console.log('Created groups');

  // ── Assign Employees to Clients ──
  // John Doe & Sarah → ABC Corporation, Jigar → Virtual Height
  const assignments = [
    { clientId: c1.id, employeeId: e1.id },
    { clientId: c1.id, employeeId: e3.id },
    { clientId: c2.id, employeeId: e2.id },
  ];
  await Promise.all(assignments.map(a =>
    prisma.clientEmployee.upsert({
      where: { clientId_employeeId: { clientId: a.clientId, employeeId: a.employeeId } },
      update: {},
      create: { ...a, isActive: true },
    })
  ));
  console.log('Assigned employees to clients');

  // ── Client Policies (auto-approve ON for ABC, OFF for Virtual Height) ──
  await Promise.all([
    prisma.clientPolicy.upsert({
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
    }),
    prisma.clientPolicy.upsert({
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
    }),
  ]);
  console.log('Created client policies (ABC: auto-approve ON, VH: OFF)');

  // ── Schedules (Mon-Fri 9am-5pm) — skip if employee already has schedules ──
  const scheduleStart = new Date('2026-01-01');
  const empIds = [e1.id, e2.id, e3.id];
  const scheduleCounts = await Promise.all(
    empIds.map(id => prisma.schedule.count({ where: { employeeId: id } }))
  );
  const scheduleData = empIds.flatMap((empId, i) =>
    scheduleCounts[i] === 0
      ? [1, 2, 3, 4, 5].map(day => ({
          employeeId: empId,
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '17:00',
          isActive: true,
          effectiveFrom: scheduleStart,
        }))
      : []
  );
  if (scheduleData.length > 0) {
    await prisma.schedule.createMany({ data: scheduleData });
  }
  console.log('Created schedules for all employees (Mon-Fri 9am-5pm)');

  // ── March Time Records, Work Sessions & Overtime Requests ──
  // Helper to create a UTC date at a specific hour + minutes offset
  const utc = (dateStr: string, hour: number, min = 0) => {
    const d = new Date(`${dateStr}T${String(hour).padStart(2,'0')}:00:00.000Z`);
    if (min !== 0) d.setUTCMinutes(d.getUTCMinutes() + min);
    return d;
  };

  // OT config per employee per date
  // type: SHIFT_EXTENSION (stayed late) or OFF_SHIFT (came in early/weekend)
  // otStatus: APPROVED, PENDING, REJECTED
  // autoGen = true means employee worked OT without prior request (auto-generated by system at clock-out)
  type OTConfig = { extMin?: number; offMin?: number; extStatus?: string; offStatus?: string; extReason?: string; offReason?: string; extAutoGen?: boolean; offAutoGen?: boolean };
  const AUTO_REASON = 'Auto-generated — employee worked overtime without prior request';
  const otSchedule: Record<string, Record<string, OTConfig>> = {
    // John Doe (e1) → ABC Corp
    [e1.id]: {
      // Past week — approved pre-requested OT
      '2026-03-10': { extMin: 45, extStatus: 'APPROVED', extReason: 'Sprint planning overran, finishing action items' },
      '2026-03-12': { extMin: 60, extStatus: 'APPROVED', extReason: 'Client meeting ran over, completing follow-up tasks' },
      '2026-03-13': { offMin: 30, offStatus: 'APPROVED', offReason: 'Came in early to prep deployment' },
      // Current week — mix of pre-requested and auto-generated
      '2026-03-16': { extMin: 75, extStatus: 'PENDING', extReason: 'Bug fix for production issue, needs extra time' },
      '2026-03-17': { extMin: 40, extStatus: 'PENDING', extAutoGen: true }, // stayed late without approval
      '2026-03-18': { extMin: 90, extStatus: 'PENDING', extAutoGen: true, offMin: 25, offStatus: 'PENDING', offAutoGen: true }, // worked early + stayed late without approval
    },
    // Sarah Johnson (e3) → ABC Corp
    [e3.id]: {
      // Past week
      '2026-03-11': { extMin: 30, extStatus: 'APPROVED', extReason: 'Finishing design review feedback' },
      '2026-03-12': { extMin: 60, extStatus: 'APPROVED', extReason: 'Client presentation prep running behind' },
      '2026-03-14': { extMin: 45, offMin: 30, extStatus: 'REJECTED', offStatus: 'APPROVED', extReason: 'Wanted to finish documentation', offReason: 'Early login for overseas client call' },
      // Current week
      '2026-03-16': { extMin: 50, extStatus: 'PENDING', extReason: 'Onboarding new team member, extra training session' },
      '2026-03-17': { extMin: 55, extStatus: 'PENDING', extAutoGen: true }, // kept working after shift without asking
      '2026-03-18': { offMin: 35, offStatus: 'PENDING', offAutoGen: true, extMin: 60, extStatus: 'PENDING', extReason: 'Database migration testing taking longer than expected' }, // early arrival without approval + pre-requested extension
    },
    // Jigar Patel (e2) → Virtual Height
    [e2.id]: {
      // Past week
      '2026-03-10': { extMin: 90, extStatus: 'APPROVED', extReason: 'Project deadline - need extra time to finish deliverables' },
      '2026-03-11': { offMin: 45, offStatus: 'APPROVED', offReason: 'Early morning deployment to staging' },
      '2026-03-13': { extMin: 120, extStatus: 'APPROVED', extReason: 'Critical hotfix for payment processing bug' },
      '2026-03-14': { extMin: 60, extStatus: 'REJECTED', extReason: 'Wanted to refactor auth module' },
      // Current week
      '2026-03-16': { extMin: 70, extStatus: 'PENDING', extAutoGen: true }, // stayed late without approval
      '2026-03-17': { extMin: 60, extStatus: 'PENDING', extReason: 'Load testing before launch', offMin: 45, offStatus: 'PENDING', offAutoGen: true }, // pre-requested ext + early arrival without approval
      '2026-03-18': { extMin: 85, extStatus: 'PENDING', extAutoGen: true, offMin: 30, offStatus: 'PENDING', offAutoGen: true }, // both without approval
    },
  };

  // EST times: 9:00 AM EST = 13:00 UTC, 5:00 PM EST = 21:00 UTC
  const marchDays = [
    '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-14',
    '2026-03-16', '2026-03-17', '2026-03-18',
  ];

  const empClientPairs = [
    { emp: e1, client: c1 },
    { emp: e3, client: c1 },
    { emp: e2, client: c2 },
  ];

  for (const { emp, client } of empClientPairs) {
    for (const dateStr of marchDays) {
      const ot = otSchedule[emp.id]?.[dateStr] || {};
      const extMin = ot.extMin || 0;
      const offMin = ot.offMin || 0;
      const totalOTMin = extMin + offMin;

      // Clock in/out — off-shift OT means early arrival
      const inMinOffset = emp.id === e1.id ? 0 : emp.id === e2.id ? 5 : -3;
      const earlyMin = offMin > 0 ? offMin : 0;
      const clockIn = utc(dateStr, 13, inMinOffset - earlyMin);
      const clockOut = utc(dateStr, 21, extMin); // scheduled end + extension

      const totalMinutes = Math.round((clockOut.getTime() - clockIn.getTime()) / 60000);
      const breakMinutes = 30;
      const billingMinutes = totalMinutes - breakMinutes;
      const isLate = inMinOffset > 0 && earlyMin === 0;

      const isCurrentWeek = dateStr >= '2026-03-16';
      // Determine time record status
      let trStatus: 'PENDING' | 'APPROVED' | 'AUTO_APPROVED' = 'AUTO_APPROVED';
      if (isCurrentWeek) trStatus = 'PENDING';
      if (totalOTMin > 0 && !isCurrentWeek) {
        // Past week with OT: approved if all OT approved, otherwise auto_approved
        const allApproved = (ot.extStatus === 'APPROVED' || !extMin) && (ot.offStatus === 'APPROVED' || !offMin);
        trStatus = allApproved ? 'APPROVED' : 'AUTO_APPROVED';
      }

      // Shift extension / extra time statuses on time record
      const shiftExtStatus = extMin > 0
        ? (isCurrentWeek ? 'PENDING' : (ot.extStatus === 'REJECTED' ? 'DENIED' : 'APPROVED'))
        : 'NONE';
      const extraTimeStatus = offMin > 0
        ? (isCurrentWeek ? 'PENDING' : (ot.offStatus === 'REJECTED' ? 'DENIED' : 'APPROVED'))
        : 'NONE';

      // Create work session
      await prisma.workSession.create({
        data: {
          employeeId: emp.id,
          startTime: clockIn,
          endTime: clockOut,
          status: 'COMPLETED',
          totalBreakMinutes: breakMinutes,
          arrivalStatus: isLate ? 'Late' : 'On Time',
          lateMinutes: isLate ? inMinOffset : null,
          scheduledStartTime: '09:00',
          scheduledEndTime: '17:00',
        },
      });

      // Create time record (upsert to avoid unique constraint on re-seed)
      await prisma.timeRecord.upsert({
        where: {
          employeeId_clientId_date: {
            employeeId: emp.id,
            clientId: client.id,
            date: new Date(`${dateStr}T00:00:00.000Z`),
          },
        },
        update: {},
        create: {
          employeeId: emp.id,
          clientId: client.id,
          date: new Date(`${dateStr}T00:00:00.000Z`),
          scheduledStart: utc(dateStr, 13, 0),
          scheduledEnd: utc(dateStr, 21, 0),
          actualStart: clockIn,
          actualEnd: clockOut,
          billingStart: utc(dateStr, 13, -earlyMin),
          billingEnd: utc(dateStr, 21, 0),
          billingMinutes,
          isLate,
          totalMinutes,
          breakMinutes,
          overtimeMinutes: totalOTMin,
          shiftExtensionStatus: shiftExtStatus as any,
          shiftExtensionMinutes: extMin,
          extraTimeStatus: extraTimeStatus as any,
          extraTimeMinutes: offMin,
          status: trStatus,
          approvedBy: trStatus === 'APPROVED' ? admin.id : null,
          approvedAt: trStatus === 'APPROVED' || trStatus === 'AUTO_APPROVED' ? new Date() : null,
        },
      });

      // Create overtime requests — set createdAt near clock-out so the time records API can match them
      const otCreatedAt = new Date(clockOut.getTime() + 60000); // 1 min after clock-out
      if (extMin > 0) {
        const resolvedStatus = isCurrentWeek ? 'PENDING' : (ot.extStatus || 'APPROVED');
        await prisma.overtimeRequest.create({
          data: {
            employeeId: emp.id,
            clientId: client.id,
            date: new Date(`${dateStr}T00:00:00.000Z`),
            type: 'SHIFT_EXTENSION',
            requestedMinutes: extMin,
            estimatedEndTime: `${17 + Math.floor(extMin / 60)}:${String(extMin % 60).padStart(2, '0')}`,
            reason: ot.extAutoGen ? AUTO_REASON : (ot.extReason || 'Extended shift for project work'),
            isAutoGenerated: ot.extAutoGen || false,
            status: resolvedStatus as any,
            createdAt: otCreatedAt,
            approvedBy: resolvedStatus === 'APPROVED' ? admin.id : (resolvedStatus === 'REJECTED' ? admin.id : undefined),
            approvedAt: resolvedStatus === 'APPROVED' ? new Date(otCreatedAt.getTime() + 60000) : undefined,
            rejectedBy: resolvedStatus === 'REJECTED' ? admin.id : undefined,
            rejectedAt: resolvedStatus === 'REJECTED' ? new Date(otCreatedAt.getTime() + 60000) : undefined,
            rejectionReason: resolvedStatus === 'REJECTED' ? 'Not pre-approved, please request in advance' : undefined,
          },
        });
      }
      if (offMin > 0) {
        const resolvedStatus = isCurrentWeek ? 'PENDING' : (ot.offStatus || 'APPROVED');
        await prisma.overtimeRequest.create({
          data: {
            employeeId: emp.id,
            clientId: client.id,
            date: new Date(`${dateStr}T00:00:00.000Z`),
            type: 'OFF_SHIFT',
            requestedMinutes: offMin,
            requestedStartTime: `${8 - Math.floor(offMin / 60)}:${String(60 - (offMin % 60)).padStart(2, '0')}`,
            requestedEndTime: '09:00',
            reason: ot.offAutoGen ? AUTO_REASON : (ot.offReason || 'Early start for project needs'),
            isAutoGenerated: ot.offAutoGen || false,
            status: resolvedStatus as any,
            createdAt: otCreatedAt,
            approvedBy: resolvedStatus === 'APPROVED' ? admin.id : (resolvedStatus === 'REJECTED' ? admin.id : undefined),
            approvedAt: resolvedStatus === 'APPROVED' ? new Date(otCreatedAt.getTime() + 60000) : undefined,
            rejectedBy: resolvedStatus === 'REJECTED' ? admin.id : undefined,
            rejectedAt: resolvedStatus === 'REJECTED' ? new Date(otCreatedAt.getTime() + 60000) : undefined,
            rejectionReason: resolvedStatus === 'REJECTED' ? 'Off-shift work was not authorized' : undefined,
          },
        });
      }
    }
  }
  console.log('Created March time records, work sessions & overtime requests');

  // ── January & February Time Records, Payroll, and Invoices ──
  // Generate weekdays for Jan & Feb
  const getWeekdays = (year: number, month: number): string[] => {
    const days: string[] = [];
    const d = new Date(year, month - 1, 1);
    while (d.getMonth() === month - 1) {
      const dow = d.getDay();
      if (dow >= 1 && dow <= 5) {
        days.push(d.toISOString().split('T')[0]);
      }
      d.setDate(d.getDate() + 1);
    }
    return days;
  };

  const janDays = getWeekdays(2026, 1);
  const febDays = getWeekdays(2026, 2);
  const allHistoricalDays = [...janDays, ...febDays];

  // Random-ish variation per day (deterministic based on date string)
  const hashDate = (s: string) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  };

  for (const { emp, client } of empClientPairs) {
    for (const dateStr of allHistoricalDays) {
      const seed = hashDate(dateStr + emp.id);
      const lateChance = seed % 10; // 0-9
      const inMinOffset = lateChance === 0 ? 7 : lateChance === 1 ? 3 : 0; // ~20% late
      const clockIn = utc(dateStr, 13, inMinOffset);

      // ~25% of days have OT (30-90 min)
      const hasOT = seed % 4 === 0;
      const otMin = hasOT ? 30 + (seed % 4) * 15 : 0; // 30, 45, 60, or 75
      const clockOut = utc(dateStr, 21, otMin);

      const totalMinutes = Math.round((clockOut.getTime() - clockIn.getTime()) / 60000);
      const breakMinutes = 30;
      const billingMinutes = totalMinutes - breakMinutes;
      const isLate = inMinOffset > 0;

      await prisma.workSession.create({
        data: {
          employeeId: emp.id,
          startTime: clockIn,
          endTime: clockOut,
          status: 'COMPLETED',
          totalBreakMinutes: breakMinutes,
          arrivalStatus: isLate ? 'Late' : 'On Time',
          lateMinutes: isLate ? inMinOffset : null,
          scheduledStartTime: '09:00',
          scheduledEndTime: '17:00',
        },
      });

      await prisma.timeRecord.upsert({
        where: {
          employeeId_clientId_date: {
            employeeId: emp.id,
            clientId: client.id,
            date: new Date(`${dateStr}T00:00:00.000Z`),
          },
        },
        update: {},
        create: {
          employeeId: emp.id,
          clientId: client.id,
          date: new Date(`${dateStr}T00:00:00.000Z`),
          scheduledStart: utc(dateStr, 13, 0),
          scheduledEnd: utc(dateStr, 21, 0),
          actualStart: clockIn,
          actualEnd: clockOut,
          billingStart: utc(dateStr, 13, 0),
          billingEnd: utc(dateStr, 21, 0),
          billingMinutes,
          isLate,
          totalMinutes,
          breakMinutes,
          overtimeMinutes: otMin,
          shiftExtensionStatus: hasOT ? 'APPROVED' as any : 'NONE' as any,
          shiftExtensionMinutes: otMin,
          status: 'APPROVED',
          approvedBy: admin.id,
          approvedAt: new Date(dateStr + 'T22:00:00.000Z'),
        },
      });

      if (hasOT) {
        const histOTCreatedAt = new Date(clockOut.getTime() + 60000);
        await prisma.overtimeRequest.create({
          data: {
            employeeId: emp.id,
            clientId: client.id,
            date: new Date(`${dateStr}T00:00:00.000Z`),
            type: 'SHIFT_EXTENSION',
            requestedMinutes: otMin,
            estimatedEndTime: `${17 + Math.floor(otMin / 60)}:${String(otMin % 60).padStart(2, '0')}`,
            reason: ['Sprint work extending past EOD', 'Client deliverable deadline', 'Bug fix required before release', 'Code review backlog'][seed % 4],
            status: 'APPROVED',
            createdAt: histOTCreatedAt,
            approvedBy: admin.id,
            approvedAt: new Date(dateStr + 'T22:00:00.000Z'),
          },
        });
      }
    }
  }
  console.log('Created Jan & Feb time records and work sessions');

  // ── Payroll Periods (bi-monthly: 1st-15th and 16th-end) ──
  const payrollPeriods = [
    { start: '2026-01-01', end: '2026-01-15', cutoff: '2026-01-16T05:00:00.000Z' },
    { start: '2026-01-16', end: '2026-01-31', cutoff: '2026-02-01T05:00:00.000Z' },
    { start: '2026-02-01', end: '2026-02-15', cutoff: '2026-02-16T05:00:00.000Z' },
    { start: '2026-02-16', end: '2026-02-28', cutoff: '2026-03-01T05:00:00.000Z' },
  ];

  for (const { emp, client } of empClientPairs) {
    for (const pp of payrollPeriods) {
      // Count working days and hours in this period
      const periodDays = allHistoricalDays.filter(d => d >= pp.start && d <= pp.end);
      let totalMin = 0, otMin = 0;
      for (const d of periodDays) {
        const s = hashDate(d + emp.id);
        const late = s % 10 === 0 ? 7 : s % 10 === 1 ? 3 : 0;
        const hasOT = s % 4 === 0;
        const dayOT = hasOT ? 30 + (s % 4) * 15 : 0;
        totalMin += 480 + dayOT - late; // 8h base + OT - late
        otMin += dayOT;
      }
      const regularMin = totalMin - otMin;
      const regularHours = Math.round(regularMin / 60 * 100) / 100;
      const overtimeHours = Math.round(otMin / 60 * 100) / 100;
      const totalHours = regularHours + overtimeHours;

      // Rates
      const hourlyRate = emp.id === e1.id ? 25 : emp.id === e2.id ? 28 : 26;
      const overtimeRate = hourlyRate * 1;
      const billingRate = emp.id === e1.id ? 35 : emp.id === e2.id ? 40 : 38;
      const billingOTRate = billingRate * 1;

      const regularPay = Math.round(regularHours * hourlyRate * 100) / 100;
      const overtimePay = Math.round(overtimeHours * overtimeRate * 100) / 100;
      const grossPay = regularPay + overtimePay;

      // Create payroll period (per client)
      await prisma.payrollPeriod.upsert({
        where: {
          clientId_periodStart_periodEnd: {
            clientId: client.id,
            periodStart: new Date(pp.start + 'T00:00:00.000Z'),
            periodEnd: new Date(pp.end + 'T00:00:00.000Z'),
          },
        },
        update: {},
        create: {
          clientId: client.id,
          periodStart: new Date(pp.start + 'T00:00:00.000Z'),
          periodEnd: new Date(pp.end + 'T00:00:00.000Z'),
          cutoffDate: new Date(pp.cutoff),
          status: 'FINALIZED',
          totalHours,
          totalOvertimeHours: overtimeHours,
          approvedHours: totalHours,
          pendingHours: 0,
          finalizedAt: new Date(pp.cutoff),
          finalizedBy: admin.id,
        },
      });

      // Create payslip (skip if already exists)
      try {
        await prisma.payslip.create({
          data: {
            employeeId: emp.id,
            clientId: client.id,
            periodStart: new Date(pp.start + 'T00:00:00.000Z'),
            periodEnd: new Date(pp.end + 'T00:00:00.000Z'),
            regularHours,
            overtimeHours,
            totalHours,
            hourlyRate,
            overtimeRate,
            regularPay,
            overtimePay,
            totalBonuses: 0,
            totalDeductions: 0,
            grossPay,
            workDays: periodDays.length,
            status: 'GENERATED',
          },
        });
      } catch (e: any) {
        if (!e.code || e.code !== 'P2002') throw e; // re-throw if not unique constraint
      }
    }
  }
  console.log('Created Jan & Feb payroll periods and payslips');

  // ── Invoices (matching payroll periods per client) ──
  const clientInvoices = [
    { client: c1, empList: [e1, e3], prefix: 'INV-ABC' },
    { client: c2, empList: [e2], prefix: 'INV-VH' },
  ];

  let invoiceSeq = 1;
  for (const { client: cl, empList, prefix } of clientInvoices) {
    for (const pp of payrollPeriods) {
      const periodDays = allHistoricalDays.filter(d => d >= pp.start && d <= pp.end);
      let invoiceTotalHours = 0, invoiceOTHours = 0, invoiceSubtotal = 0;
      const lineItemsData: Array<{
        employeeId: string;
        employeeName: string;
        hours: number;
        overtimeHours: number;
        rate: number;
        overtimeRate: number;
        amount: number;
      }> = [];

      for (const emp of empList) {
        let empTotalMin = 0, empOTMin = 0;
        for (const d of periodDays) {
          const s = hashDate(d + emp.id);
          const late = s % 10 === 0 ? 7 : s % 10 === 1 ? 3 : 0;
          const hasOT = s % 4 === 0;
          const dayOT = hasOT ? 30 + (s % 4) * 15 : 0;
          empTotalMin += 480 + dayOT - late;
          empOTMin += dayOT;
        }
        const empRegularH = Math.round((empTotalMin - empOTMin) / 60 * 100) / 100;
        const empOTH = Math.round(empOTMin / 60 * 100) / 100;
        const billingRate = emp.id === e1.id ? 35 : emp.id === e2.id ? 40 : 38;
        const billingOTRate = billingRate * 1;
        const lineAmount = Math.round((empRegularH * billingRate + empOTH * billingOTRate) * 100) / 100;

        const empName = emp.id === e1.id ? 'John Doe' : emp.id === e2.id ? 'Jigar Patel' : 'Sarah Johnson';
        lineItemsData.push({
          employeeId: emp.id,
          employeeName: empName,
          hours: empRegularH,
          overtimeHours: empOTH,
          rate: billingRate,
          overtimeRate: billingOTRate,
          amount: lineAmount,
        });
        invoiceTotalHours += empRegularH + empOTH;
        invoiceOTHours += empOTH;
        invoiceSubtotal += lineAmount;
      }

      const invoiceNumber = `${prefix}-2026-${String(invoiceSeq++).padStart(3, '0')}`;
      const dueDate = new Date(pp.cutoff);
      dueDate.setDate(dueDate.getDate() + 30);
      // Jan invoices are PAID, Feb invoices are SENT
      const isJan = pp.start.startsWith('2026-01');
      const invStatus = isJan ? 'PAID' : 'SENT';

      try {
        await prisma.invoice.create({
          data: {
            clientId: cl.id,
            invoiceNumber,
            periodStart: new Date(pp.start + 'T00:00:00.000Z'),
            periodEnd: new Date(pp.end + 'T00:00:00.000Z'),
            totalHours: Math.round(invoiceTotalHours * 100) / 100,
            overtimeHours: Math.round(invoiceOTHours * 100) / 100,
            subtotal: invoiceSubtotal,
            total: invoiceSubtotal,
            currency: 'USD',
            status: invStatus as any,
            dueDate,
            notes: isJan ? 'Payment received. Thank you!' : null,
            clientPaidAt: isJan ? new Date(pp.cutoff) : null,
            lineItems: {
              create: lineItemsData,
            },
          },
        });
      } catch (e: any) {
        if (!e.code || e.code !== 'P2002') throw e;
      }
    }
  }
  console.log('Created Jan & Feb invoices with line items');

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
  console.log('');
  console.log('Clients:');
  console.log('  client@demo.com      (ABC Corporation    — America/New_York   UTC-5)');
  console.log('  vhits@demo.com       (Virtual Height     — America/New_York   UTC-5)');
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
