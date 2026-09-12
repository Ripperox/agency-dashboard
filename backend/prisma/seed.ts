import { PrismaClient, TaskStatus, Priority } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const daysAgo = (n: number, hour = 10) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(hour, 0, 0, 0)
  return d
}
const daysFromNow = (n: number) => daysAgo(-n, 18)

type TaskSeed = {
  title: string
  description: string
  assignee: string
  status: TaskStatus
  priority: Priority
  due: Date
}

export async function seed() {
  // wipe everything so the seed can be re-run
  await prisma.notification.deleteMany()
  await prisma.activityLog.deleteMany()
  await prisma.task.deleteMany()
  await prisma.project.deleteMany()
  await prisma.client.deleteMany()
  await prisma.refreshToken.deleteMany()
  await prisma.user.deleteMany()

  const passwordHash = await bcrypt.hash('password123', 10)

  const users = {
    admin: await prisma.user.create({ data: { name: 'Anita Sharma', email: 'admin@agency.com', passwordHash, role: 'ADMIN' } }),
    rahul: await prisma.user.create({ data: { name: 'Rahul Mehta', email: 'rahul@agency.com', passwordHash, role: 'PROJECT_MANAGER' } }),
    priya: await prisma.user.create({ data: { name: 'Priya Nair', email: 'priya@agency.com', passwordHash, role: 'PROJECT_MANAGER' } }),
    ravi: await prisma.user.create({ data: { name: 'Ravi Kumar', email: 'ravi@agency.com', passwordHash, role: 'DEVELOPER' } }),
    sneha: await prisma.user.create({ data: { name: 'Sneha Iyer', email: 'sneha@agency.com', passwordHash, role: 'DEVELOPER' } }),
    arjun: await prisma.user.create({ data: { name: 'Arjun Patel', email: 'arjun@agency.com', passwordHash, role: 'DEVELOPER' } }),
    meera: await prisma.user.create({ data: { name: 'Meera Joshi', email: 'meera@agency.com', passwordHash, role: 'DEVELOPER' } }),
  }

  const clients = {
    bluefin: await prisma.client.create({ data: { name: 'Bluefin Retail', company: 'Bluefin Retail Pvt Ltd', email: 'ops@bluefin.example' } }),
    northwind: await prisma.client.create({ data: { name: 'Northwind Logistics', company: 'Northwind Logistics LLP', email: 'it@northwind.example' } }),
    kiwi: await prisma.client.create({ data: { name: 'Kiwi Health', company: 'Kiwi Health Technologies', email: 'product@kiwihealth.example' } }),
    orbit: await prisma.client.create({ data: { name: 'Orbit Media', company: 'Orbit Media Group', email: 'hello@orbitmedia.example' } }),
  }

  const projects = [
    {
      name: 'Bluefin storefront redesign',
      description: 'New storefront on Next.js with a headless checkout. Phase 1 is catalogue + cart.',
      client: clients.bluefin,
      owner: users.rahul,
      tasks: [
        { title: 'Set up product catalogue API', description: 'REST endpoints for categories, products and variants with pagination.', assignee: 'ravi', status: 'DONE', priority: 'HIGH', due: daysAgo(9) },
        { title: 'Cart service with Redis session store', description: 'Cart should survive refresh and login. TTL 7 days.', assignee: 'ravi', status: 'IN_REVIEW', priority: 'CRITICAL', due: daysFromNow(2) },
        { title: 'Checkout page UI', description: 'Address form, shipping options, order summary. Mobile first.', assignee: 'sneha', status: 'IN_PROGRESS', priority: 'HIGH', due: daysFromNow(4) },
        { title: 'Payment gateway integration (Razorpay)', description: 'Server side order creation + webhook verification.', assignee: 'sneha', status: 'TODO', priority: 'CRITICAL', due: daysFromNow(6) },
        { title: 'Image CDN migration', description: 'Move product images from S3 direct to Cloudfront with resizing.', assignee: 'arjun', status: 'IN_PROGRESS', priority: 'MEDIUM', due: daysAgo(3) },
        { title: 'Write load test for catalogue endpoints', description: 'k6 script, 500 vus, p95 under 300ms.', assignee: 'ravi', status: 'TODO', priority: 'LOW', due: daysFromNow(12) },
      ] as TaskSeed[],
    },
    {
      name: 'Northwind fleet tracker',
      description: 'Live map of delivery vehicles with route history and driver check-ins.',
      client: clients.northwind,
      owner: users.rahul,
      tasks: [
        { title: 'GPS ingestion websocket endpoint', description: 'Accept location pings from the driver app every 10s.', assignee: 'arjun', status: 'DONE', priority: 'CRITICAL', due: daysAgo(12) },
        { title: 'Route history table partitioning', description: 'Monthly partitions on the pings table, keep 6 months.', assignee: 'arjun', status: 'IN_PROGRESS', priority: 'HIGH', due: daysFromNow(3) },
        { title: 'Driver check-in screen', description: 'Start/end shift, vehicle selection, odometer photo.', assignee: 'meera', status: 'TODO', priority: 'MEDIUM', due: daysFromNow(8) },
        { title: 'Geofence alerts', description: 'Email dispatcher when a vehicle leaves its assigned zone.', assignee: 'meera', status: 'TODO', priority: 'HIGH', due: daysAgo(6) },
        { title: 'Admin map clustering', description: 'Cluster markers above 200 vehicles so the map stays usable.', assignee: 'ravi', status: 'IN_REVIEW', priority: 'MEDIUM', due: daysFromNow(1) },
      ] as TaskSeed[],
    },
    {
      name: 'Kiwi patient portal',
      description: 'Patient facing portal for appointments, reports and prescriptions.',
      client: clients.kiwi,
      owner: users.priya,
      tasks: [
        { title: 'Appointment booking flow', description: 'Pick doctor, slot, confirm. Handles double booking with a db constraint.', assignee: 'sneha', status: 'DONE', priority: 'HIGH', due: daysAgo(15) },
        { title: 'Lab report PDF viewer', description: 'Inline viewer with download. Reports come from the LIS as PDF.', assignee: 'meera', status: 'IN_REVIEW', priority: 'MEDIUM', due: daysFromNow(2) },
        { title: 'Prescription refill requests', description: 'Patient requests refill, doctor approves, pharmacy notified.', assignee: 'meera', status: 'IN_PROGRESS', priority: 'HIGH', due: daysFromNow(5) },
        { title: 'OTP login via SMS', description: 'MSG91 integration, 5 attempts then 15 min lockout.', assignee: 'ravi', status: 'DONE', priority: 'CRITICAL', due: daysAgo(20) },
        { title: 'Accessibility audit fixes', description: 'Fix the 14 issues from the axe report, mostly contrast and labels.', assignee: 'sneha', status: 'TODO', priority: 'LOW', due: daysFromNow(14) },
        { title: 'Consent form e-signature', description: 'Draw or type signature, store as PNG with a hash in the audit table.', assignee: 'arjun', status: 'TODO', priority: 'MEDIUM', due: daysFromNow(9) },
      ] as TaskSeed[],
    },
    {
      name: 'Orbit analytics dashboard',
      description: 'Internal dashboard for campaign performance across ad platforms.',
      client: clients.orbit,
      owner: users.priya,
      tasks: [
        { title: 'Meta Ads connector', description: 'Daily pull of campaign spend and conversions via Marketing API.', assignee: 'arjun', status: 'DONE', priority: 'HIGH', due: daysAgo(8) },
        { title: 'Google Ads connector', description: 'Same shape as the Meta one, reuse the sync worker.', assignee: 'arjun', status: 'IN_PROGRESS', priority: 'HIGH', due: daysFromNow(3) },
        { title: 'Campaign comparison chart', description: 'Line chart with date range picker, compare up to 5 campaigns.', assignee: 'sneha', status: 'TODO', priority: 'MEDIUM', due: daysFromNow(7) },
        { title: 'CSV export', description: 'Export whatever the current filter shows. Stream it, some exports are 200k rows.', assignee: 'meera', status: 'TODO', priority: 'LOW', due: daysFromNow(20) },
        { title: 'Fix timezone bug in daily rollup', description: 'Rollups run at UTC midnight so IST reports are off by a day.', assignee: 'ravi', status: 'IN_PROGRESS', priority: 'CRITICAL', due: daysFromNow(1) },
      ] as TaskSeed[],
    },
  ]

  const statusChain: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']
  let taskCount = 0
  let activityCount = 0

  for (const p of projects) {
    const project = await prisma.project.create({
      data: { name: p.name, description: p.description, clientId: p.client.id, ownerId: p.owner.id, createdAt: daysAgo(21) },
    })

    for (const [i, t] of p.tasks.entries()) {
      const assignee = users[t.assignee as keyof typeof users]
      const isOverdue = t.status !== 'DONE' && t.due < new Date()
      const createdAt = daysAgo(18 - i)

      const task = await prisma.task.create({
        data: {
          title: t.title,
          description: t.description,
          projectId: project.id,
          assigneeId: assignee.id,
          createdById: p.owner.id,
          status: t.status,
          priority: t.priority,
          dueDate: t.due,
          isOverdue,
          createdAt,
        },
      })
      taskCount++

      await prisma.activityLog.create({
        data: { type: 'TASK_CREATED', taskId: task.id, projectId: project.id, actorId: p.owner.id, toValue: task.title, createdAt },
      })
      await prisma.activityLog.create({
        data: { type: 'ASSIGNEE_CHANGED', taskId: task.id, projectId: project.id, actorId: p.owner.id, toValue: assignee.name, createdAt: new Date(createdAt.getTime() + 5 * 60 * 1000) },
      })
      activityCount += 2

      // walk the task through the statuses it must have passed to get where it is
      const steps = statusChain.indexOf(t.status)
      for (let s = 0; s < steps; s++) {
        const when = new Date(createdAt.getTime() + (s + 1) * 2 * 24 * 60 * 60 * 1000)
        // PM marks things done, developer does the rest
        const actor = statusChain[s + 1] === 'DONE' ? p.owner : assignee
        await prisma.activityLog.create({
          data: { type: 'STATUS_CHANGED', taskId: task.id, projectId: project.id, actorId: actor.id, fromValue: statusChain[s], toValue: statusChain[s + 1], createdAt: when },
        })
        activityCount++
      }

      if (isOverdue) {
        await prisma.activityLog.create({
          data: { type: 'TASK_OVERDUE', taskId: task.id, projectId: project.id, actorId: null, toValue: task.title, createdAt: new Date(t.due.getTime() + 60 * 1000) },
        })
        activityCount++
      }

      if (t.status === 'IN_REVIEW') {
        await prisma.notification.create({
          data: { userId: p.owner.id, type: 'TASK_IN_REVIEW', message: `${assignee.name} moved "${task.title}" to In Review`, taskId: task.id, createdAt: daysAgo(1) },
        })
      }
      if (t.status === 'TODO') {
        await prisma.notification.create({
          data: { userId: assignee.id, type: 'TASK_ASSIGNED', message: `${p.owner.name} assigned you "${task.title}"`, taskId: task.id, isRead: i % 2 === 0, createdAt },
        })
      }
    }
  }

  const overdue = await prisma.task.count({ where: { isOverdue: true } })
  console.log(`seeded ${Object.keys(users).length} users, ${Object.keys(clients).length} clients, ${projects.length} projects, ${taskCount} tasks (${overdue} overdue), ${activityCount} activity rows`)
}

if (require.main === module) {
  seed()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(() => prisma.$disconnect())
}
