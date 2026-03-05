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
