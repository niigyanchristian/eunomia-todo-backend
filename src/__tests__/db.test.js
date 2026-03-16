/**
 * Database module tests
 * Tests for SQLite database initialization and schema
 */

const fs = require('fs');
const path = require('path');
describe('Database Module', () => {
  const testDbPath = path.join(__dirname, '..', '..', 'todo.db');

  // Clean up before all tests
  beforeAll(() => {
    // Remove database file if it exists
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (error) {
        // Ignore if file is locked
      }
    }

    // Clear module cache to force fresh database connection
    delete require.cache[require.resolve('../db')];
  });

  // Clean up after all tests
  afterAll(() => {
    // Clean up test database file
    // Note: The file may be locked by the database connection, which is expected
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (error) {
        // Silently ignore - file may be locked by active database connection
      }
    }
  });

  describe('Database Initialization', () => {
    test('should create database file on initialization', () => {
      // Remove database file if it exists
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }

      // Require the module - this should create the database
      const dbModule = require('../db.js');

      // Check if database file was created
      expect(fs.existsSync(testDbPath)).toBe(true);

      // Database should be open
      expect(dbModule.db.open).toBe(true);
    });

    test('should export db instance', () => {
      const dbModule = require('../db.js');

      expect(dbModule).toHaveProperty('db');
      expect(dbModule.db).toBeDefined();
      expect(typeof dbModule.db).toBe('object');
    });

    test('should export initDatabase function', () => {
      const dbModule = require('../db.js');

      expect(dbModule).toHaveProperty('initDatabase');
      expect(typeof dbModule.initDatabase).toBe('function');
    });
  });

  describe('Database Schema', () => {
    test('should create todos table with correct schema', () => {
      const dbModule = require('../db.js');

      // Query table info
      const tableInfo = dbModule.db.pragma('table_info(todos)');

      // Verify all columns exist
      expect(tableInfo.length).toBe(6);

      // Check id column
      const idCol = tableInfo.find(col => col.name === 'id');
      expect(idCol).toBeDefined();
      expect(idCol.type).toBe('INTEGER');
      expect(idCol.pk).toBe(1); // PRIMARY KEY

      // Check title column
      const titleCol = tableInfo.find(col => col.name === 'title');
      expect(titleCol).toBeDefined();
      expect(titleCol.type).toBe('TEXT');
      expect(titleCol.notnull).toBe(1); // NOT NULL

      // Check description column
      const descCol = tableInfo.find(col => col.name === 'description');
      expect(descCol).toBeDefined();
      expect(descCol.type).toBe('TEXT');

      // Check completed column
      const completedCol = tableInfo.find(col => col.name === 'completed');
      expect(completedCol).toBeDefined();
      expect(completedCol.type).toBe('BOOLEAN');

      // Check created_at column
      const createdCol = tableInfo.find(col => col.name === 'created_at');
      expect(createdCol).toBeDefined();
      expect(createdCol.type).toBe('DATETIME');

      // Check updated_at column
      const updatedCol = tableInfo.find(col => col.name === 'updated_at');
      expect(updatedCol).toBeDefined();
      expect(updatedCol.type).toBe('DATETIME');
    });

    test('should handle initDatabase being called multiple times', () => {
      const dbModule = require('../db.js');

      // Get initial table count
      const beforeCount = dbModule.db.prepare('SELECT COUNT(*) as count FROM todos').get();

      // Call initDatabase again - should not throw error
      expect(() => {
        dbModule.initDatabase();
      }).not.toThrow();

      // Table should still exist with same data
      const tableInfo = dbModule.db.pragma('table_info(todos)');
      expect(tableInfo.length).toBe(6);

      // No data should be lost
      const afterCount = dbModule.db.prepare('SELECT COUNT(*) as count FROM todos').get();
      expect(afterCount.count).toBe(beforeCount.count);
    });
  });

  describe('Database Operations', () => {
    test('should allow basic CRUD operations on todos table', () => {
      const dbModule = require('../db.js');

      // Insert a todo
      const insertStmt = dbModule.db.prepare(
        'INSERT INTO todos (title, description, completed) VALUES (?, ?, ?)'
      );
      const result = insertStmt.run('Test Todo', 'Test Description', 0);

      expect(result.changes).toBe(1);
      expect(result.lastInsertRowid).toBeDefined();

      // Read the todo
      const selectStmt = dbModule.db.prepare('SELECT * FROM todos WHERE id = ?');
      const todo = selectStmt.get(result.lastInsertRowid);

      expect(todo).toBeDefined();
      expect(todo.title).toBe('Test Todo');
      expect(todo.description).toBe('Test Description');
      expect(todo.completed).toBe(0);
      expect(todo.created_at).toBeDefined();
      expect(todo.updated_at).toBeDefined();

      // Update the todo
      const updateStmt = dbModule.db.prepare(
        'UPDATE todos SET completed = ? WHERE id = ?'
      );
      const updateResult = updateStmt.run(1, result.lastInsertRowid);
      expect(updateResult.changes).toBe(1);

      // Verify update
      const updatedTodo = selectStmt.get(result.lastInsertRowid);
      expect(updatedTodo.completed).toBe(1);

      // Delete the todo
      const deleteStmt = dbModule.db.prepare('DELETE FROM todos WHERE id = ?');
      const deleteResult = deleteStmt.run(result.lastInsertRowid);
      expect(deleteResult.changes).toBe(1);

      // Verify deletion
      const deletedTodo = selectStmt.get(result.lastInsertRowid);
      expect(deletedTodo).toBeUndefined();
    });

    test('should enforce NOT NULL constraint on title', () => {
      const dbModule = require('../db.js');

      const insertStmt = dbModule.db.prepare(
        'INSERT INTO todos (title, description, completed) VALUES (?, ?, ?)'
      );

      // Try to insert without title (null)
      expect(() => {
        insertStmt.run(null, 'Test Description', 0);
      }).toThrow();
    });

    test('should use default values for optional fields', () => {
      const dbModule = require('../db.js');

      const insertStmt = dbModule.db.prepare(
        'INSERT INTO todos (title) VALUES (?)'
      );
      const result = insertStmt.run('Test Todo');

      const selectStmt = dbModule.db.prepare('SELECT * FROM todos WHERE id = ?');
      const todo = selectStmt.get(result.lastInsertRowid);

      expect(todo.description).toBe('');
      expect(todo.completed).toBe(0);
      expect(todo.created_at).toBeDefined();
      expect(todo.updated_at).toBeDefined();

      // Clean up
      const deleteStmt = dbModule.db.prepare('DELETE FROM todos WHERE id = ?');
      deleteStmt.run(result.lastInsertRowid);
    });
  });
});
