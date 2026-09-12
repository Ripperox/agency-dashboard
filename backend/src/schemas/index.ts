import { z } from 'zod'

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
})

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email(),
  password: z.string().min(6).max(100),
  role: z.enum(['ADMIN', 'PROJECT_MANAGER', 'DEVELOPER']),
})

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  role: z.enum(['ADMIN', 'PROJECT_MANAGER', 'DEVELOPER']).optional(),
})

export const clientSchema = z.object({
  name: z.string().trim().min(2).max(100),
  company: z.string().trim().max(100).optional().nullable(),
  email: z.email().optional().nullable(),
})

export const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  clientId: z.number().int().positive(),
})

export const updateProjectSchema = createProjectSchema.partial()

export const taskStatus = z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'])
export const taskPriority = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])

export const createTaskSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  assigneeId: z.number().int().positive().optional().nullable(),
  status: taskStatus.optional(),
  priority: taskPriority.optional(),
  dueDate: z.iso.datetime().optional().nullable(),
})

export const updateTaskSchema = createTaskSchema.partial()

export const updateStatusSchema = z.object({
  status: taskStatus,
})

const optionalInt = z.coerce.number().int().positive().optional()

export const taskFilterSchema = z.object({
  status: taskStatus.optional(),
  priority: taskPriority.optional(),
  dueFrom: z.iso.date().optional(),
  dueTo: z.iso.date().optional(),
  projectId: optionalInt,
  assigneeId: optionalInt,
  overdue: z.enum(['true', 'false']).optional(),
})

export const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  before: optionalInt,
  after: optionalInt,
  projectId: optionalInt,
})

export const usersQuerySchema = z.object({
  role: z.enum(['ADMIN', 'PROJECT_MANAGER', 'DEVELOPER']).optional(),
})

export const idParam = z.coerce.number().int().positive()
