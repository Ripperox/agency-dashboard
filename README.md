# Agency Board

Internal dashboard for a small agency: clients, projects, tasks, and a live activity feed so everyone sees status changes as they happen. Three roles (Admin, Project Manager, Developer) with access enforced in the API, not just hidden in the UI.

**Live:** https://agency-dashboard-chi-five.vercel.app
**Demo login:** any account below, password `password123`

| Role | Email | What they see |
|---|---|---|
| Admin | admin@agency.com | everything, plus a live "online now" count |
| Project Manager | rahul@agency.com, priya@agency.com | only the projects they created |
| Developer | ravi@, sneha@, arjun@, meera@ (all `@agency.com`) | only tasks assigned to them |

Open two browsers, log in as Rahul in one and Sneha in the other, and change a task status as Sneha. Rahul's feed, task list and notification badge update without a refresh.

## Stack

- **Backend:** Node 22, Express 5, TypeScript, Prisma 6, PostgreSQL 16, Socket.io, node-cron, zod
- **Frontend:** React 19, TypeScript, Vite, react-router, socket.io-client. Plain CSS, no component library.
- **Hosting:** frontend on Vercel, API on Render, database on Neon

## Running it locally

### With Docker (recommended)

```bash
git clone https://github.com/Ripperox/agency-dashboard.git
cd agency-dashboard
docker compose up --build
```

Then open http://localhost:8080. This starts Postgres, runs the migrations, seeds the demo data and serves the built frontend through nginx (which also proxies `/api` and `/socket.io` to the API container).

The seed runs on every boot because `SEED_ON_BOOT=true` is set in `docker-compose.yml`. Flip it to `false` if you want your changes to survive a restart.

### Without Docker

You need Node 22+ and a Postgres you can connect to.

```bash
# backend
cd backend
cp .env.example .env            # set DATABASE_URL and the two JWT secrets
npm install
npx prisma migrate deploy
npm run seed
npm run dev                     # http://localhost:4000

# frontend, in another terminal
cd frontend
npm install
npm run dev                     # http://localhost:5173, proxies /api and /socket.io to :4000
```

### Tests

```bash
cd backend
cp .env.test.example .env.test  # needs its own database, the setup wipes and reseeds it
npm test
```

27 tests with supertest against a real Postgres: refresh token rotation and replay, forged JWTs, every role boundary (PM vs other PM's project, developer vs other developer's task, developer trying to edit non-status fields), feed scoping per role, and the catch-up query.

## Layout

```
backend/
  prisma/schema.prisma      tables, relations, indexes
  prisma/seed.ts            7 users, 4 clients, 4 projects, 22 tasks, 73 activity rows
  src/
    app.ts                  express app, route mounting, error handler
    index.ts                http server + socket.io + cron
    middleware/auth.ts      requireAuth (verifies JWT, loads user from db), requireRole
    middleware/validate.ts  zod on body/query
    services/access.ts      the "who can see what" rules, used by every route
    services/activity.ts    write activity row, then emit to the right rooms
    services/notifications.ts
    socket/index.ts         handshake auth, rooms, presence count
    jobs/overdue.ts         cron job that flags overdue tasks
    routes/                 auth, users, clients, projects, tasks, activity, notifications, dashboard
  tests/                    vitest + supertest

frontend/src/
  api/client.ts             fetch wrapper, access token in memory, auto refresh on 401
  context/AuthContext.tsx   user + login/logout, silent refresh on page load
  context/SocketContext.tsx one socket per logged-in user
  components/ActivityFeed   live feed with reconnect catch-up
  components/TaskFilters    filters live in the url (?status=&priority=&dueFrom=&dueTo=)
  pages/                    Dashboard (per role), Projects, ProjectDetail, Tasks, TaskDetail, Activity, Clients, Users
```

## Database

```
User ─────< RefreshToken
  │
  ├──< Project (ownerId)  >── Client
  │       │
  │       └──< Task (assigneeId → User, createdById → User)
  │               │
  │               ├──< ActivityLog (actorId → User, nullable for system)
  │               └──< Notification (userId → User)
```

- **User** has a role enum. Password is a bcrypt hash.
- **RefreshToken** stores a HMAC of the token, never the token. `revokedAt` lets us rotate on every refresh and kill a session on logout.
- **Project** belongs to a client and has an owner (the PM or admin who created it). "PM can only manage projects they created" is a check on `ownerId`.
- **Task** has status, priority, dueDate, `isOverdue` (set by the cron job, not computed on read), an optional assignee and the creator.
- **ActivityLog** is append only. `type` + `fromValue` + `toValue` + `actorId` + `createdAt`. It's stored, not derived, so "Ravi moved #12 from In Progress to In Review" survives the task being edited again later. `projectId` is denormalised onto it so the PM feed query doesn't need to go through Task.
- **Notification** is per user with an `isRead` flag.

Deletes cascade from project to tasks to activity and notifications. Deleting a user sets `assigneeId`/`actorId` to null instead of losing the rows.

### Indexes and why

| Index | Query it serves |
|---|---|
| `Task(projectId)`, `Task(assigneeId)` | project task list, developer's "my tasks", and both are the FK lookups for the role scoping |
| `Task(status)`, `Task(priority)`, `Task(dueDate)` | the filter bar. Each is a single-column index because filters are combined in any order and Postgres can bitmap-AND them |
| `Task(status, isOverdue, dueDate)` | the cron query: `status != DONE AND isOverdue = false AND dueDate < now()` runs every minute, this index means it only touches candidate rows |
| `ActivityLog(projectId, createdAt desc)` | PM feed and per project feed, newest first |
| `ActivityLog(taskId, createdAt desc)` | task history |
| `ActivityLog(createdAt desc)` | admin global feed |
| `Notification(userId, isRead)` | the unread badge count, hit on every notification event |
| `Notification(userId, createdAt desc)` | the dropdown list |
| `RefreshToken(tokenHash)` unique, `RefreshToken(userId)` | refresh lookup, and revoking all of a user's sessions |
| `Project(ownerId)`, `Project(clientId)` | PM's project list, client's project count |

The developer feed filters on `task.assigneeId` through a join. At this size that's fine. If the feed table got large I'd denormalise `assigneeId` onto ActivityLog the same way `projectId` already is.

## Decisions

**Express over Fastify.** I know Express better and the assignment is more about auth and real-time logic than raw throughput. Express 5 handles rejected promises in async handlers, so there's no wrapper boilerplate and one error handler catches everything. Fastify's schema validation is nice but zod gives me the same thing plus TypeScript types out of the same schema.

**Socket.io over native `ws`.** Three things I'd have had to build by hand otherwise: rooms (the whole role filtering story below is "emit to these rooms"), automatic reconnection with backoff on the client, and a handshake hook for auth. The client is configured with `transports: ['websocket']` so it never falls back to long polling.

**node-cron over Bull.** There's exactly one job, it runs every minute, and it's idempotent (it only touches rows where `isOverdue = false`). Bull would mean adding Redis to the compose file and the hosting setup for a job that has no retry, no queueing and no fan-out. If there were more jobs or more than one API instance I'd move to Bull or pg-boss so only one worker runs it. The job also runs once on boot so a restart doesn't leave overdue tasks unflagged for a minute.

**Token storage.** Access token: 15 minute JWT, kept in a module variable in the frontend, never in localStorage. Refresh token: 7 days, random 48 bytes, sent as an `HttpOnly; SameSite=Lax; Secure` cookie scoped to `/api/auth`, stored in the db as a HMAC so a db leak doesn't give away live sessions. Every refresh rotates: old row gets `revokedAt`, new row is written, new cookie goes out. Replaying an old cookie gets a 401 (there's a test for it). On page load the app calls `/api/auth/refresh` first so a reload doesn't log you out.

**Role checks.** `requireAuth` verifies the JWT signature and then loads the user from the database. The role in the token is not trusted, so changing someone's role takes effect on their next request, not when their token expires. On top of that, every query is scoped in `services/access.ts`: `projectWhereForUser`, `taskWhereForUser`, `activityWhereForUser` return a Prisma `where` that the routes always AND with the request's own filters. There's no route where the frontend passes "my user id" and the backend trusts it. Where a user isn't allowed to see something that exists, the API returns 404 rather than 403, so a PM can't enumerate other PMs' project ids.

**The role-filtered live feed.** Every socket joins `user:<id>` on connect and admins also join `admins`. When an activity row is written, the server works out the audience from the row itself: `admins`, `user:<project owner>`, and `user:<task assignee>` if there is one, and emits to those rooms. That's the whole rule, and it's the same rule the REST feed uses, just expressed as rooms instead of a `where`. Socket.io dedupes if someone is in two of those rooms. The activity row is written first and the emit happens after, so the database is always the source of truth and the socket is only a hint.

**Missed events.** The feed remembers the highest activity id it has seen. Socket.io reconnects on its own; when the `connect` event fires for a second time the feed calls `GET /api/activity?after=<lastId>&limit=20`, which is the same role-scoped query as the initial load. Nothing is buffered in server memory, so this also works if the API restarted while the user was away.

**Presence.** A `Map<userId, Set<socketId>>` on the server. Two tabs from one person count once. The count goes to the `admins` room on every connect and disconnect.

**Notifications.** Assigning a task notifies the developer; moving a task to In Review notifies the project owner (unless they did it themselves). The row is written, then `notification:new` is pushed to `user:<id>` with the fresh unread count so the badge never has to poll.

## API

All routes are under `/api` and need `Authorization: Bearer <access token>` except login/refresh/logout. Errors always look like `{ "error": { "code": "...", "message": "...", "details"?: [...] } }`.

| Method | Path | Who |
|---|---|---|
| POST | /auth/login, /auth/refresh, /auth/logout | anyone |
| GET | /auth/me | any user |
| GET | /users?role= | admin (all), PM (developers only) |
| POST, PATCH, DELETE | /users | admin |
| GET | /clients | admin, PM |
| POST, PATCH, DELETE | /clients | admin |
| GET | /projects, /projects/:id, /projects/:id/tasks | scoped by role |
| POST, PATCH, DELETE | /projects | admin, owning PM |
| GET | /tasks?status=&priority=&dueFrom=&dueTo=&projectId=&overdue= | scoped by role |
| POST | /tasks/project/:projectId | admin, owning PM |
| PATCH | /tasks/:id | admin, owning PM |
| PATCH | /tasks/:id/status | admin, owning PM, or the assigned developer |
| GET | /tasks/:id/activity | anyone who can see the task |
| GET | /activity?limit=&before=&after=&projectId= | scoped by role |
| GET, PATCH | /notifications, /notifications/:id/read, /notifications/read-all | own only |
| GET | /dashboard | role specific payload |

Socket events: `activity:new`, `notification:new`, `presence:count` (admins only).

## Known limitations

- **Cold starts.** The API is on Render's free tier, which sleeps after 15 minutes idle. The first request after that can take 30 to 50 seconds. Docker locally doesn't have this problem.
- **Lists refetch instead of patching.** When a socket event arrives, the task table refetches its query rather than patching the one row in place. Simpler, always correct, but it's one extra request per event. Fine at agency scale.
- **No pagination on tasks.** The feed is paginated (`before=`), task lists are not. With thousands of tasks per project this would need `take`/`skip` and a count header.
- **One API instance.** The presence map is in memory and the cron job assumes a single process. Scaling out would need the socket.io Redis adapter and a locked job runner.
- **Socket auth is checked at connect only.** If an admin demotes someone, their REST calls are re-checked immediately, but an already open socket keeps its rooms until it reconnects (access tokens expire in 15 minutes, so that's the upper bound).
- **Reassigned tasks.** A developer who is unassigned from a task stops seeing its history. That matches "developer sees only tasks assigned to them" but might surprise someone.
- **No rate limiting** on login. It's a demo; in production I'd put express-rate-limit on `/api/auth/*`.
- **Cross-origin cookies in production.** The frontend on Vercel proxies `/api/*` to Render through a rewrite so the refresh cookie stays first-party (`SameSite=Lax` works and Safari doesn't block it). The websocket connects to Render directly using the access token in the handshake, since Vercel rewrites don't carry websocket upgrades.
