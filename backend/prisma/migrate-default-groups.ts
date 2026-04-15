/**
 * Migration: Give every client their own default group.
 *
 * Previously, all clients shared a single global "Default" group.
 * This script creates a unique "Default" group per client, migrates
 * any employees from the shared group that belong to that client,
 * then cleans up the old shared groups.
 *
 * Usage: npx ts-node prisma/migrate-default-groups.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Migrating Default Groups ===\n');

  // Find all clients
  const clients = await prisma.client.findMany({
    select: { id: true, companyName: true },
  });
  console.log(`Found ${clients.length} clients.\n`);

  for (const client of clients) {
    console.log(`Processing: ${client.companyName} (${client.id.substring(0, 8)}...)`);

    // Find any "Default" groups currently linked to this client
    const clientGroupLinks = await prisma.clientGroup.findMany({
      where: { clientId: client.id },
      include: {
        group: {
          include: {
            clients: { select: { clientId: true } },
            employees: { select: { employeeId: true } },
          },
        },
      },
    });

    const defaultLinks = clientGroupLinks.filter(
      (cg) => cg.group.name === 'Default'
    );

    if (defaultLinks.length === 0) {
      // No Default group at all — create one
      console.log(`  → No Default group found. Creating one.`);
      const newGroup = await prisma.group.create({
        data: {
          name: 'Default',
          description: `Default group for ${client.companyName}`,
        },
      });
      await prisma.clientGroup.create({
        data: { clientId: client.id, groupId: newGroup.id },
      });
      console.log(`  ✓ Created new Default group (${newGroup.id.substring(0, 8)}...)\n`);
      continue;
    }

    for (const link of defaultLinks) {
      const group = link.group;
      const sharedWith = group.clients.filter((c) => c.clientId !== client.id);

      if (sharedWith.length === 0) {
        // This "Default" group is already exclusive to this client
        console.log(`  ✓ Already has exclusive Default group (${group.id.substring(0, 8)}...) — skipping.\n`);
        continue;
      }

      // Group is shared — create a new exclusive one for this client
      console.log(`  → Default group is shared with ${sharedWith.length} other client(s). Creating exclusive one.`);

      const newGroup = await prisma.group.create({
        data: {
          name: 'Default',
          description: `Default group for ${client.companyName}`,
        },
      });

      await prisma.clientGroup.create({
        data: { clientId: client.id, groupId: newGroup.id },
      });

      // Migrate employees from the shared group that belong to this client
      const clientEmployeeIds = new Set(
        (
          await prisma.clientEmployee.findMany({
            where: { clientId: client.id, isActive: true },
            select: { employeeId: true },
          })
        ).map((ce) => ce.employeeId)
      );

      const employeesToMove = group.employees.filter((ge) =>
        clientEmployeeIds.has(ge.employeeId)
      );

      if (employeesToMove.length > 0) {
        await prisma.groupEmployee.createMany({
          data: employeesToMove.map((ge) => ({
            groupId: newGroup.id,
            employeeId: ge.employeeId,
          })),
          skipDuplicates: true,
        });
        console.log(`  → Moved ${employeesToMove.length} employee(s) to the new group.`);
      }

      // Remove this client's link to the shared group
      await prisma.clientGroup.delete({
        where: { clientId_groupId: { clientId: client.id, groupId: group.id } },
      });

      console.log(`  ✓ Created exclusive Default group (${newGroup.id.substring(0, 8)}...) and removed shared link.\n`);
    }
  }

  // Clean up any "Default" groups that are now orphaned (no clients linked)
  console.log('Cleaning up orphaned Default groups...');
  const orphanedGroups = await prisma.group.findMany({
    where: {
      name: 'Default',
      clients: { none: {} },
    },
    select: { id: true },
  });

  if (orphanedGroups.length > 0) {
    // Remove employee links first, then delete groups
    await prisma.groupEmployee.deleteMany({
      where: { groupId: { in: orphanedGroups.map((g) => g.id) } },
    });
    await prisma.group.deleteMany({
      where: { id: { in: orphanedGroups.map((g) => g.id) } },
    });
    console.log(`Deleted ${orphanedGroups.length} orphaned Default group(s).\n`);
  } else {
    console.log('No orphaned groups to clean up.\n');
  }

  console.log('=== Migration Complete ===');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
