import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import prisma from '../config/database';
import { hashPassword } from '../utils/helpers';
import { AuthenticatedRequest } from '../types';
import { getPresignedUrl, getKeyFromUrl } from '../services/s3.service';
import { deactivateOtherClientAssignments } from './employee.controller';
import { sendClientOnboardingEmail } from '../services/email.service';

// Helper function to refresh presigned URL for profile photos
const refreshProfilePhotoUrl = async (photoUrl: string | null | undefined): Promise<string | null> => {
  if (!photoUrl) return null;
  const key = getKeyFromUrl(photoUrl);
  if (!key) return photoUrl;
  const freshUrl = await getPresignedUrl(key);
  return freshUrl || photoUrl;
};

// Get all clients with pagination and filters
export const getClients = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '10',
      search = '',
      status = '',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { companyName: { contains: search as string, mode: 'insensitive' } },
        { contactPerson: { contains: search as string, mode: 'insensitive' } },
        { contacts: { some: { name: { contains: search as string, mode: 'insensitive' } } } },
        { user: { email: { contains: search as string, mode: 'insensitive' } } },
      ];
    }

    if (status) {
      where.user = { ...where.user, status: status as string };
    }

    // Get clients with relations
    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              status: true,
              lastLoginAt: true,
              createdAt: true,
            },
          },
          contacts: true,
          employees: {
            where: { isActive: true },
            include: {
              employee: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  profilePhoto: true,
                  user: {
                    select: {
                      status: true,
                    },
                  },
                },
              },
            },
          },
          clientPolicies: true,
          groups: {
            include: {
              group: {
                select: { id: true, name: true },
              },
            },
          },
          _count: {
            select: {
              employees: {
                where: { isActive: true },
              },
              groups: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.client.count({ where }),
    ]);

    // Transform data to include employee counts and refresh presigned URLs
    const clientsWithStats = await Promise.all(
      clients.map(async (client) => {
        const activeEmployees = client.employees.filter(
          (ce) => ce.employee.user.status === 'ACTIVE'
        ).length;

        // Refresh presigned URLs for employee profile photos
        const employeesWithFreshUrls = await Promise.all(
          client.employees.map(async (ce) => ({
            ...ce,
            employee: {
              ...ce.employee,
              profilePhoto: await refreshProfilePhotoUrl(ce.employee.profilePhoto),
            },
          }))
        );

        // Refresh presigned URL for client logo
        const freshLogoUrl = await refreshProfilePhotoUrl(client.logoUrl);

        return {
          ...client,
          logoUrl: freshLogoUrl,
          employees: employeesWithFreshUrls,
          employeeCount: client._count.employees,
          activeEmployeeCount: activeEmployees,
          groupCount: client._count.groups,
        };
      })
    );

    res.json({
      success: true,
      data: {
        clients: clientsWithStats,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch clients',
    });
  }
};

// Get single client by ID
export const getClient = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
        contacts: true,
        employees: {
          where: { isActive: true },
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
        },
        clientPolicies: true,
        agreement: true,
      },
    });

    if (!client) {
      res.status(404).json({
        success: false,
        error: 'Client not found',
      });
      return;
    }

    // Refresh presigned URLs for employee profile photos
    const employeesWithFreshUrls = await Promise.all(
      client.employees.map(async (ce) => ({
        ...ce,
        employee: {
          ...ce.employee,
          profilePhoto: await refreshProfilePhotoUrl(ce.employee.profilePhoto),
        },
      }))
    );

    // Refresh presigned URL for client logo
    const freshLogoUrl = await refreshProfilePhotoUrl(client.logoUrl);

    const clientWithFreshUrls = {
      ...client,
      logoUrl: freshLogoUrl,
      employees: employeesWithFreshUrls,
    };

    res.json({
      success: true,
      data: clientWithFreshUrls,
    });
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch client',
    });
  }
};

// Download agreement PDF for a client (admin use)
export const downloadAgreementPdf = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const client = await prisma.client.findUnique({
      where: { id },
      select: { companyName: true, agreementType: true, agreement: { select: { signedPdfData: true } } },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    const safeName = client.companyName.replace(/[^a-zA-Z0-9_-]/g, '_');

    // If a signed PDF exists, serve it
    if (client.agreement?.signedPdfData) {
      const pdfBuffer = Buffer.from(client.agreement.signedPdfData, 'base64');
      const downloadName = `${safeName}_Signed_Agreement.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
      res.setHeader('Content-Length', pdfBuffer.length.toString());
      res.send(pdfBuffer);
      return;
    }

    // Fall back to template PDF
    const fileName =
      client.agreementType === 'MONTHLY'
        ? 'monthly-agreement.pdf'
        : 'weekly-agreement.pdf';

    const filePath = path.join(__dirname, '../../public/agreements', fileName);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, error: 'Agreement PDF not found' });
      return;
    }

    const downloadName = `${safeName}_Service_Agreement.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error('Download agreement PDF error:', error);
    res.status(500).json({ success: false, error: 'Failed to download agreement PDF' });
  }
};

// Create new client
export const createClient = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      email,
      companyName,
      contactPerson,
      contacts,
      phone,
      address,
      timezone,
      groupId,
      agreementType,
      // Policy fields
      allowPaidLeave,
      paidLeaveEntitlementType,
      annualPaidLeaveDays,
      allowUnpaidLeave,
      requireTwoWeeksNotice,
      requireTwoWeeksNoticePaidLeave,
      requireTwoWeeksNoticeUnpaidLeave,
      allowPaidHolidays,
      paidHolidayType,
      numberOfPaidHolidays,
      allowUnpaidHolidays,
      unpaidHolidayType,
      numberOfUnpaidHolidays,
      allowOvertime,
      overtimeRequiresApproval,
      autoApproveTimesheets,
      autoApproveMinutes,
    } = req.body;

    // Derive primary contact name from contacts array or legacy contactPerson field
    const contactsList = Array.isArray(contacts) && contacts.length > 0 ? contacts : (contactPerson ? [{ name: contactPerson }] : []);
    const primaryContactName = contactsList[0]?.name || '';

    // Validate required fields
    if (!email || !companyName || !primaryContactName) {
      res.status(400).json({
        success: false,
        error: 'Email, company name, and at least one contact person are required',
      });
      return;
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(400).json({
        success: false,
        error: 'Email already exists',
      });
      return;
    }

    // Auto-generate password (TODO: use stronger generation in production)
    const password = 'Welcome@123';
    const hashedPassword = await hashPassword(password);

    // Create user, client, and policies in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Find the CLIENT dynamic role
      const clientRole = await tx.role.findUnique({ where: { name: 'CLIENT' } });

      // Create user
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          role: 'CLIENT',
          roleId: clientRole?.id,
          status: 'ACTIVE',
        },
      });

      // Determine agreement type
      const clientAgreementType = agreementType || 'WEEKLY';

      // Create client
      const client = await tx.client.create({
        data: {
          userId: user.id,
          companyName,
          contactPerson: primaryContactName,
          phone,
          address,
          timezone: timezone || 'UTC',
          onboardingStatus: 'PENDING_AGREEMENT',
          agreementType: clientAgreementType,
        },
      });

      // Create contact person records
      for (let i = 0; i < contactsList.length; i++) {
        const c = contactsList[i];
        await tx.clientContact.create({
          data: {
            clientId: client.id,
            name: c.name?.trim(),
            position: c.position?.trim() || null,
            phone: c.phone?.trim() || null,
            email: c.email?.trim() || null,
            isPrimary: i === 0,
          },
        });
      }

      // Create client agreement record (unsigned)
      await tx.clientAgreement.create({
        data: {
          clientId: client.id,
          agreementType: clientAgreementType,
        },
      });

      // Create client policy
      await tx.clientPolicy.create({
        data: {
          clientId: client.id,
          allowPaidLeave: allowPaidLeave ?? false,
          paidLeaveEntitlementType,
          annualPaidLeaveDays: parseInt(annualPaidLeaveDays, 10) || 0,
          allowUnpaidLeave: allowUnpaidLeave ?? true,
          requireTwoWeeksNotice: requireTwoWeeksNotice ?? true,
          requireTwoWeeksNoticePaidLeave: requireTwoWeeksNoticePaidLeave ?? true,
          requireTwoWeeksNoticeUnpaidLeave: requireTwoWeeksNoticeUnpaidLeave ?? true,
          allowPaidHolidays: allowPaidHolidays ?? false,
          paidHolidayType: paidHolidayType || 'federal',
          numberOfPaidHolidays: parseInt(numberOfPaidHolidays, 10) || 0,
          allowUnpaidHolidays: allowUnpaidHolidays ?? false,
          unpaidHolidayType: unpaidHolidayType || 'federal',
          numberOfUnpaidHolidays: parseInt(numberOfUnpaidHolidays, 10) || 0,
          allowOvertime: allowOvertime ?? true,
          overtimeRequiresApproval: overtimeRequiresApproval ?? true,
          autoApproveTimesheets: autoApproveTimesheets ?? false,
          autoApproveMinutes: autoApproveMinutes ? parseInt(autoApproveMinutes, 10) : 1440,
        },
      });

      // Find or create the "Default" group
      let defaultGroup = await tx.group.findFirst({
        where: { name: 'Default' },
      });
      if (!defaultGroup) {
        defaultGroup = await tx.group.create({
          data: { name: 'Default', description: 'Default group assigned to all clients' },
        });
      }

      // Assign the Default group to this client
      await tx.clientGroup.create({
        data: { clientId: client.id, groupId: defaultGroup.id },
      });

      // If additional groupId provided (and it's not the Default group), assign it too
      if (groupId && groupId !== defaultGroup.id) {
        // Create the ClientGroup link
        await tx.clientGroup.upsert({
          where: { clientId_groupId: { clientId: client.id, groupId } },
          create: { clientId: client.id, groupId },
          update: {},
        });

        // Assign group employees to this client (1-client-per-employee)
        const groupEmployees = await tx.groupEmployee.findMany({
          where: { groupId },
          select: { employeeId: true },
        });

        for (const ge of groupEmployees) {
          await deactivateOtherClientAssignments(ge.employeeId, client.id, tx);
          await tx.clientEmployee.upsert({
            where: { clientId_employeeId: { clientId: client.id, employeeId: ge.employeeId } },
            create: { clientId: client.id, employeeId: ge.employeeId, isActive: true },
            update: { isActive: true },
          });
        }
      }

      // Fetch complete client data
      const completeClient = await tx.client.findUnique({
        where: { id: client.id },
        include: {
          contacts: true,
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              status: true,
            },
          },
          clientPolicies: true,
        },
      });

      return completeClient;
    });

    // Send onboarding email (non-blocking)
    sendClientOnboardingEmail(
      email,
      companyName,
      primaryContactName,
      password, // plain-text password before hashing
      agreementType || 'WEEKLY'
    ).catch((err) => console.error('Failed to send onboarding email:', err));

    res.status(201).json({
      success: true,
      message: 'Client created successfully',
      data: result,
    });
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create client',
    });
  }
};

// Update client
export const updateClient = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const {
      email,
      companyName,
      contactPerson,
      contacts,
      phone,
      address,
      timezone,
      status,
      groupId,
      // Policy fields
      allowPaidLeave,
      paidLeaveEntitlementType,
      annualPaidLeaveDays,
      allowUnpaidLeave,
      requireTwoWeeksNotice,
      requireTwoWeeksNoticePaidLeave,
      requireTwoWeeksNoticeUnpaidLeave,
      allowOvertime,
      overtimeRequiresApproval,
      autoApproveTimesheets,
      autoApproveMinutes,
      // Rate fields
      defaultHourlyRate,
      defaultOvertimeRate,
      currency,
    } = req.body;

    // Check if client exists
    const existingClient = await prisma.client.findUnique({
      where: { id },
      include: { user: true, clientPolicies: true },
    });

    if (!existingClient) {
      res.status(404).json({
        success: false,
        error: 'Client not found',
      });
      return;
    }

    // If email is being changed, check if it's already taken
    if (email && email !== existingClient.user.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email },
      });

      if (emailExists) {
        res.status(400).json({
          success: false,
          error: 'Email already exists',
        });
        return;
      }
    }

    // Update in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update user if email or status changed
      if (email || status) {
        await tx.user.update({
          where: { id: existingClient.userId },
          data: {
            ...(email && { email }),
            ...(status && { status }),
          },
        });
      }

      // Determine primary contact name from contacts array
      const contactsList = Array.isArray(contacts) ? contacts : null;
      const updatedContactPerson = contactsList && contactsList.length > 0
        ? contactsList[0].name
        : contactPerson;

      // Update client
      const client = await tx.client.update({
        where: { id },
        data: {
          ...(companyName && { companyName }),
          ...(updatedContactPerson && { contactPerson: updatedContactPerson }),
          ...(phone !== undefined && { phone }),
          ...(address !== undefined && { address }),
          ...(timezone && { timezone }),
        },
      });

      // Update contacts if provided
      if (contactsList) {
        // Delete existing contacts and recreate
        await tx.clientContact.deleteMany({ where: { clientId: id } });
        for (let i = 0; i < contactsList.length; i++) {
          const c = contactsList[i];
          if (c.name?.trim()) {
            await tx.clientContact.create({
              data: {
                clientId: id,
                name: c.name.trim(),
                position: c.position?.trim() || null,
                phone: c.phone?.trim() || null,
                email: c.email?.trim() || null,
                isPrimary: i === 0,
              },
            });
          }
        }
      }

      // Update or create policy
      if (existingClient.clientPolicies) {
        await tx.clientPolicy.update({
          where: { clientId: id },
          data: {
            ...(allowPaidLeave !== undefined && { allowPaidLeave }),
            ...(paidLeaveEntitlementType !== undefined && { paidLeaveEntitlementType }),
            ...(annualPaidLeaveDays !== undefined && { annualPaidLeaveDays: parseInt(annualPaidLeaveDays, 10) || 0 }),
            ...(allowUnpaidLeave !== undefined && { allowUnpaidLeave }),
            ...(requireTwoWeeksNotice !== undefined && { requireTwoWeeksNotice }),
            ...(requireTwoWeeksNoticePaidLeave !== undefined && { requireTwoWeeksNoticePaidLeave }),
            ...(requireTwoWeeksNoticeUnpaidLeave !== undefined && { requireTwoWeeksNoticeUnpaidLeave }),
            ...(allowOvertime !== undefined && { allowOvertime }),
            ...(overtimeRequiresApproval !== undefined && { overtimeRequiresApproval }),
            ...(autoApproveTimesheets !== undefined && { autoApproveTimesheets }),
            ...(autoApproveMinutes !== undefined && { autoApproveMinutes: parseInt(autoApproveMinutes, 10) || 1440 }),
            ...(defaultHourlyRate !== undefined && { defaultHourlyRate: parseFloat(defaultHourlyRate) || 0 }),
            ...(defaultOvertimeRate !== undefined && { defaultOvertimeRate: parseFloat(defaultOvertimeRate) || 0 }),
            ...(currency !== undefined && { currency }),
          },
        });
      } else {
        await tx.clientPolicy.create({
          data: {
            clientId: id,
            allowPaidLeave: allowPaidLeave ?? false,
            paidLeaveEntitlementType,
            annualPaidLeaveDays: parseInt(annualPaidLeaveDays, 10) || 0,
            allowUnpaidLeave: allowUnpaidLeave ?? true,
            requireTwoWeeksNotice: requireTwoWeeksNotice ?? true,
            requireTwoWeeksNoticePaidLeave: requireTwoWeeksNoticePaidLeave ?? true,
            requireTwoWeeksNoticeUnpaidLeave: requireTwoWeeksNoticeUnpaidLeave ?? true,
            allowOvertime: allowOvertime ?? true,
            overtimeRequiresApproval: overtimeRequiresApproval ?? true,
            autoApproveTimesheets: autoApproveTimesheets ?? false,
            autoApproveMinutes: autoApproveMinutes ? parseInt(autoApproveMinutes, 10) : 1440,
            defaultHourlyRate: parseFloat(defaultHourlyRate) || 0,
            defaultOvertimeRate: parseFloat(defaultOvertimeRate) || 0,
            currency: currency ?? 'USD',
          },
        });
      }

      // If groupId provided, assign all group employees to this client (1-client-per-employee)
      if (groupId) {
        const groupEmployees = await tx.groupEmployee.findMany({
          where: { groupId },
          select: { employeeId: true },
        });

        for (const ge of groupEmployees) {
          await deactivateOtherClientAssignments(ge.employeeId, id, tx);

          const existing = await tx.clientEmployee.findUnique({
            where: {
              clientId_employeeId: {
                clientId: id,
                employeeId: ge.employeeId,
              },
            },
          });

          if (existing) {
            if (!existing.isActive) {
              await tx.clientEmployee.update({
                where: { id: existing.id },
                data: { isActive: true },
              });
            }
          } else {
            await tx.clientEmployee.create({
              data: {
                clientId: id,
                employeeId: ge.employeeId,
                isActive: true,
              },
            });
          }
        }
      }

      // Fetch complete client data
      const completeClient = await tx.client.findUnique({
        where: { id },
        include: {
          contacts: true,
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              status: true,
            },
          },
          clientPolicies: true,
          _count: {
            select: {
              employees: {
                where: { isActive: true },
              },
            },
          },
        },
      });

      return completeClient;
    });

    res.json({
      success: true,
      message: 'Client updated successfully',
      data: result,
    });
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update client',
    });
  }
};

// Delete client (soft delete by setting status to INACTIVE)
export const deleteClient = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const client = await prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      res.status(404).json({
        success: false,
        error: 'Client not found',
      });
      return;
    }

    // Soft delete by setting user status to INACTIVE
    await prisma.user.update({
      where: { id: client.userId },
      data: { status: 'INACTIVE' },
    });

    // Deactivate all employee assignments
    await prisma.clientEmployee.updateMany({
      where: { clientId: id },
      data: { isActive: false },
    });

    res.json({
      success: true,
      message: 'Client deleted successfully',
    });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete client',
    });
  }
};

// Get client's employees
export const getClientEmployees = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const employees = await prisma.clientEmployee.findMany({
      where: {
        clientId: id,
        isActive: true,
      },
      include: {
        employee: {
          include: {
            user: {
              select: {
                email: true,
                status: true,
              },
            },
            schedules: {
              where: { isActive: true },
            },
            groupAssignments: {
              include: {
                group: {
                  select: {
                    id: true,
                    name: true,
                    billingRate: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Fetch client-group billing rates for this client
    const clientGroupRecords = await prisma.clientGroup.findMany({
      where: { clientId: id },
      select: { groupId: true, billingRate: true },
    });
    const clientGroupRateMap = new Map(
      clientGroupRecords.map((cg) => [cg.groupId, cg.billingRate ? Number(cg.billingRate) : null])
    );

    // Refresh presigned URLs for employee profile photos
    // Also include assignment-level rate overrides and convert Decimal fields
    const employeesWithFreshUrls = await Promise.all(
      employees.map(async (ce) => {
        // Look up client-specific group billing rate
        const groupAssignment = ce.employee.groupAssignments?.[0];
        const clientGroupBillingRate = groupAssignment
          ? clientGroupRateMap.get(groupAssignment.groupId) ?? null
          : null;

        return {
          ...ce.employee,
          profilePhoto: await refreshProfilePhotoUrl(ce.employee.profilePhoto),
          billingRate: ce.employee.billingRate ? Number(ce.employee.billingRate) : null,
          payableRate: ce.employee.payableRate ? Number(ce.employee.payableRate) : null,
          assignmentHourlyRate: ce.hourlyRate ? Number(ce.hourlyRate) : null,
          assignmentOvertimeRate: ce.overtimeRate ? Number(ce.overtimeRate) : null,
          clientGroupBillingRate,
          groupAssignments: ce.employee.groupAssignments?.map((ga: any) => ({
            ...ga,
            group: {
              ...ga.group,
              billingRate: ga.group?.billingRate ? Number(ga.group.billingRate) : null,
            },
          })) || [],
        };
      })
    );

    res.json({
      success: true,
      data: employeesWithFreshUrls,
    });
  } catch (error) {
    console.error('Get client employees error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch client employees',
    });
  }
};

// Assign multiple employees to client
export const assignEmployees = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { employeeIds } = req.body;

    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Employee IDs array is required',
      });
      return;
    }

    // Check if client exists
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) {
      res.status(404).json({
        success: false,
        error: 'Client not found',
      });
      return;
    }

    // Create or update assignments (1-client-per-employee: deactivate other client assignments)
    for (const employeeId of employeeIds) {
      await deactivateOtherClientAssignments(employeeId, id);

      const existingAssignment = await prisma.clientEmployee.findUnique({
        where: {
          clientId_employeeId: {
            clientId: id,
            employeeId,
          },
        },
      });

      if (existingAssignment) {
        if (!existingAssignment.isActive) {
          await prisma.clientEmployee.update({
            where: { id: existingAssignment.id },
            data: { isActive: true },
          });
        }
      } else {
        await prisma.clientEmployee.create({
          data: {
            clientId: id,
            employeeId,
            isActive: true,
          },
        });
      }
    }

    res.json({
      success: true,
      message: 'Employees assigned successfully',
    });
  } catch (error) {
    console.error('Assign employees error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign employees',
    });
  }
};

// Remove employee from client
export const removeEmployee = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const employeeId = req.params.employeeId as string;

    await prisma.clientEmployee.updateMany({
      where: {
        clientId: id,
        employeeId,
      },
      data: { isActive: false },
    });

    res.json({
      success: true,
      message: 'Employee removed from client successfully',
    });
  } catch (error) {
    console.error('Remove employee error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove employee',
    });
  }
};

// Update employee rate for a client
export const updateEmployeeRate = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string; // client ID
    const employeeId = req.params.employeeId as string;
    const { hourlyRate, overtimeRate } = req.body;

    // Find the client-employee assignment
    const assignment = await prisma.clientEmployee.findFirst({
      where: {
        clientId: id,
        employeeId,
        isActive: true,
      },
      include: {
        employee: {
          include: {
            user: {
              select: { email: true },
            },
          },
        },
      },
    });

    if (!assignment) {
      res.status(404).json({
        success: false,
        error: 'Employee assignment not found',
      });
      return;
    }

    // Update the rate
    await prisma.clientEmployee.update({
      where: { id: assignment.id },
      data: {
        hourlyRate: hourlyRate !== undefined && hourlyRate !== '' ? parseFloat(hourlyRate) : null,
        overtimeRate: overtimeRate !== undefined && overtimeRate !== '' ? parseFloat(overtimeRate) : null,
      },
    });

    res.json({
      success: true,
      message: 'Employee rate updated successfully',
    });
  } catch (error) {
    console.error('Update employee rate error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update employee rate',
    });
  }
};

// Get employee rate for a client
export const getEmployeeRate = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string; // client ID
    const employeeId = req.params.employeeId as string;

    // Find the client-employee assignment
    const assignment = await prisma.clientEmployee.findFirst({
      where: {
        clientId: id,
        employeeId,
        isActive: true,
      },
      include: {
        employee: {
          include: {
            user: {
              select: { email: true },
            },
            groupAssignments: {
              include: {
                group: {
                  select: {
                    id: true,
                    name: true,
                    billingRate: true,
                  },
                },
              },
            },
          },
        },
        client: {
          include: {
            clientPolicies: true,
          },
        },
      },
    });

    if (!assignment) {
      res.status(404).json({
        success: false,
        error: 'Employee assignment not found',
      });
      return;
    }

    // Get employee billing rate and group billing rate for hierarchy display
    const employeeBillingRate = assignment.employee.billingRate
      ? Number(assignment.employee.billingRate)
      : null;
    const groupAssignment = assignment.employee.groupAssignments?.[0];
    const groupBillingRate = groupAssignment?.group?.billingRate
      ? Number(groupAssignment.group.billingRate)
      : null;

    // Get client-specific group billing rate
    let clientGroupBillingRate: number | null = null;
    if (groupAssignment?.groupId) {
      const clientGroup = await prisma.clientGroup.findUnique({
        where: { clientId_groupId: { clientId: id, groupId: groupAssignment.groupId } },
        select: { billingRate: true },
      });
      clientGroupBillingRate = clientGroup?.billingRate ? Number(clientGroup.billingRate) : null;
    }

    res.json({
      success: true,
      data: {
        employeeId: assignment.employeeId,
        employeeName: `${assignment.employee.firstName} ${assignment.employee.lastName}`,
        employeeEmail: assignment.employee.user?.email,
        hourlyRate: assignment.hourlyRate ? Number(assignment.hourlyRate) : null,
        overtimeRate: assignment.overtimeRate ? Number(assignment.overtimeRate) : null,
        employeeBillingRate,
        clientGroupBillingRate,
        groupBillingRate,
        groupName: groupAssignment?.group?.name || null,
        defaultHourlyRate: assignment.client.clientPolicies?.defaultHourlyRate
          ? Number(assignment.client.clientPolicies.defaultHourlyRate)
          : 0,
        defaultOvertimeRate: assignment.client.clientPolicies?.defaultOvertimeRate
          ? Number(assignment.client.clientPolicies.defaultOvertimeRate)
          : 0,
      },
    });
  } catch (error) {
    console.error('Get employee rate error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get employee rate',
    });
  }
};

// Get client statistics
export const getClientStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const [total, active, totalEmployees, activeEmployees] = await Promise.all([
      prisma.client.count(),
      prisma.client.count({
        where: { user: { status: 'ACTIVE' } },
      }),
      prisma.clientEmployee.count({
        where: { isActive: true },
      }),
      prisma.clientEmployee.count({
        where: {
          isActive: true,
          employee: { user: { status: 'ACTIVE' } },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalClients: total,
        activeClients: active,
        totalAssignedEmployees: totalEmployees,
        activeAssignedEmployees: activeEmployees,
      },
    });
  } catch (error) {
    console.error('Get client stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch client statistics',
    });
  }
};
