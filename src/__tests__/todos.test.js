/**
 * Todos API Routes Tests
 * Comprehensive tests for all CRUD endpoints
 */

const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Test database path
const testDbPath = path.join(__dirname, '..', '..', 'todo.db');

// Clean up and reset database before tests
beforeAll(() => {
  // Remove database file if it exists
  if (fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
    } catch (error) {
      // Ignore if file is locked
    }
  }
});

// Import app after cleaning database
const app = require('../index');
const { db } = require('../db');

// Clean up database after each test
afterEach(() => {
  // Clear all todos between tests
  try {
    db.prepare('DELETE FROM todos').run();
  } catch (error) {
    // Ignore errors
  }
});

// Clean up after all tests
afterAll(() => {
  // Close database connection
  if (db && db.open) {
    db.close();
  }

  // Clean up test database file
  if (fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
    } catch (error) {
      // Silently ignore - file may be locked
    }
  }
});

describe('Todos API Endpoints', () => {
  describe('POST /api/todos', () => {
    test('should create a new todo with title and description', async () => {
      const newTodo = {
        title: 'Test Todo',
        description: 'Test Description'
      };

      const response = await request(app)
        .post('/api/todos')
        .send(newTodo)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Test Todo');
      expect(response.body.description).toBe('Test Description');
      expect(response.body.completed).toBe(false);
      expect(response.body).toHaveProperty('created_at');
      expect(response.body).toHaveProperty('updated_at');
    });

    test('should create a todo with only title (description optional)', async () => {
      const newTodo = {
        title: 'Todo without description'
      };

      const response = await request(app)
        .post('/api/todos')
        .send(newTodo)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Todo without description');
      expect(response.body.description).toBe('');
      expect(response.body.completed).toBe(false);
    });

    test('should return 400 if title is missing', async () => {
      const response = await request(app)
        .post('/api/todos')
        .send({ description: 'No title' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Title is required');
    });

    test('should return 400 if title is empty string', async () => {
      const response = await request(app)
        .post('/api/todos')
        .send({ title: '   ' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Title cannot be empty');
    });

    test('should return 400 if title exceeds 200 characters', async () => {
      const longTitle = 'a'.repeat(201);

      const response = await request(app)
        .post('/api/todos')
        .send({ title: longTitle })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Title must not exceed 200 characters');
    });

    test('should accept title with exactly 200 characters', async () => {
      const exactTitle = 'a'.repeat(200);

      const response = await request(app)
        .post('/api/todos')
        .send({ title: exactTitle })
        .expect(201);

      expect(response.body.title).toBe(exactTitle);
    });

    test('should trim whitespace from title', async () => {
      const response = await request(app)
        .post('/api/todos')
        .send({ title: '  Trimmed Title  ' })
        .expect(201);

      expect(response.body.title).toBe('Trimmed Title');
    });
  });

  describe('GET /api/todos', () => {
    test('should return empty array when no todos exist', async () => {
      const response = await request(app)
        .get('/api/todos')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });

    test('should return all todos ordered by created_at DESC', async () => {
      // Create multiple todos with delays to ensure different timestamps
      await request(app).post('/api/todos').send({ title: 'First Todo' });
      await new Promise(resolve => setTimeout(resolve, 1100));
      await request(app).post('/api/todos').send({ title: 'Second Todo' });
      await new Promise(resolve => setTimeout(resolve, 1100));
      await request(app).post('/api/todos').send({ title: 'Third Todo' });

      const response = await request(app)
        .get('/api/todos')
        .expect(200);

      expect(response.body.length).toBe(3);
      expect(response.body[0].title).toBe('Third Todo'); // Most recent first
      expect(response.body[1].title).toBe('Second Todo');
      expect(response.body[2].title).toBe('First Todo');
    });

    test('should filter todos by status=active', async () => {
      // Create active and completed todos
      await request(app).post('/api/todos').send({ title: 'Active Todo 1' });
      await request(app).post('/api/todos').send({ title: 'Active Todo 2' });
      const todo3 = await request(app).post('/api/todos').send({ title: 'Completed Todo' });

      // Mark one as completed
      await request(app)
        .put(`/api/todos/${todo3.body.id}`)
        .send({ completed: true });

      const response = await request(app)
        .get('/api/todos?status=active')
        .expect(200);

      expect(response.body.length).toBe(2);
      expect(response.body.every(todo => todo.completed === false)).toBe(true);
    });

    test('should filter todos by status=completed', async () => {
      // Create active and completed todos
      await request(app).post('/api/todos').send({ title: 'Active Todo' });
      const todo2 = await request(app).post('/api/todos').send({ title: 'Completed Todo 1' });
      const todo3 = await request(app).post('/api/todos').send({ title: 'Completed Todo 2' });

      // Mark two as completed
      await request(app)
        .put(`/api/todos/${todo2.body.id}`)
        .send({ completed: true });
      await request(app)
        .put(`/api/todos/${todo3.body.id}`)
        .send({ completed: true });

      const response = await request(app)
        .get('/api/todos?status=completed')
        .expect(200);

      expect(response.body.length).toBe(2);
      expect(response.body.every(todo => todo.completed === true)).toBe(true);
    });

    test('should return both active and completed todos when no status filter is provided', async () => {
      await request(app).post('/api/todos').send({ title: 'Active Todo' });
      const todo2 = await request(app).post('/api/todos').send({ title: 'Completed Todo' });

      await request(app)
        .put(`/api/todos/${todo2.body.id}`)
        .send({ completed: true });

      const response = await request(app)
        .get('/api/todos')
        .expect(200);

      expect(response.body.length).toBe(2);
      const titles = response.body.map(t => t.title);
      expect(titles).toContain('Active Todo');
      expect(titles).toContain('Completed Todo');
      const completedValues = response.body.map(t => t.completed);
      expect(completedValues).toContain(true);
      expect(completedValues).toContain(false);
    });

    test('should return 400 for invalid status parameter', async () => {
      const response = await request(app)
        .get('/api/todos?status=invalid')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid status parameter');
    });

    test('should convert completed field to boolean', async () => {
      await request(app).post('/api/todos').send({ title: 'Test Todo' });

      const response = await request(app)
        .get('/api/todos')
        .expect(200);

      expect(response.body.length).toBe(1);
      expect(typeof response.body[0].completed).toBe('boolean');
    });

    test('should return description field in list response', async () => {
      await request(app)
        .post('/api/todos')
        .send({ title: 'Todo With Description', description: 'A detailed description' });

      const response = await request(app)
        .get('/api/todos')
        .expect(200);

      expect(response.body.length).toBe(1);
      expect(response.body[0].description).toBe('A detailed description');
    });
  });

  describe('GET /api/todos/:id', () => {
    test('should return a single todo by id', async () => {
      const createResponse = await request(app)
        .post('/api/todos')
        .send({ title: 'Test Todo', description: 'Test Description' });

      const todoId = createResponse.body.id;

      const response = await request(app)
        .get(`/api/todos/${todoId}`)
        .expect(200);

      expect(response.body.id).toBe(todoId);
      expect(response.body.title).toBe('Test Todo');
      expect(response.body.description).toBe('Test Description');
      expect(response.body.completed).toBe(false);
    });

    test('should return 404 for non-existent todo', async () => {
      const response = await request(app)
        .get('/api/todos/99999')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Todo not found');
    });

    test('should return 400 for invalid id format', async () => {
      const response = await request(app)
        .get('/api/todos/invalid-id')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Invalid todo ID');
    });

    test('should convert completed field to boolean', async () => {
      const createResponse = await request(app)
        .post('/api/todos')
        .send({ title: 'Test Todo' });

      const response = await request(app)
        .get(`/api/todos/${createResponse.body.id}`)
        .expect(200);

      expect(typeof response.body.completed).toBe('boolean');
    });
  });

  describe('PUT /api/todos/:id', () => {
    test('should update todo title', async () => {
      const createResponse = await request(app)
        .post('/api/todos')
        .send({ title: 'Original Title' });

      const todoId = createResponse.body.id;

      const response = await request(app)
        .put(`/api/todos/${todoId}`)
        .send({ title: 'Updated Title' })
        .expect(200);

      expect(response.body.title).toBe('Updated Title');
      expect(response.body.id).toBe(todoId);
    });

    test('should update todo description', async () => {
      const createResponse = await request(app)
        .post('/api/todos')
        .send({ title: 'Test Todo', description: 'Original Description' });

      const todoId = createResponse.body.id;

      const response = await request(app)
        .put(`/api/todos/${todoId}`)
        .send({ description: 'Updated Description' })
        .expect(200);

      expect(response.body.description).toBe('Updated Description');
      expect(response.body.title).toBe('Test Todo'); // Title unchanged
    });

    test('should update completed status', async () => {
      const createResponse = await request(app)
        .post('/api/todos')
        .send({ title: 'Test Todo' });

      const todoId = createResponse.body.id;

      const response = await request(app)
        .put(`/api/todos/${todoId}`)
        .send({ completed: true })
        .expect(200);

      expect(response.body.completed).toBe(true);
    });

    test('should update multiple fields at once', async () => {
      const createResponse = await request(app)
        .post('/api/todos')
        .send({ title: 'Original Title', description: 'Original Description' });

      const todoId = createResponse.body.id;

      const response = await request(app)
        .put(`/api/todos/${todoId}`)
        .send({
          title: 'New Title',
          description: 'New Description',
          completed: true
        })
        .expect(200);

      expect(response.body.title).toBe('New Title');
      expect(response.body.description).toBe('New Description');
      expect(response.body.completed).toBe(true);
    });

    test('should update updated_at timestamp', async () => {
      const createResponse = await request(app)
        .post('/api/todos')
        .send({ title: 'Test Todo' });

      const todoId = createResponse.body.id;
      const originalUpdatedAt = createResponse.body.updated_at;

      // Wait a bit to ensure timestamp changes (SQLite CURRENT_TIMESTAMP is second-precision)
      await new Promise(resolve => setTimeout(resolve, 1100));

      const response = await request(app)
        .put(`/api/todos/${todoId}`)
        .send({ title: 'Updated Title' })
        .expect(200);

      expect(response.body.updated_at).not.toBe(originalUpdatedAt);
    });

    test('should return 404 for non-existent todo', async () => {
      const response = await request(app)
        .put('/api/todos/99999')
        .send({ title: 'Updated Title' })
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Todo not found');
    });

    test('should return 400 for invalid id format', async () => {
      const response = await request(app)
        .put('/api/todos/invalid-id')
        .send({ title: 'Updated Title' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Invalid todo ID');
    });

    test('should return 400 if title exceeds 200 characters', async () => {
      const createResponse = await request(app)
        .post('/api/todos')
        .send({ title: 'Test Todo' });

      const todoId = createResponse.body.id;
      const longTitle = 'a'.repeat(201);

      const response = await request(app)
        .put(`/api/todos/${todoId}`)
        .send({ title: longTitle })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Title must not exceed 200 characters');
    });

    test('should return 400 if title is empty', async () => {
      const createResponse = await request(app)
        .post('/api/todos')
        .send({ title: 'Test Todo' });

      const todoId = createResponse.body.id;

      const response = await request(app)
        .put(`/api/todos/${todoId}`)
        .send({ title: '   ' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Title cannot be empty');
    });

    test('should return 400 if completed is not boolean', async () => {
      const createResponse = await request(app)
        .post('/api/todos')
        .send({ title: 'Test Todo' });

      const todoId = createResponse.body.id;

      const response = await request(app)
        .put(`/api/todos/${todoId}`)
        .send({ completed: 'invalid' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Completed must be a boolean value');
    });

    test('should accept 0 and 1 as boolean values for completed', async () => {
      const createResponse = await request(app)
        .post('/api/todos')
        .send({ title: 'Test Todo' });

      const todoId = createResponse.body.id;

      // Test with 1
      const response1 = await request(app)
        .put(`/api/todos/${todoId}`)
        .send({ completed: 1 })
        .expect(200);

      expect(response1.body.completed).toBe(true);

      // Test with 0
      const response2 = await request(app)
        .put(`/api/todos/${todoId}`)
        .send({ completed: 0 })
        .expect(200);

      expect(response2.body.completed).toBe(false);
    });

    test('should toggle a completed todo back to incomplete', async () => {
      const createResponse = await request(app)
        .post('/api/todos')
        .send({ title: 'Test Todo' });

      const todoId = createResponse.body.id;

      // Mark as completed
      await request(app)
        .put(`/api/todos/${todoId}`)
        .send({ completed: true })
        .expect(200);

      // Toggle back to incomplete
      const response = await request(app)
        .put(`/api/todos/${todoId}`)
        .send({ completed: false })
        .expect(200);

      expect(response.body.completed).toBe(false);
    });

    test('should return 400 if no valid fields to update', async () => {
      const createResponse = await request(app)
        .post('/api/todos')
        .send({ title: 'Test Todo' });

      const todoId = createResponse.body.id;

      const response = await request(app)
        .put(`/api/todos/${todoId}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('No valid fields to update');
    });
  });

  describe('DELETE /api/todos/:id', () => {
    test('should delete a todo and return 204', async () => {
      const createResponse = await request(app)
        .post('/api/todos')
        .send({ title: 'Todo to Delete' });

      const todoId = createResponse.body.id;

      await request(app)
        .delete(`/api/todos/${todoId}`)
        .expect(204);

      // Verify todo is deleted
      await request(app)
        .get(`/api/todos/${todoId}`)
        .expect(404);
    });

    test('should return 404 for non-existent todo', async () => {
      const response = await request(app)
        .delete('/api/todos/99999')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Todo not found');
    });

    test('should return 400 for invalid id format', async () => {
      const response = await request(app)
        .delete('/api/todos/invalid-id')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Invalid todo ID');
    });

    test('should return 404 when deleting the same todo twice', async () => {
      const createResponse = await request(app)
        .post('/api/todos')
        .send({ title: 'Todo to Delete Twice' });

      const todoId = createResponse.body.id;

      await request(app)
        .delete(`/api/todos/${todoId}`)
        .expect(204);

      const response = await request(app)
        .delete(`/api/todos/${todoId}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Todo not found');
    });

    test('should not affect other todos when deleting one', async () => {
      const todo1 = await request(app).post('/api/todos').send({ title: 'Todo 1' });
      const todo2 = await request(app).post('/api/todos').send({ title: 'Todo 2' });
      const todo3 = await request(app).post('/api/todos').send({ title: 'Todo 3' });

      // Delete middle todo
      await request(app).delete(`/api/todos/${todo2.body.id}`).expect(204);

      // Verify other todos still exist
      await request(app).get(`/api/todos/${todo1.body.id}`).expect(200);
      await request(app).get(`/api/todos/${todo3.body.id}`).expect(200);

      // Verify total count
      const response = await request(app).get('/api/todos').expect(200);
      expect(response.body.length).toBe(2);
    });
  });

  describe('HTTP Status Codes', () => {
    test('POST should return 201 on successful creation', async () => {
      await request(app)
        .post('/api/todos')
        .send({ title: 'Test Todo' })
        .expect(201);
    });

    test('GET should return 200 on success', async () => {
      await request(app)
        .get('/api/todos')
        .expect(200);
    });

    test('PUT should return 200 on successful update', async () => {
      const createResponse = await request(app)
        .post('/api/todos')
        .send({ title: 'Test Todo' });

      await request(app)
        .put(`/api/todos/${createResponse.body.id}`)
        .send({ title: 'Updated' })
        .expect(200);
    });

    test('DELETE should return 204 on successful deletion', async () => {
      const createResponse = await request(app)
        .post('/api/todos')
        .send({ title: 'Test Todo' });

      await request(app)
        .delete(`/api/todos/${createResponse.body.id}`)
        .expect(204);
    });

    test('should return 404 for non-existent resources', async () => {
      await request(app).get('/api/todos/99999').expect(404);
      await request(app).put('/api/todos/99999').send({ title: 'Test' }).expect(404);
      await request(app).delete('/api/todos/99999').expect(404);
    });

    test('should return 400 for validation errors', async () => {
      await request(app).post('/api/todos').send({}).expect(400);
      await request(app).post('/api/todos').send({ title: 'a'.repeat(201) }).expect(400);
      await request(app).get('/api/todos?status=invalid').expect(400);
    });
  });
});
