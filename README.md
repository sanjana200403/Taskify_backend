# Task Manager API

Backend API for a MERN task manager. It provides authenticated task management, keyword search, Monday-to-Sunday weekly summaries, and status-based progress tracking for the responsive web client.

## Product coverage

| Product requirement | Backend implementation |
| --- | --- |
| Create a task with title, optional description, date/time, and optional priority | `POST /api/tasks` with validation and defaults |
| Edit any task attribute | `PUT /api/tasks/:id` |
| Delete a task | `DELETE /api/tasks/:id` |
| Search by title or description | `GET /api/tasks/search?q=keyword` and the `q` filter on `GET /api/tasks` |
| View a task from search results | `GET /api/tasks/:id` |
| Group tasks into Monday-Sunday weeks | `GET /api/tasks/weekly-summary` uses MongoDB date aggregation with Monday as the first day |
| Show open and completed totals | Weekly summaries return `openTasks` and `completedTasks` |
| Mark tasks In Progress or Completed | Update the task's `status` through `PUT /api/tasks/:id` |
| Update weekly progress after a status change | Summary and analytics endpoints calculate totals from the persisted task status |

The mobile swipe interaction, expanded week cards, and view/edit/delete controls are frontend behaviors. This API supplies the user-scoped CRUD, search, filtering, and weekly data needed by those flows.

## Status rules

- `Pending`: open work that has not started.
- `In Progress`: open work that has started.
- `Completed`: closed work.

Therefore, `openTasks` is the combined number of `Pending` and `In Progress` tasks. Only `Completed` tasks contribute to `completedTasks` and the completion percentage.

## Technology

- Node.js 20+
- Express 4
- MongoDB and Mongoose
- JWT session cookies and bcrypt password hashing
- `express-validator` request validation
- Helmet, CORS, CSRF protection, and rate limiting
- Vitest, Supertest, and `mongodb-memory-server`

## Project structure

```text
backend/
|-- src/
|   |-- config/       # Environment and database setup
|   |-- controllers/  # HTTP request/response handling
|   |-- middleware/   # Authentication, CSRF, validation, and errors
|   |-- models/       # Mongoose User and Task schemas
|   |-- routes/       # Auth and task route definitions
|   |-- services/     # Authentication and task business logic
|   |-- utils/        # Cookies, dates, responses, and API errors
|   `-- validators/   # Auth and task validation rules
|-- tests/            # API integration and timezone unit tests
|-- .env.example
|-- package.json
`-- vitest.config.js
```

## Local setup

### Prerequisites

- Node.js 20 or newer
- npm
- MongoDB running locally, or a MongoDB Atlas connection string

### Install and configure

From the `backend` directory:

```bash
npm install
```

Copy `.env.example` to `.env` and update the secrets and database URL:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/task_manager
CLIENT_URL=http://localhost:5173
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=1d
COOKIE_SECRET=replace-with-another-long-random-secret
```

`CLIENT_URL` accepts a comma-separated allowlist. For example, when testing from a phone on the same Wi-Fi network:

```env
CLIENT_URL=http://localhost:5173,http://192.168.1.20:5173
```

Use the computer's actual LAN IP instead of the example address. The frontend must also call the API through that LAN IP.

### Run

```bash
npm run dev
```

The API is available at `http://localhost:5000/api` by default. Verify it with:

```text
GET http://localhost:5000/api/health
```

## Environment variables

| Variable | Required in production | Purpose |
| --- | --- | --- |
| `PORT` | No | HTTP port; defaults to `5000` |
| `NODE_ENV` | No | `development`, `test`, or `production` |
| `MONGO_URI` | Yes | MongoDB connection string |
| `CLIENT_URL` | Yes | Comma-separated CORS origin allowlist |
| `JWT_SECRET` | Yes | Signs session JWTs |
| `JWT_EXPIRES_IN` | No | JWT lifetime; defaults to `1d` |
| `COOKIE_SECRET` | Yes | Signs CSRF tokens |

## Data model

Each task belongs to the authenticated user.

| Field | Type | Rules |
| --- | --- | --- |
| `title` | String | Required, trimmed, maximum 160 characters |
| `description` | String | Optional, trimmed, maximum 2,000 characters |
| `scheduledAt` | ISO 8601 date-time | Required |
| `priority` | String | `Low`, `Medium`, or `High`; defaults to `Medium` |
| `status` | String | `Pending`, `In Progress`, or `Completed`; defaults to `Pending` |
| `user` | ObjectId | Required owner reference; assigned from the session |
| `createdAt`, `updatedAt` | Date | Added automatically |

## Authentication and CSRF flow

Registration and login set an HttpOnly `todo_session` cookie and return a `csrfToken` in the response body. The browser client must send cookies on every authenticated request.

State-changing authenticated requests also require:

```http
x-csrf-token: <csrfToken returned by register, login, or /auth/me>
```

This header is required for task creation, updates, deletion, and logout. Read-only routes do not require it.

In development, cookies use `SameSite=Lax`. In production, cookies use `Secure` and `SameSite=None` to support a separately hosted frontend and API over HTTPS.

## API reference

All routes below are relative to `/api`.

### Health

| Method | Route | Authentication | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | No | API health check |

### Authentication

| Method | Route | Authentication | Purpose |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | No | Create an account and session |
| `POST` | `/auth/login` | No | Sign in and create a session |
| `GET` | `/auth/me` | Session | Restore the user and CSRF token |
| `POST` | `/auth/logout` | Session + CSRF | Clear authentication cookies |

Register body:

```json
{
  "name": "Sanjana Maurya",
  "email": "sanjana@example.com",
  "password": "Secure123!"
}
```

Passwords must be 8-72 characters and contain at least one lowercase letter, uppercase letter, number, and special character, with no spaces.

### Tasks

All task routes require an authenticated session. Task IDs are ownership-scoped, so users cannot read or change another user's tasks.

| Method | Route | CSRF required | Purpose |
| --- | --- | --- | --- |
| `GET` | `/tasks` | No | List, search, filter, sort, and paginate tasks |
| `POST` | `/tasks` | Yes | Create a task |
| `GET` | `/tasks/:id` | No | View one task |
| `PUT` | `/tasks/:id` | Yes | Update one or more task fields/status |
| `DELETE` | `/tasks/:id` | Yes | Delete a task |
| `GET` | `/tasks/search?q=keyword` | No | Search title and description |
| `GET` | `/tasks/weekly-summary` | No | Get Monday-Sunday open/completed totals |
| `GET` | `/tasks/analytics` | No | Get range progress, status, priority, and activity data |

Create task body:

```json
{
  "title": "Finish responsive wireframe",
  "description": "Review the mobile dashboard",
  "scheduledAt": "2026-11-04T09:30:00.000Z",
  "priority": "High",
  "status": "Pending"
}
```

Update only the fields that changed:

```json
{
  "status": "Completed"
}
```

### List filters

`GET /tasks` supports:

| Query | Values |
| --- | --- |
| `page` | Positive integer; defaults to `1` |
| `limit` | `1`-`100`; defaults to `20` |
| `q` | Case-insensitive title/description keyword |
| `status` | `Pending`, `In Progress`, or `Completed` |
| `priority` | `Low`, `Medium`, or `High` |
| `from` | ISO 8601 start date-time, inclusive |
| `to` | ISO 8601 end date-time, inclusive |
| `sort` | `dueAsc`, `dueDesc`, or `newest` |

Example selected-week request:

```text
GET /api/tasks?from=2026-11-02T00:00:00.000Z&to=2026-11-08T23:59:59.999Z&status=In%20Progress
```

### Weekly summaries

Pass the user's IANA timezone so Monday-Sunday boundaries match their calendar:

```text
GET /api/tasks/weekly-summary?timezone=Asia%2FCalcutta
```

Example response data:

```json
[
  {
    "weekStart": "2026-11-02",
    "weekEnd": "2026-11-08",
    "totalTasks": 4,
    "completedTasks": 1,
    "openTasks": 3
  }
]
```

### Analytics

```text
GET /api/tasks/analytics?range=week&timezone=Asia%2FCalcutta
```

`range` accepts `week`, `month`, or `year`. The response includes task totals, status and priority counts, completion rate, overdue and due-soon counts, activity buckets, and upcoming tasks.

## Response format

Successful response:

```json
{
  "success": true,
  "message": "Tasks loaded successfully",
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

Validation or API error:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "title",
      "message": "Title is required"
    }
  ]
}
```

Common status codes are `200`, `201`, `400`, `401`, `403`, `404`, `409`, and `429`.

## Security behavior

- Passwords are hashed with bcrypt using 12 rounds.
- JWTs are stored in HttpOnly cookies, not browser storage.
- Signed double-submit CSRF tokens protect authenticated mutations.
- Every task query includes the authenticated user's ID.
- Helmet sets defensive HTTP headers.
- CORS accepts only configured frontend origins and allows credentials.
- API traffic is rate-limited; authentication has a stricter limit.
- JSON request bodies are limited to 32 KB.
- Production startup fails when required secrets or the database URL are missing.

## Quality commands

```bash
npm run lint
npm test
npm run test:coverage
npm run format:check
npm run check
```

The tests cover authentication, password hashing, validation, CSRF, task CRUD, keyword search, ownership isolation, weekly summaries, status analytics, logout, timezone conversion, and daylight-saving boundaries.

## Deployment notes

1. Set `NODE_ENV=production`.
2. Use MongoDB Atlas or another production MongoDB deployment.
3. Set strong, unrelated values for `JWT_SECRET` and `COOKIE_SECRET`.
4. Set `CLIENT_URL` to the exact HTTPS frontend origin (or comma-separated origins).
5. Deploy the API over HTTPS so secure cross-site cookies work.
6. Use `/api/health` as the hosting platform's health-check path.

The repository includes a root `render.yaml` for API deployment.
