import { Response } from "express";
import prisma from "../config/database";
import { AuthenticatedRequest } from "../types";
import { TaskActivityAction, NotificationType } from "@prisma/client";
import { createNotification } from "./notification.controller";

// Helper: resolve user info (name, avatar, role) from userId
const resolveUserInfo = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      employee: {
        select: { firstName: true, lastName: true, profilePhoto: true },
      },
      client: { select: { companyName: true, logoUrl: true } },
      admin: { select: { firstName: true, lastName: true } },
    },
  });

  let authorName = user?.email || "Unknown";
  let authorAvatar: string | null = null;
  if (user?.employee) {
    authorName = `${user.employee.firstName} ${user.employee.lastName}`;
    authorAvatar = user.employee.profilePhoto;
  } else if (user?.client) {
    authorName = user.client.companyName;
    authorAvatar = user.client.logoUrl;
  } else if (user?.admin) {
    authorName = `${user.admin.firstName} ${user.admin.lastName}`;
  }

  return {
    authorName,
    authorAvatar,
    authorRole: user?.role || "UNKNOWN",
  };
};

// Helper: create task activity log (fire and forget)
const createTaskActivity = (
  taskId: string,
  userId: string,
  action: TaskActivityAction,
  oldValue?: string | null,
  newValue?: string | null,
  metadata?: any,
) => {
  prisma.taskActivity
    .create({
      data: {
        taskId,
        userId,
        action,
        oldValue: oldValue || null,
        newValue: newValue || null,
        metadata: metadata || null,
      },
    })
    .catch((err: any) => console.error("Failed to log task activity:", err));
};

// Status labels for human-readable notification messages
const STATUS_LABELS: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
};

// Helper: look up the userId for the "other party" on a task
const getTaskRecipientUserId = async (
  task: { clientId: string | null; employeeId: string | null },
  senderRole: string
): Promise<string | null> => {
  try {
    if (senderRole === "CLIENT" && task.employeeId) {
      const employee = await prisma.employee.findUnique({
        where: { id: task.employeeId },
        select: { userId: true },
      });
      return employee?.userId || null;
    } else if (senderRole === "EMPLOYEE" && task.clientId) {
      const client = await prisma.client.findUnique({
        where: { id: task.clientId },
        select: { userId: true },
      });
      return client?.userId || null;
    }
    return null;
  } catch (err) {
    console.error("Failed to resolve task recipient:", err);
    return null;
  }
};

// Get tasks (scoped by role)
export const getTasks = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const {
      page = "1",
      limit = "20",
      search = "",
      status = "",
      priority = "",
      employeeId = "",
      clientId = "",
      isPersonal,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    // Role-based scoping
    const userRole = req.user!.role;
    if (userRole === "CLIENT") {
      const client = await prisma.client.findUnique({
        where: { userId: req.user!.userId },
      });
      if (!client) {
        res.status(404).json({ success: false, error: "Client not found" });
        return;
      }
      where.clientId = client.id;
      where.isPersonal = false;
    } else if (userRole === "EMPLOYEE") {
      const employee = await prisma.employee.findUnique({
        where: { userId: req.user!.userId },
      });
      if (!employee) {
        res.status(404).json({ success: false, error: "Employee not found" });
        return;
      }
      where.employeeId = employee.id;
    } else {
      // Admin roles: see all non-personal tasks
      where.isPersonal = false;
    }

    // Filters
    if (status) {
      where.status = status as string;
    }
    if (priority) {
      where.priority = priority as string;
    }
    if (employeeId) {
      where.employeeId = employeeId as string;
    }
    if (clientId && userRole !== "CLIENT") {
      where.clientId = clientId as string;
    }
    if (isPersonal !== undefined && isPersonal !== "") {
      where.isPersonal = isPersonal === "true";
    }
    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: "insensitive" } },
        { description: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          client: {
            select: { id: true, companyName: true },
          },
          assignee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePhoto: true,
            },
          },
          createdBy: {
            select: { id: true, email: true },
          },
          _count: {
            select: { comments: true, activities: true },
          },
        },
        orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
      }),
      prisma.task.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        tasks,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error("Get tasks error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch tasks" });
  }
};

// Get single task
export const getTask = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        client: {
          select: { id: true, companyName: true },
        },
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhoto: true,
          },
        },
        createdBy: {
          select: { id: true, email: true },
        },
        comments: {
          orderBy: { createdAt: "asc" },
        },
        _count: {
          select: { comments: true, activities: true },
        },
      },
    });

    if (!task) {
      res.status(404).json({ success: false, error: "Task not found" });
      return;
    }

    // Check access
    const userRole = req.user!.role;
    if (userRole === "CLIENT") {
      const client = await prisma.client.findUnique({
        where: { userId: req.user!.userId },
      });
      if (!client || task.clientId !== client.id) {
        res.status(403).json({ success: false, error: "Access denied" });
        return;
      }
    } else if (userRole === "EMPLOYEE") {
      const employee = await prisma.employee.findUnique({
        where: { userId: req.user!.userId },
      });
      if (!employee || task.employeeId !== employee.id) {
        res.status(403).json({ success: false, error: "Access denied" });
        return;
      }
    }

    // Enrich comments with user info
    const userIds = [...new Set(task.comments.map((c) => c.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        email: true,
        role: true,
        employee: {
          select: { firstName: true, lastName: true, profilePhoto: true },
        },
        client: { select: { companyName: true, logoUrl: true } },
        admin: { select: { firstName: true, lastName: true } },
      },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const commentsWithUser = task.comments.map((comment) => {
      const user = userMap.get(comment.userId);
      let authorName = user?.email || "Unknown";
      let authorAvatar: string | null = null;
      if (user?.employee) {
        authorName = `${user.employee.firstName} ${user.employee.lastName}`;
        authorAvatar = user.employee.profilePhoto;
      } else if (user?.client) {
        authorName = user.client.companyName;
        authorAvatar = user.client.logoUrl;
      } else if (user?.admin) {
        authorName = `${user.admin.firstName} ${user.admin.lastName}`;
      }
      return {
        ...comment,
        authorName,
        authorAvatar,
        authorRole: user?.role || "UNKNOWN",
      };
    });

    res.json({
      success: true,
      data: { ...task, comments: commentsWithUser },
    });
  } catch (error) {
    console.error("Get task error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch task" });
  }
};

// Create task (CLIENT + EMPLOYEE)
export const createTask = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { title, description, priority, dueDate, employeeId } = req.body;
    const userRole = req.user!.role;

    if (!title) {
      res.status(400).json({ success: false, error: "Title is required" });
      return;
    }

    let taskData: any = {
      title,
      description: description || null,
      priority: priority || "MEDIUM",
      dueDate: dueDate ? new Date(dueDate) : null,
      createdById: req.user!.userId,
    };

    if (userRole === "CLIENT") {
      const client = await prisma.client.findUnique({
        where: { userId: req.user!.userId },
      });
      if (!client) {
        res.status(404).json({ success: false, error: "Client not found" });
        return;
      }

      // Validate employee belongs to this client
      if (employeeId) {
        const assignment = await prisma.clientEmployee.findFirst({
          where: { clientId: client.id, employeeId, isActive: true },
        });
        if (!assignment) {
          res.status(400).json({
            success: false,
            error: "Employee is not assigned to your organization",
          });
          return;
        }
      }

      taskData.clientId = client.id;
      taskData.employeeId = employeeId || null;
      taskData.isPersonal = false;
    } else if (userRole === "EMPLOYEE") {
      const employee = await prisma.employee.findUnique({
        where: { userId: req.user!.userId },
      });
      if (!employee) {
        res.status(404).json({ success: false, error: "Employee not found" });
        return;
      }
      taskData.clientId = null;
      taskData.employeeId = employee.id;
      taskData.isPersonal = true;
    } else {
      res.status(403).json({ success: false, error: "Access denied" });
      return;
    }

    const task = await prisma.task.create({
      data: taskData,
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhoto: true,
          },
        },
        client: {
          select: { id: true, companyName: true },
        },
        _count: {
          select: { comments: true, activities: true },
        },
      },
    });

    // Log activity: CREATED
    createTaskActivity(
      task.id,
      req.user!.userId,
      "CREATED",
      null,
      null,
      { title: task.title },
    );

    // Log activity: ASSIGNED + notify (only for client-assigned tasks)
    if (!task.isPersonal && employeeId && task.assignee) {
      createTaskActivity(
        task.id,
        req.user!.userId,
        "ASSIGNED",
        null,
        `${task.assignee.firstName} ${task.assignee.lastName}`,
        { employeeId },
      );

      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { userId: true },
      });
      if (employee && employee.userId !== req.user!.userId) {
        createNotification(
          employee.userId,
          NotificationType.TASK_ASSIGNED,
          "New Task Assigned",
          `You have been assigned a new task: ${task.title}`,
          { taskId: task.id },
          "/employee/tasks"
        ).catch((err) => console.error("Failed to send task notification:", err));
      }
    }

    res.status(201).json({
      success: true,
      message: "Task created successfully",
      data: task,
    });
  } catch (error) {
    console.error("Create task error:", error);
    res.status(500).json({ success: false, error: "Failed to create task" });
  }
};

// Update task (CLIENT + EMPLOYEE)
export const updateTask = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { title, description, priority, dueDate, employeeId, status } =
      req.body;

    const userRole = req.user!.role;

    const existing = await prisma.task.findUnique({
      where: { id },
      include: {
        assignee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: "Task not found" });
      return;
    }

    if (userRole === "CLIENT") {
      const client = await prisma.client.findUnique({
        where: { userId: req.user!.userId },
      });
      if (!client || existing.clientId !== client.id) {
        res.status(404).json({ success: false, error: "Task not found" });
        return;
      }

      // Validate employee if changing assignment
      if (employeeId !== undefined && employeeId !== null && employeeId !== "") {
        const assignment = await prisma.clientEmployee.findFirst({
          where: { clientId: client.id, employeeId, isActive: true },
        });
        if (!assignment) {
          res.status(400).json({
            success: false,
            error: "Employee is not assigned to your organization",
          });
          return;
        }
      }
    } else if (userRole === "EMPLOYEE") {
      const employee = await prisma.employee.findUnique({
        where: { userId: req.user!.userId },
      });
      if (!employee || existing.employeeId !== employee.id) {
        res.status(403).json({ success: false, error: "Access denied" });
        return;
      }
      // Employees cannot change task assignment on client-assigned tasks
      if (!existing.isPersonal && employeeId !== undefined) {
        res.status(403).json({
          success: false,
          error: "Employees cannot change task assignment",
        });
        return;
      }
    } else {
      res.status(403).json({ success: false, error: "Access denied" });
      return;
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (priority !== undefined) updateData.priority = priority;
    if (dueDate !== undefined)
      updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (employeeId !== undefined)
      updateData.employeeId = employeeId || null;
    if (status !== undefined) {
      updateData.status = status;
      if (status === "DONE") {
        updateData.completedAt = new Date();
      } else {
        updateData.completedAt = null;
      }
    }

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhoto: true,
          },
        },
        client: {
          select: { id: true, companyName: true },
        },
        _count: {
          select: { comments: true, activities: true },
        },
      },
    });

    // Log per-field activity changes
    const userId = req.user!.userId;

    if (title !== undefined && title !== existing.title) {
      createTaskActivity(id, userId, "TITLE_UPDATED", existing.title, title);
    }
    if (description !== undefined && description !== existing.description) {
      createTaskActivity(
        id,
        userId,
        "DESCRIPTION_UPDATED",
        existing.description || "",
        description || "",
      );
    }
    if (priority !== undefined && priority !== existing.priority) {
      createTaskActivity(
        id,
        userId,
        "PRIORITY_CHANGED",
        existing.priority,
        priority,
      );
    }
    if (dueDate !== undefined) {
      const oldDue = existing.dueDate
        ? existing.dueDate.toISOString().split("T")[0]
        : null;
      const newDue = dueDate || null;
      if (oldDue !== newDue) {
        createTaskActivity(
          id,
          userId,
          "DUE_DATE_CHANGED",
          oldDue,
          newDue,
        );
      }
    }
    if (status !== undefined && status !== existing.status) {
      createTaskActivity(
        id,
        userId,
        "STATUS_CHANGED",
        existing.status,
        status,
      );
    }
    if (employeeId !== undefined) {
      const oldEmpId = existing.employeeId;
      const newEmpId = employeeId || null;
      if (oldEmpId !== newEmpId) {
        if (oldEmpId && !newEmpId) {
          const oldName = existing.assignee
            ? `${existing.assignee.firstName} ${existing.assignee.lastName}`
            : oldEmpId;
          createTaskActivity(id, userId, "UNASSIGNED", oldName, null, {
            employeeId: oldEmpId,
          });
        } else if (newEmpId) {
          const newName = task.assignee
            ? `${task.assignee.firstName} ${task.assignee.lastName}`
            : newEmpId;
          const oldName = existing.assignee
            ? `${existing.assignee.firstName} ${existing.assignee.lastName}`
            : null;
          createTaskActivity(id, userId, "ASSIGNED", oldName, newName, {
            employeeId: newEmpId,
          });

          // Notify newly assigned employee
          const newEmployee = await prisma.employee.findUnique({
            where: { id: newEmpId },
            select: { userId: true },
          });
          if (newEmployee && newEmployee.userId !== req.user!.userId) {
            createNotification(
              newEmployee.userId,
              NotificationType.TASK_ASSIGNED,
              "New Task Assigned",
              `You have been assigned a task: ${task.title}`,
              { taskId: id },
              "/employee/tasks"
            ).catch((err) => console.error("Failed to send task notification:", err));
          }
        }
      }
    }

    // Notify the other party about task updates (title, description, priority, dueDate, status changes)
    const hasOtherChanges =
      (title !== undefined && title !== existing.title) ||
      (description !== undefined && description !== existing.description) ||
      (priority !== undefined && priority !== existing.priority) ||
      (status !== undefined && status !== existing.status) ||
      (dueDate !== undefined && (existing.dueDate ? existing.dueDate.toISOString().split("T")[0] : null) !== (dueDate || null));

    if (hasOtherChanges && !existing.isPersonal) {
      const recipientUserId = await getTaskRecipientUserId(
        { clientId: existing.clientId, employeeId: existing.employeeId },
        userRole
      );
      if (recipientUserId && recipientUserId !== req.user!.userId) {
        const actionUrl = userRole === "EMPLOYEE" ? "/client/tasks" : "/employee/tasks";
        createNotification(
          recipientUserId,
          NotificationType.TASK_UPDATED,
          "Task Updated",
          `The task '${task.title}' has been updated`,
          { taskId: id },
          actionUrl
        ).catch((err) => console.error("Failed to send task notification:", err));
      }
    }

    res.json({
      success: true,
      message: "Task updated successfully",
      data: task,
    });
  } catch (error) {
    console.error("Update task error:", error);
    res.status(500).json({ success: false, error: "Failed to update task" });
  }
};

// Delete task (CLIENT + EMPLOYEE for personal tasks)
export const deleteTask = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userRole = req.user!.role;

    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: "Task not found" });
      return;
    }

    if (userRole === "CLIENT") {
      const client = await prisma.client.findUnique({
        where: { userId: req.user!.userId },
      });
      if (!client || existing.clientId !== client.id) {
        res.status(404).json({ success: false, error: "Task not found" });
        return;
      }
    } else if (userRole === "EMPLOYEE") {
      // Employees can only delete their own personal tasks
      if (!existing.isPersonal || existing.createdById !== req.user!.userId) {
        res.status(403).json({ success: false, error: "Access denied" });
        return;
      }
    } else {
      res.status(403).json({ success: false, error: "Access denied" });
      return;
    }

    await prisma.task.delete({ where: { id } });

    res.json({ success: true, message: "Task deleted successfully" });
  } catch (error) {
    console.error("Delete task error:", error);
    res.status(500).json({ success: false, error: "Failed to delete task" });
  }
};

// Update task status (EMPLOYEE + CLIENT)
export const updateTaskStatus = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;

    if (!status || !["TODO", "IN_PROGRESS", "DONE"].includes(status)) {
      res.status(400).json({
        success: false,
        error: "Invalid status. Must be TODO, IN_PROGRESS, or DONE",
      });
      return;
    }

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      res.status(404).json({ success: false, error: "Task not found" });
      return;
    }

    const userRole = req.user!.role;

    // Verify access
    if (userRole === "EMPLOYEE") {
      const employee = await prisma.employee.findUnique({
        where: { userId: req.user!.userId },
      });
      if (!employee || task.employeeId !== employee.id) {
        res.status(403).json({ success: false, error: "Access denied" });
        return;
      }
    } else if (userRole === "CLIENT") {
      const client = await prisma.client.findUnique({
        where: { userId: req.user!.userId },
      });
      if (!client || task.clientId !== client.id) {
        res.status(403).json({ success: false, error: "Access denied" });
        return;
      }
    } else {
      // Admin roles cannot update status
      res.status(403).json({
        success: false,
        error: "Admin roles have read-only access to tasks",
      });
      return;
    }

    const oldStatus = task.status;

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        status,
        completedAt: status === "DONE" ? new Date() : null,
      },
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhoto: true,
          },
        },
        client: {
          select: { id: true, companyName: true },
        },
        _count: {
          select: { comments: true, activities: true },
        },
      },
    });

    // Log activity
    if (oldStatus !== status) {
      createTaskActivity(id, req.user!.userId, "STATUS_CHANGED", oldStatus, status);

      // Notify the other party about status change (skip for personal tasks)
      const recipientUserId = !task.isPersonal ? await getTaskRecipientUserId(
        { clientId: task.clientId, employeeId: task.employeeId },
        userRole
      ) : null;
      if (recipientUserId && recipientUserId !== req.user!.userId) {
        const actionUrl = userRole === "EMPLOYEE" ? "/client/tasks" : "/employee/tasks";
        createNotification(
          recipientUserId,
          NotificationType.TASK_STATUS_CHANGED,
          "Task Status Changed",
          `Task '${updatedTask.title}' status changed from ${STATUS_LABELS[oldStatus] || oldStatus} to ${STATUS_LABELS[status] || status}`,
          { taskId: id, oldStatus, newStatus: status },
          actionUrl
        ).catch((err) => console.error("Failed to send task notification:", err));
      }
    }

    res.json({
      success: true,
      message: "Task status updated successfully",
      data: updatedTask,
    });
  } catch (error) {
    console.error("Update task status error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to update task status" });
  }
};

// Add comment to task
export const addTaskComment = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const taskId = req.params.id as string;
    const { message } = req.body;

    if (!message || !message.trim()) {
      res.status(400).json({ success: false, error: "Message is required" });
      return;
    }

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      res.status(404).json({ success: false, error: "Task not found" });
      return;
    }

    // Verify access
    const userRole = req.user!.role;
    if (userRole === "CLIENT") {
      const client = await prisma.client.findUnique({
        where: { userId: req.user!.userId },
      });
      if (!client || task.clientId !== client.id) {
        res.status(403).json({ success: false, error: "Access denied" });
        return;
      }
    } else if (userRole === "EMPLOYEE") {
      const employee = await prisma.employee.findUnique({
        where: { userId: req.user!.userId },
      });
      if (!employee || task.employeeId !== employee.id) {
        res.status(403).json({ success: false, error: "Access denied" });
        return;
      }
    }

    const comment = await prisma.taskComment.create({
      data: {
        taskId,
        userId: req.user!.userId,
        message: message.trim(),
      },
    });

    // Log activity
    createTaskActivity(taskId, req.user!.userId, "COMMENTED", null, null, {
      preview: message.trim().substring(0, 100),
    });

    // Get author info
    const info = await resolveUserInfo(req.user!.userId);

    // Notify the other party about the comment (skip for personal tasks)
    const recipientUserId = !task.isPersonal ? await getTaskRecipientUserId(
      { clientId: task.clientId, employeeId: task.employeeId },
      userRole
    ) : null;

    if (recipientUserId && recipientUserId !== req.user!.userId) {
      const truncatedMessage = message.trim().length > 80
        ? message.trim().substring(0, 80) + "..."
        : message.trim();
      const actionUrl = userRole === "EMPLOYEE" ? "/client/tasks" : "/employee/tasks";
      createNotification(
        recipientUserId,
        NotificationType.TASK_COMMENTED,
        "New Comment on Task",
        `${info.authorName} commented on '${task.title}': ${truncatedMessage}`,
        { taskId, commentId: comment.id },
        actionUrl
      ).catch((err) => console.error("Failed to send task notification:", err));
    }

    res.status(201).json({
      success: true,
      message: "Comment added successfully",
      data: {
        ...comment,
        ...info,
      },
    });
  } catch (error) {
    console.error("Add task comment error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to add comment" });
  }
};

// Get task comments
export const getTaskComments = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const taskId = req.params.id as string;

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      res.status(404).json({ success: false, error: "Task not found" });
      return;
    }

    // Verify access
    const userRole = req.user!.role;
    if (userRole === "CLIENT") {
      const client = await prisma.client.findUnique({
        where: { userId: req.user!.userId },
      });
      if (!client || task.clientId !== client.id) {
        res.status(403).json({ success: false, error: "Access denied" });
        return;
      }
    } else if (userRole === "EMPLOYEE") {
      const employee = await prisma.employee.findUnique({
        where: { userId: req.user!.userId },
      });
      if (!employee || task.employeeId !== employee.id) {
        res.status(403).json({ success: false, error: "Access denied" });
        return;
      }
    }

    const comments = await prisma.taskComment.findMany({
      where: { taskId },
      orderBy: { createdAt: "asc" },
    });

    // Enrich with user info
    const userIds = [...new Set(comments.map((c) => c.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        email: true,
        role: true,
        employee: {
          select: { firstName: true, lastName: true, profilePhoto: true },
        },
        client: { select: { companyName: true, logoUrl: true } },
        admin: { select: { firstName: true, lastName: true } },
      },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const enriched = comments.map((comment) => {
      const user = userMap.get(comment.userId);
      let authorName = user?.email || "Unknown";
      let authorAvatar: string | null = null;
      if (user?.employee) {
        authorName = `${user.employee.firstName} ${user.employee.lastName}`;
        authorAvatar = user.employee.profilePhoto;
      } else if (user?.client) {
        authorName = user.client.companyName;
        authorAvatar = user.client.logoUrl;
      } else if (user?.admin) {
        authorName = `${user.admin.firstName} ${user.admin.lastName}`;
      }
      return {
        ...comment,
        authorName,
        authorAvatar,
        authorRole: user?.role || "UNKNOWN",
      };
    });

    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error("Get task comments error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch comments" });
  }
};

// Get task activities
export const getTaskActivities = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const taskId = req.params.id as string;

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      res.status(404).json({ success: false, error: "Task not found" });
      return;
    }

    // Verify access
    const userRole = req.user!.role;
    if (userRole === "CLIENT") {
      const client = await prisma.client.findUnique({
        where: { userId: req.user!.userId },
      });
      if (!client || task.clientId !== client.id) {
        res.status(403).json({ success: false, error: "Access denied" });
        return;
      }
    } else if (userRole === "EMPLOYEE") {
      const employee = await prisma.employee.findUnique({
        where: { userId: req.user!.userId },
      });
      if (!employee || task.employeeId !== employee.id) {
        res.status(403).json({ success: false, error: "Access denied" });
        return;
      }
    }

    const activities = await prisma.taskActivity.findMany({
      where: { taskId },
      orderBy: { createdAt: "desc" },
    });

    // Enrich with user info
    const userIds = [...new Set(activities.map((a) => a.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        email: true,
        role: true,
        employee: {
          select: { firstName: true, lastName: true, profilePhoto: true },
        },
        client: { select: { companyName: true, logoUrl: true } },
        admin: { select: { firstName: true, lastName: true } },
      },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const enriched = activities.map((activity) => {
      const user = userMap.get(activity.userId);
      let authorName = user?.email || "Unknown";
      let authorAvatar: string | null = null;
      if (user?.employee) {
        authorName = `${user.employee.firstName} ${user.employee.lastName}`;
        authorAvatar = user.employee.profilePhoto;
      } else if (user?.client) {
        authorName = user.client.companyName;
        authorAvatar = user.client.logoUrl;
      } else if (user?.admin) {
        authorName = `${user.admin.firstName} ${user.admin.lastName}`;
      }
      return {
        ...activity,
        authorName,
        authorAvatar,
        authorRole: user?.role || "UNKNOWN",
      };
    });

    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error("Get task activities error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch activities" });
  }
};
