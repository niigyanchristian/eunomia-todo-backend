/**
 * Database connection module
 * SQLite database setup using better-sqlite3
 */

const Database = require('better-sqlite3');
const path = require('path');

// Create database instance (auto-create todo.db file on first run)
const dbPath = path.join(__dirname, '..', 'todo.db');
const db = new Database(dbPath, { readonly: false, timeout: 5000 });

// Enable foreign keys for better-sqlite3
db.pragma('foreign_keys = ON');

/**
 * Initialize database tables
 * Creates the todos table with the required schema
 */
function initDatabase() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      completed BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  try {
    db.exec(createTableSQL);
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error.message);
    throw error;
  }
}

// Initialize database on module load
initDatabase();

module.exports = { db, initDatabase };
