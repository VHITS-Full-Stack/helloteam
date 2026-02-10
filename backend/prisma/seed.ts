import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ROLE_PERMISSIONS, ALL_PERMISSIONS } from '../src/config/permissions';

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
  console.log('🔐 Seeding roles and permissions...');

  for (const roleConfig of DEFAULT_ROLES) {
    // Create or update the role
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

    // Get permissions for this role from the static config
    const permissions = ROLE_PERMISSIONS[roleConfig.name] || [];

    // Delete existing permissions for this role
    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id },
    });

    // Create new permissions
    if (permissions.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissions.map((permission: string) => ({
          roleId: role.id,
          permission,
        })),
        skipDuplicates: true,
      });
    }

    console.log(`  ✅ ${role.displayName}: ${permissions.length} permissions`);
  }

  console.log('✅ Roles and permissions seeded successfully!');
}

async function main() {
  console.log('🌱 Starting seed...');

  // Seed roles and permissions first
  await seedRolesAndPermissions();
  console.log('');

  // Hash password for all demo users
  const hashedPassword = await bcrypt.hash('demo123456', 10);

  // Get role IDs for linking
  const superAdminRole = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
  const clientRole = await prisma.role.findUnique({ where: { name: 'CLIENT' } });
  const employeeRole = await prisma.role.findUnique({ where: { name: 'EMPLOYEE' } });

  // Create Demo Employee
  const employee = await prisma.user.upsert({
    where: { email: 'employee@demo.com' },
    update: {
      roleId: employeeRole?.id,
    },
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
        },
      },
    },
    include: { employee: true },
  });
  console.log('✅ Created employee:', employee.email);

  // Create Demo Client
  const client = await prisma.user.upsert({
    where: { email: 'client@demo.com' },
    update: {
      roleId: clientRole?.id,
    },
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
        },
      },
    },
    include: { client: true },
  });
  console.log('✅ Created client:', client.email);

  // Create Demo Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: {
      roleId: superAdminRole?.id,
    },
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
  console.log('✅ Created admin:', admin.email);

  // Create Default group
  const defaultGroup = await prisma.group.upsert({
    where: { id: 'default-group' },
    update: {},
    create: {
      id: 'default-group',
      name: 'Default',
      description: 'This is auto generated group',
      isActive: true,
    },
  });
  console.log('✅ Created Default group');

  // Assign Default group to demo client
  if (client.client) {
    await prisma.clientGroup.upsert({
      where: {
        clientId_groupId: {
          clientId: client.client.id,
          groupId: defaultGroup.id,
        },
      },
      update: {},
      create: {
        clientId: client.client.id,
        groupId: defaultGroup.id,
      },
    });
    console.log('✅ Assigned Default group to demo client');
  }

  // Assign employee to client
  if (employee.employee && client.client) {
    await prisma.clientEmployee.upsert({
      where: {
        clientId_employeeId: {
          clientId: client.client.id,
          employeeId: employee.employee.id,
        },
      },
      update: {},
      create: {
        clientId: client.client.id,
        employeeId: employee.employee.id,
        isActive: true,
      },
    });
    console.log('✅ Assigned employee to client');

    // Create client policy
    await prisma.clientPolicy.upsert({
      where: { clientId: client.client.id },
      update: {},
      create: {
        clientId: client.client.id,
        allowPaidLeave: true,
        paidLeaveEntitlementType: 'FIXED',
        annualPaidLeaveDays: 15,
        allowUnpaidLeave: true,
        requireTwoWeeksNotice: true,
        allowOvertime: true,
        overtimeRequiresApproval: true,
      },
    });
    console.log('✅ Created client policy');

    // Create sample schedule for employee (Mon-Fri 9am-5pm)
    for (let day = 1; day <= 5; day++) {
      await prisma.schedule.create({
        data: {
          employeeId: employee.employee.id,
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '17:00',
          isActive: true,
          effectiveFrom: new Date(),
        },
      });
    }
    console.log('✅ Created employee schedule (Mon-Fri 9am-5pm)');
  }

  console.log('');
  console.log('🎉 Seed completed successfully!');
  console.log('');
  console.log('Demo Credentials:');
  console.log('─────────────────');
  console.log('Employee: employee@demo.com / demo123456');
  console.log('Client:   client@demo.com / demo123456');
  console.log('Admin:    admin@demo.com / demo123456');
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
