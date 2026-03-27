import { Response } from "express";
import prisma from "../config/database";
import { AuthenticatedRequest } from "../types";
import { deactivateOtherClientAssignments } from "./employee.controller";

// Get all groups with pagination and filters
export const getGroups = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { page = "1", limit = "10", search = "", status = "" } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: "insensitive" } },
        { description: { contains: search as string, mode: "insensitive" } },
      ];
    }

    if (status === "inactive") {
      where.isActive = false;
    } else if (status === "all") {
      // Show all groups (no filter)
    } else {
      // Default: show only active groups
      where.isActive = true;
    }

    const [groups, total] = await Promise.all([
      prisma.group.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          employees: {
            include: {
              employee: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  profilePhoto: true,
                  user: {
                    select: {
                      email: true,
                      status: true,
                    },
                  },
                  clientAssignments: {
                    where: { isActive: true },
                    include: {
                      client: {
                        select: {
                          id: true,
                          companyName: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          clients: {
            include: {
              client: {
                select: {
                  id: true,
                  companyName: true,
                },
              },
            },
          },
          _count: {
            select: {
              employees: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.group.count({ where }),
    ]);

    const groupsWithStats = groups.map((group) => ({
      ...group,
      billingRate: group.billingRate ? Number(group.billingRate) : null,
      clients: group.clients.map((cg) => ({
        ...cg,
        billingRate: cg.billingRate ? Number(cg.billingRate) : null,
      })),
      employeeCount: group._count.employees,
    }));

    res.json({
      success: true,
      data: {
        groups: groupsWithStats,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error("Get groups error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch groups",
    });
  }
};

// Get single group by ID
export const getGroup = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;

    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        employees: {
          include: {
            employee: {
              include: {
                user: {
                  select: {
                    email: true,
                    status: true,
                  },
                },
                clientAssignments: {
                  where: { isActive: true },
                  include: {
                    client: {
                      select: {
                        id: true,
                        companyName: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        clients: {
          include: {
            client: {
              select: {
                id: true,
                companyName: true,
              },
            },
          },
        },
        _count: {
          select: {
            employees: true,
          },
        },
      },
    });

    if (!group) {
      res.status(404).json({
        success: false,
        error: "Group not found",
      });
      return;
    }

    res.json({
      success: true,
      data: {
        ...group,
        billingRate: group.billingRate ? Number(group.billingRate) : null,
        employeeCount: group._count.employees,
      },
    });
  } catch (error) {
    console.error("Get group error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch group",
    });
  }
};

// Create new group
export const createGroup = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { name, description, billingRate, clientId } = req.body;

    if (!name) {
      res.status(400).json({
        success: false,
        error: "Group name is required",
      });
      return;
    }

    const group = await prisma.group.create({
      data: {
        name,
        description,
        billingRate: billingRate ? parseFloat(billingRate) : null,
        ...(clientId ? {
          clients: {
            create: {
              clientId,
              billingRate: billingRate ? parseFloat(billingRate) : null,
            },
          },
        } : {}),
      },
      include: {
        clients: { include: { client: { select: { id: true, companyName: true } } } },
        _count: {
          select: {
            employees: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: "Group created successfully",
      data: {
        ...group,
        billingRate: group.billingRate ? Number(group.billingRate) : null,
        employeeCount: group._count.employees,
      },
    });
  } catch (error) {
    console.error("Create group error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create group",
    });
  }
};

// Update group
export const updateGroup = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { name, description, isActive, billingRate } = req.body;

    const existingGroup = await prisma.group.findUnique({ where: { id } });

    if (!existingGroup) {
      res.status(404).json({
        success: false,
        error: "Group not found",
      });
      return;
    }

    const group = await prisma.group.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
        ...(billingRate !== undefined && { billingRate: billingRate ? parseFloat(billingRate) : null }),
      },
      include: {
        employees: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePhoto: true,
                user: {
                  select: {
                    email: true,
                    status: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            employees: true,
          },
        },
      },
    });

    res.json({
      success: true,
      message: "Group updated successfully",
      data: {
        ...group,
        billingRate: group.billingRate ? Number(group.billingRate) : null,
        employeeCount: group._count.employees,
      },
    });
  } catch (error) {
    console.error("Update group error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update group",
    });
  }
};

// Delete group (soft delete)
export const deleteGroup = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;

    const group = await prisma.group.findUnique({ where: { id } });

    if (!group) {
      res.status(404).json({
        success: false,
        error: "Group not found",
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Soft delete the group
      await tx.group.update({
        where: { id },
        data: { isActive: false },
      });

      // Remove all employee assignments
      await tx.groupEmployee.deleteMany({
        where: { groupId: id },
      });
    });

    res.json({
      success: true,
      message: "Group deleted successfully",
    });
  } catch (error) {
    console.error("Delete group error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete group",
    });
  }
};

// Get employees in a group
export const getGroupEmployees = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;

    const group = await prisma.group.findUnique({ where: { id } });

    if (!group) {
      res.status(404).json({
        success: false,
        error: "Group not found",
      });
      return;
    }

    const employees = await prisma.groupEmployee.findMany({
      where: { groupId: id },
      include: {
        employee: {
          include: {
            user: {
              select: {
                email: true,
                status: true,
              },
            },
          },
        },
      },
    });

    const employeeList = employees.map((ge) => ({
      ...ge.employee,
      assignedAt: ge.assignedAt,
    }));

    res.json({
      success: true,
      data: employeeList,
    });
  } catch (error) {
    console.error("Get group employees error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch group employees",
    });
  }
};

// Add employees to group
export const addEmployees = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { employeeIds } = req.body;

    if (
      !employeeIds ||
      !Array.isArray(employeeIds) ||
      employeeIds.length === 0
    ) {
      res.status(400).json({
        success: false,
        error: "Employee IDs array is required",
      });
      return;
    }

    const group = await prisma.group.findUnique({ where: { id } });

    if (!group) {
      res.status(404).json({
        success: false,
        error: "Group not found",
      });
      return;
    }

    // Create assignments, skipping duplicates
    for (const employeeId of employeeIds) {
      const existing = await prisma.groupEmployee.findUnique({
        where: {
          groupId_employeeId: {
            groupId: id,
            employeeId,
          },
        },
      });

      if (!existing) {
        await prisma.groupEmployee.create({
          data: {
            groupId: id,
            employeeId,
          },
        });
      }
    }

    res.json({
      success: true,
      message: "Employees added to group successfully",
    });
  } catch (error) {
    console.error("Add employees to group error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to add employees to group",
    });
  }
};

// Remove employee from group
export const removeEmployee = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const employeeId = req.params.employeeId as string;

    await prisma.groupEmployee.deleteMany({
      where: {
        groupId: id,
        employeeId,
      },
    });

    res.json({
      success: true,
      message: "Employee removed from group successfully",
    });
  } catch (error) {
    console.error("Remove employee from group error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to remove employee from group",
    });
  }
};

// Assign group to client (creates direct link + assigns existing employees)
export const assignGroupToClient = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const groupId = req.params.id as string;
    const { clientId, billingRate } = req.body;

    if (!clientId) {
      res.status(400).json({ success: false, error: "Client ID is required" });
      return;
    }

    // Check group exists
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { employees: { select: { employeeId: true } } },
    });
    if (!group) {
      res.status(404).json({ success: false, error: "Group not found" });
      return;
    }

    // Check client exists
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      res.status(404).json({ success: false, error: "Client not found" });
      return;
    }

    // Create the direct group-client link (upsert to avoid duplicates)
    const parsedRate = billingRate ? parseFloat(billingRate) : null;
    await prisma.clientGroup.upsert({
      where: { clientId_groupId: { clientId, groupId } },
      create: { clientId, groupId, billingRate: parsedRate },
      update: { billingRate: parsedRate },
    });

    // Also assign any existing group employees to the client (1-client-per-employee)
    if (group.employees.length > 0) {
      for (const ge of group.employees) {
        await deactivateOtherClientAssignments(ge.employeeId, clientId);

        const existing = await prisma.clientEmployee.findUnique({
          where: { clientId_employeeId: { clientId, employeeId: ge.employeeId } },
        });
        if (existing) {
          if (!existing.isActive) {
            await prisma.clientEmployee.update({
              where: { id: existing.id },
              data: { isActive: true },
            });
          }
        } else {
          await prisma.clientEmployee.create({
            data: { clientId, employeeId: ge.employeeId, isActive: true },
          });
        }
      }
    }

    res.json({ success: true, message: "Group assigned to client successfully" });
  } catch (error) {
    console.error("Assign group to client error:", error);
    res.status(500).json({ success: false, error: "Failed to assign group to client" });
  }
};

// Unassign group from client (removes direct link + removes employee assignments)
export const unassignGroupFromClient = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const groupId = req.params.id as string;
    const clientId = req.params.clientId as string;

    // Delete the direct group-client link
    await prisma.clientGroup.deleteMany({
      where: { clientId, groupId },
    });

    // Also deactivate employee assignments from this group
    const groupEmployees = await prisma.groupEmployee.findMany({
      where: { groupId },
      select: { employeeId: true },
    });

    for (const ge of groupEmployees) {
      await prisma.clientEmployee.updateMany({
        where: { clientId, employeeId: ge.employeeId },
        data: { isActive: false },
      });
    }

    res.json({ success: true, message: "Group unassigned from client successfully" });
  } catch (error) {
    console.error("Unassign group from client error:", error);
    res.status(500).json({ success: false, error: "Failed to unassign group from client" });
  }
};

// Get clients assigned to a group
export const getGroupClients = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const groupId = req.params.id as string;

    const clientGroups = await prisma.clientGroup.findMany({
      where: { groupId },
      include: {
        client: {
          select: { id: true, companyName: true, contactPerson: true },
        },
      },
    });

    res.json({
      success: true,
      data: clientGroups.map((cg) => ({
        id: cg.client.id,
        companyName: cg.client.companyName,
        contactPerson: cg.client.contactPerson,
        billingRate: cg.billingRate ? Number(cg.billingRate) : null,
        assignedAt: cg.assignedAt,
      })),
    });
  } catch (error) {
    console.error("Get group clients error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch group clients" });
  }
};
