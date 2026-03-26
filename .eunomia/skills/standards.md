

# Project Standards — backend

## 1. Project Overview

**todo-backend** is a RESTful API for a ToDo application built with Express.js and SQLite (via `better-sqlite3`). It exposes CRUD endpoints for managing todo items, with optional filtering by status. The project is a backend-only Node.js application with no frontend assets or bundler.

## 2. Tech Stack & Versions

| Component | Technology | Version |
|---|---|---|
| Language | JavaScript (ES2021+) | Node.js (runtime) |
| Framework | Express | ^4.18.2 |
| Database | SQLite via better-sqlite3 | ^11.0.0 |
| CORS | cors | ^2.8.5 |
| Test Runner | Jest | ^29.7.0 |
| HTTP Test Util | supertest | ^6.3.3 |
| Linter | ESLint | ^8.55.0 |
| Dev Server | nodemon | ^3.0.1 |
| Module System | CommonJS (`require` / `module.exports`) |  |
| Package Manager | npm |  |

> **Note:** ESLint config sets `sourceType: "module"` but the codebase uses CommonJS exclusively. See §8.

## 3. Code Conventions

### 3.1 Module System

Use **CommonJS** (`require` / `module.exports`) throughout. Do **not** use ES module syntax (`import` / `export`).

```js
// ✅ Correct
const express = require('express');
module.exports = app;

// ❌ Wrong
import express from 'express';
export default app;
```

### 3.2 Naming Conventions

| Entity | Convention | Example |
|---|---|---|
| Files & directories | lowercase, kebab-case for multi-word | `todos.js`, `db.js` |
| Route files | noun, plural | `todos.js` |
| Variables & functions | camelCase | `validateTitle`, `formattedTodos` |
| Constants (config) | UPPER_SNAKE_CASE | `PORT` |
| Database columns | snake_case | `created_at`, `updated_at` |
| Private/internal variables | leading underscore | `_db` |

### 3.3 File & Folder Structure

```
project-root/
├── package.json
├── .eslintrc.json
├── src/
│   ├── index.js          # Express app setup & server entry point
│   ├── db.js             # Database connection & schema initialization
│   ├── routes/
│   │   └── todos.js      # Route handler module per resource
│   └── __tests__/
│       ├── db.test.js     # Unit tests for db module
│       └── todos.test.js  # Integration tests for API routes
└── todo.db               # SQLite file (auto-created, gitignored)
```

**Rules:**
- Entry point is always `src/index.js`.
- One route file per resource, placed in `src/routes/`.
- All tests live in `src/__tests__/` with the naming pattern `<module>.test.js`.
- Database file is stored at project root (outside `src/`).

### 3.4 Import Ordering

Follow this order, separated by blank lines:

1. Node.js built-in modules (`path`, `fs`)
2. Third-party packages (`express`, `cors`, `better-sqlite3`)
3. Local modules (`./routes/todos`, `../db`)

```js
const path = require('path');

const express = require('express');
const cors = require('cors');

const todosRouter = require('./routes/todos');
```

### 3.5 Comment Style

- Use JSDoc-style `/** ... */` block comments for module headers and exported functions.
- Use inline `//` comments for implementation notes.
- Every file must begin with a module-level JSDoc block describing its purpose.

```js
/**
 * Todos API Routes
 * REST endpoints for CRUD operations on todos
 */
```

```js
/**
 * Validation helper for todo title
 */
function validateTitle(title) { ... }
```

## 4. Architecture Patterns

### 4.1 Layered Structure

The project follows a simple two-layer architecture:

| Layer | Location | Responsibility |
|---|---|---|
| **Routes** | `src/routes/*.js` | HTTP handling, request validation, response formatting |
| **Data** | `src/db.js` | Database connection, schema, query execution |

There is no separate service/model layer. Route handlers call `db.prepare()` directly. If the project grows, introduce a `src/models/` or `src/services/` layer.

### 4.2 Express App Configuration

Configure middleware in `src/index.js` in this order:

1. `cors()`
2. `express.json()`
3. `express.urlencoded({ extended: true })`
4. Root/health routes
5. Resource routers via `app.use('/api/<resource>', router)`

### 4.3 Server Start Guard

The app must export the Express instance for testing and only call `app.listen()` when run directly:

```js
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
```

### 4.4 Database Access Pattern

- Use `better-sqlite3` synchronous API exclusively (no async/callback patterns for DB).
- All SQL statements go through `db.prepare(sql)` followed by `.run()`, `.get()`, or `.all()`.
- Wrap statement execution with reconnect logic to handle `SQLITE_READONLY_DBMOVED` errors transparently.
- Enable `foreign_keys = ON` pragma on every connection.

### 4.5 Error Handling

Route handlers wrap their body in `try/catch`. Errors return JSON with an `error` key:

```js
router.get('/', (req, res) => {
  try {
    // ... logic
  } catch (error) {
    // Log to console, return 500
    console.error('Error description:', error.message);
    res.status(500).json({ error: 'Failed to <action>' });
  }
});
```

**Rules:**
- Always catch at the route handler level.
- Log `error.message` to `console.error`.
- Never expose raw error details or stack traces in the response.
- Use descriptive, action-specific messages: `"Failed to fetch todos"`, not `"Internal server error"`.

## 5. API Design

### 5.1 URL Conventions

- Base path: `/api/<resource>` (plural noun, lowercase).
- Resource IDs as path parameters: `/api/todos/:id`.
- Use query parameters for filtering: `?status=active|completed`.

### 5.2 HTTP Methods & Status Codes

| Operation | Method | Path | Success Code |
|---|---|---|---|
| List all | `GET` | `/api/todos` | 200 |
| Get one | `GET` | `/api/todos/:id` | 200 |
| Create | `POST` | `/api/todos` | 201 |
| Update | `PUT` | `/api/todos/:id` | 200 |
| Delete | `DELETE` | `/api/todos/:id` | 200 |

### 5.3 Request Validation

- Validate in the route handler using dedicated helper functions (`validateTitle`, `validateCompleted`).
- Validation functions return `{ valid: boolean, error?: string, value?: any }`.
- Return `400` with `{ error: "<message>" }` on validation failure.

```js
function validateTitle(title) {
  if (!title || typeof title !== 'string') {
    return { valid: false, error: 'Title is required' };
  }
  const trimmedTitle = title.trim();
  if (trimmedTitle.length === 0) {
    return { valid: false, error: 'Title cannot be empty' };
  }
  if (trimmedTitle.length > 200) {
    return { valid: false, error: 'Title must not exceed 200 characters' };
  }
  return { valid: true, value: trimmedTitle };
}
```

### 5.4 Response Shape

**Success (single resource):**
```json
{
  "id": 1,
  "title": "Test Todo",
  "description": "Test Description",
  "completed": false,
  "created_at": "2025-01-01T00:00:00.000Z",
  "updated_at": "2025-01-01T00:00:00.000Z"
}
```

**Success (list):** Return a flat array `[{ ... }, { ... }]`.

**Error:**
```json
{
  "error": "Human-readable error message"
}
```

**Rules:**
- Convert SQLite `0/1` booleans to JavaScript `true/false` in responses.
- Use snake_case for all response field names (matching DB columns).
- Default ordering: `ORDER BY created_at DESC`.

### 5.5 Standard Endpoints

Every resource must include:
- `GET /` — root returning `{ message: '<App Name> API' }`
- `GET /health` — health check returning `{ status: 'ok', timestamp: '<ISO 8601>' }`

## 6. Testing Conventions

### 6.1 File Naming & Placement

- All tests in `src/__tests__/`.
- Name: `<module>.test.js` (e.g., `db.test.js`, `todos.test.js`).

### 6.2 Test Structure

- Use `describe` blocks to group by module/endpoint.
- Nest `describe` blocks for sub-grouping (e.g., by HTTP method).
- Use descriptive `test()` (not `it()`) names starting with `should`.

```js
describe('Todos API Endpoints', () => {
  describe('POST /api/todos', () => {
    test('should create a new todo with title and description', async () => {
      // ...
    });
  });
});
```

### 6.3 Test Database Management

- Tests use the same SQLite file (`todo.db` at project root).
- `beforeAll`: delete DB file, clear `require.cache` for `db` and `index`, then re-require.
- `afterEach`: truncate tables (`DELETE FROM todos`).
- `afterAll`: close DB connection, delete DB file.
- Wrap cleanup in `try/catch` — silently ignore lock errors.

### 6.4 Integration Tests

- Use `supertest` wrapping the exported `app` instance.
- Chain `.expect(statusCode)` for status assertions.
- Assert response body properties with `expect(response.body).toHaveProperty(...)`.

### 6.5 Test Execution

```bash
npm test   # runs: jest --runInBand --coverage
```

- `--runInBand`: tests run serially (required for shared SQLite file).
- `--coverage`: always generate coverage reports.

### 6.6 What Must Be Tested

- All CRUD endpoints (happy path + validation errors + not-found).
- Database schema initialization.
- Module exports (correct shape).

## 7. Known Inconsistencies & Resolutions

| # | Inconsistency | Resolution |
|---|---|---|
| 1 | `.eslintrc.json` sets `"sourceType": "module"` but codebase uses CommonJS (`require`/`module.exports`). | **Change `.eslintrc.json` to `"sourceType": "commonjs"`** (or `"script"`). The canonical module system is CommonJS. |
| 2 | `db.js` calls `_db.pragma('foreign_keys = ON')` at module load AND again inside `initSchema()`. | **Canonical:** set pragma once inside `initSchema()` (or a dedicated `connect()` function). Remove the duplicate at module level. |
| 3 | `params` array is constructed in `GET /api/todos` but never populated — filters are concatenated as string literals. | **Canonical:** use parameterized queries. Build `params` properly: `sql += ' WHERE completed = ?'; params.push(0);`. |

## 8. Anti-Patterns (Do NOT do these)

### 8.1 String-concatenated SQL filters
The current `GET /` route builds WHERE clauses by string concatenation while maintaining an unused `params` array. **Always use parameterized queries** to prevent SQL injection and maintain consistency:

```js
// ❌ Do NOT do this
let sql = 'SELECT * FROM todos';
if (status === 'active') {
  sql += ' WHERE completed = 0';
}

// ✅ Do this
let sql = 'SELECT * FROM todos';
const params = [];
if (status === 'active') {
  sql += ' WHERE completed = ?';
  params.push(0);
}
const todos = db.prepare(sql).all(...params);
```

### 8.2 Swallowed errors without logging
Several catch blocks use empty `catch (error) { /* ignore */ }`. **If you must ignore an error, add a comment explaining why.** For non-trivial operations, always log at minimum:

```js
// ❌
catch (e) { /* ignore */ }

// ✅
catch (e) {
  // Expected: file may be locked by active connection during cleanup
}
```

### 8.3 Shared mutable database file across tests
Tests share a single `todo.db` file and use `require.cache` manipulation to reset state. **Do not add new test files that assume independent database state without following the established `beforeAll`/`afterEach`/`afterAll` cleanup pattern.** If the project grows, migrate to in-memory SQLite databases for test isolation (`:memory:`).

### 8.4 ES module syntax
Do **not** introduce `import`/`export` statements. The project is CommonJS. A migration to ESM would require `"type": "module"` in `package.json` and changes to all files.

### 8.5 Inline validation logic
Do **not** put validation logic directly in route handlers. Extract it into named validation helper functions as established by `validateTitle` and `validateCompleted`.