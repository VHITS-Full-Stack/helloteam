import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Hash password for all demo users
  const hashedPassword = await bcrypt.hash('demo123456', 10);

  // Create Demo Employee
  const employee = await prisma.user.upsert({
    where: { email: 'employee@demo.com' },
    update: {},
    create: {
      email: 'employee@demo.com',
      password: hashedPassword,
      role: 'EMPLOYEE',
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
    update: {},
    create: {
      email: 'client@demo.com',
      password: hashedPassword,
      role: 'CLIENT',
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
    update: {},
    create: {
      email: 'admin@demo.com',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
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
        paidLeaveType: 'fixed',
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
