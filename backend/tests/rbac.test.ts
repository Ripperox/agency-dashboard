import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { app, loginAs, auth } from './helpers'

let admin: string, rahul: string, priya: string, ravi: string
let rahulProject: number, priyaProject: number
let raviTask: number, snehaTask: number

beforeAll(async () => {
  admin = (await loginAs('admin')).token
  rahul = (await loginAs('rahul')).token
  priya = (await loginAs('priya')).token
  ravi = (await loginAs('ravi')).token

  const rp = await request(app).get('/api/projects').set(auth(rahul))
  rahulProject = rp.body.projects[0].id
  const pp = await request(app).get('/api/projects').set(auth(priya))
  priyaProject = pp.body.projects[0].id

  const all = await request(app).get('/api/tasks').set(auth(admin))
  raviTask = all.body.tasks.find((t: any) => t.assignee?.name === 'Ravi Kumar').id
  snehaTask = all.body.tasks.find((t: any) => t.assignee?.name === 'Sneha Iyer').id
})

describe('project access', () => {
  it('admin sees every project', async () => {
    const res = await request(app).get('/api/projects').set(auth(admin))
    expect(res.body.projects.length).toBe(4)
  })

  it('a PM only sees projects they own', async () => {
    const res = await request(app).get('/api/projects').set(auth(rahul))
    expect(res.body.projects.every((p: any) => p.owner.name === 'Rahul Mehta')).toBe(true)
  })

  it('a PM cannot open another PM\'s project by id', async () => {
    const res = await request(app).get(`/api/projects/${priyaProject}`).set(auth(rahul))
    expect(res.status).toBe(404)
  })

  it('a PM cannot edit another PM\'s project', async () => {
    const res = await request(app).patch(`/api/projects/${priyaProject}`).set(auth(rahul)).send({ name: 'hijacked' })
    expect(res.status).toBe(404)
  })

  it('a PM cannot create a task in another PM\'s project', async () => {
    const res = await request(app).post(`/api/tasks/project/${priyaProject}`).set(auth(rahul)).send({ title: 'sneaky task' })
    expect(res.status).toBe(404)
  })

  it('a developer cannot create projects', async () => {
    const res = await request(app).post('/api/projects').set(auth(ravi)).send({ name: 'x', clientId: 1 })
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })

  it('a developer cannot list users or clients', async () => {
    expect((await request(app).get('/api/users').set(auth(ravi))).status).toBe(403)
    expect((await request(app).get('/api/clients').set(auth(ravi))).status).toBe(403)
  })

  it('a PM can only list developers, not all users', async () => {
    expect((await request(app).get('/api/users').set(auth(rahul))).status).toBe(403)
    const devs = await request(app).get('/api/users?role=DEVELOPER').set(auth(rahul))
    expect(devs.status).toBe(200)
    expect(devs.body.users.every((u: any) => u.role === 'DEVELOPER')).toBe(true)
  })
})

describe('task access', () => {
  it('a developer only gets their own tasks from the list', async () => {
    const res = await request(app).get('/api/tasks').set(auth(ravi))
    expect(res.body.tasks.length).toBeGreaterThan(0)
    expect(res.body.tasks.every((t: any) => t.assignee.name === 'Ravi Kumar')).toBe(true)
  })

  it('a developer cannot read another developer\'s task', async () => {
    const res = await request(app).get(`/api/tasks/${snehaTask}`).set(auth(ravi))
    expect(res.status).toBe(404)
  })

  it('a developer cannot change status on another developer\'s task', async () => {
    const res = await request(app).patch(`/api/tasks/${snehaTask}/status`).set(auth(ravi)).send({ status: 'DONE' })
    expect(res.status).toBe(404)
  })

  it('a developer can change status on their own task and it gets logged', async () => {
    const res = await request(app).patch(`/api/tasks/${raviTask}/status`).set(auth(ravi)).send({ status: 'IN_PROGRESS' })
    expect(res.status).toBe(200)
    expect(res.body.task.status).toBe('IN_PROGRESS')

    const log = await request(app).get(`/api/tasks/${raviTask}/activity`).set(auth(ravi))
    const latest = log.body.activity[0]
    expect(latest.type).toBe('STATUS_CHANGED')
    expect(latest.toValue).toBe('IN_PROGRESS')
    expect(latest.actor.name).toBe('Ravi Kumar')
  })

  it('a developer cannot edit task fields other than status', async () => {
    const res = await request(app).patch(`/api/tasks/${raviTask}`).set(auth(ravi)).send({ priority: 'CRITICAL' })
    expect(res.status).toBe(403)
  })

  it('rejects an invalid status value', async () => {
    const res = await request(app).patch(`/api/tasks/${raviTask}/status`).set(auth(ravi)).send({ status: 'SHIPPED' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('a PM cannot change status on a task in another PM\'s project', async () => {
    const other = await request(app).get(`/api/projects/${priyaProject}/tasks`).set(auth(priya))
    const taskId = other.body.tasks[0].id
    const res = await request(app).patch(`/api/tasks/${taskId}/status`).set(auth(rahul)).send({ status: 'DONE' })
    expect(res.status).toBe(404)
  })

  it('filters work through query params', async () => {
    const res = await request(app).get('/api/tasks?status=TODO&priority=HIGH').set(auth(admin))
    expect(res.status).toBe(200)
    expect(res.body.tasks.every((t: any) => t.status === 'TODO' && t.priority === 'HIGH')).toBe(true)
  })
})

describe('activity feed scoping', () => {
  it('a developer only sees activity on their own tasks', async () => {
    const res = await request(app).get('/api/activity?limit=50').set(auth(ravi))
    expect(res.body.activity.length).toBeGreaterThan(0)
    expect(res.body.activity.every((a: any) => a.task.assigneeId === 4)).toBe(true)
  })

  it('a PM only sees activity on their own projects', async () => {
    const res = await request(app).get('/api/activity?limit=50').set(auth(rahul))
    expect(res.body.activity.every((a: any) => a.project.ownerId === 2)).toBe(true)
    expect(res.body.activity.some((a: any) => a.project.id === rahulProject)).toBe(true)
  })

  it('after=id returns only the newer events, for catch-up', async () => {
    const before = await request(app).get('/api/activity?limit=1').set(auth(admin))
    const lastId = before.body.activity[0].id

    await request(app).patch(`/api/tasks/${raviTask}/status`).set(auth(ravi)).send({ status: 'IN_REVIEW' })

    const after = await request(app).get(`/api/activity?after=${lastId}`).set(auth(admin))
    expect(after.body.activity.length).toBe(1)
    expect(after.body.activity[0].toValue).toBe('IN_REVIEW')
  })

  it('moving to In Review notifies the project owner', async () => {
    const owner = await request(app).get(`/api/tasks/${raviTask}`).set(auth(admin))
    const ownerId = owner.body.task.project.ownerId
    const pm = ownerId === 2 ? rahul : priya
    const res = await request(app).get('/api/notifications').set(auth(pm))
    expect(res.body.notifications[0].type).toBe('TASK_IN_REVIEW')
    expect(res.body.notifications[0].message).toContain('Ravi Kumar')
  })
})
