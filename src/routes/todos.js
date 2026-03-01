/**
 * Todos API Routes
 * REST endpoints for CRUD operations on todos
 */

const express = require('express');
const router = express.Router();
const { db } = require('../db');

/**
 * Validation helper for todo title
 */
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

/**
 * Validation helper for completed boolean
 */
function validateCompleted(completed) {
  if (completed === undefined || completed === null) {
    return { valid: true, value: completed };
  }

  if (typeof completed === 'boolean') {
    return { valid: true, value: completed };
  }

  // Accept 0/1 as boolean
  if (completed === 0 || completed === 1) {
    return { valid: true, value: Boolean(completed) };
  }

  return { valid: false, error: 'Completed must be a boolean value' };
}

/**
 * GET /api/todos
 * List all todos with optional status filtering
 * Query params: ?status=active|completed
 */
router.get('/', (req, res) => {
  try {
    const { status } = req.query;

    let sql = 'SELECT * FROM todos';
    const params = [];

    // Add status filter if provided
    if (status === 'active') {
      sql += ' WHERE completed = 0';
    } else if (status === 'completed') {
      sql += ' WHERE completed = 1';
    } else if (status && status !== 'active' && status !== 'completed') {
      return res.status(400).json({
        error: 'Invalid status parameter. Must be "active" or "completed"'
      });
    }

    // Order by created_at DESC
    sql += ' ORDER BY created_at DESC';

    const stmt = db.prepare(sql);
    const todos = stmt.all(...params);

    // Convert completed from 0/1 to boolean
    const formattedTodos = todos.map(todo => ({
      ...todo,
      completed: Boolean(todo.completed)
    }));

    res.json(formattedTodos);
  } catch (error) {
    console.error('Error fetching todos:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/todos
 * Create a new todo
 * Body: { title: string, description?: string }
 */
router.post('/', (req, res) => {
  try {
    const { title, description } = req.body;

    // Validate title
    const titleValidation = validateTitle(title);
    if (!titleValidation.valid) {
      return res.status(400).json({ error: titleValidation.error });
    }

    // Insert new todo
    const sql = `
      INSERT INTO todos (title, description)
      VALUES (?, ?)
    `;

    const stmt = db.prepare(sql);
    const result = stmt.run(titleValidation.value, description || '');

    // Fetch the created todo
    const getTodo = db.prepare('SELECT * FROM todos WHERE id = ?');
    const newTodo = getTodo.get(result.lastInsertRowid);

    res.status(201).json({
      ...newTodo,
      completed: Boolean(newTodo.completed)
    });
  } catch (error) {
    console.error('Error creating todo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/todos/:id
 * Get a single todo by ID
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID is a number
    const todoId = parseInt(id, 10);
    if (isNaN(todoId)) {
      return res.status(400).json({ error: 'Invalid todo ID' });
    }

    const stmt = db.prepare('SELECT * FROM todos WHERE id = ?');
    const todo = stmt.get(todoId);

    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    res.json({
      ...todo,
      completed: Boolean(todo.completed)
    });
  } catch (error) {
    console.error('Error fetching todo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/todos/:id
 * Update a todo (partial update)
 * Body: { title?: string, description?: string, completed?: boolean }
 */
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, completed } = req.body;

    // Validate ID is a number
    const todoId = parseInt(id, 10);
    if (isNaN(todoId)) {
      return res.status(400).json({ error: 'Invalid todo ID' });
    }

    // Check if todo exists
    const checkStmt = db.prepare('SELECT * FROM todos WHERE id = ?');
    const existingTodo = checkStmt.get(todoId);

    if (!existingTodo) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    // Build update query dynamically based on provided fields
    const updates = [];
    const params = [];

    if (title !== undefined) {
      const titleValidation = validateTitle(title);
      if (!titleValidation.valid) {
        return res.status(400).json({ error: titleValidation.error });
      }
      updates.push('title = ?');
      params.push(titleValidation.value);
    }

    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description || '');
    }

    if (completed !== undefined) {
      const completedValidation = validateCompleted(completed);
      if (!completedValidation.valid) {
        return res.status(400).json({ error: completedValidation.error });
      }
      updates.push('completed = ?');
      params.push(completedValidation.value ? 1 : 0);
    }

    // Always update updated_at timestamp
    updates.push('updated_at = CURRENT_TIMESTAMP');

    if (updates.length === 1) {
      // Only updated_at would be updated, meaning no actual changes
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Execute update
    params.push(todoId);
    const sql = `UPDATE todos SET ${updates.join(', ')} WHERE id = ?`;
    const stmt = db.prepare(sql);
    stmt.run(...params);

    // Fetch updated todo
    const updatedTodo = checkStmt.get(todoId);

    res.json({
      ...updatedTodo,
      completed: Boolean(updatedTodo.completed)
    });
  } catch (error) {
    console.error('Error updating todo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/todos/:id
 * Delete a todo
 */
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID is a number
    const todoId = parseInt(id, 10);
    if (isNaN(todoId)) {
      return res.status(400).json({ error: 'Invalid todo ID' });
    }

    // Check if todo exists
    const checkStmt = db.prepare('SELECT * FROM todos WHERE id = ?');
    const existingTodo = checkStmt.get(todoId);

    if (!existingTodo) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    // Delete todo
    const stmt = db.prepare('DELETE FROM todos WHERE id = ?');
    stmt.run(todoId);

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting todo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
