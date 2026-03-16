/**
 * Database connection module
 * SQLite database setup using better-sqlite3
 */

const Database = require('better-sqlite3');
const path = require('path');

// Create database instance (auto-create todo.db file on first run)
const dbPath = path.join(__dirname, '..', 'todo.db');
let _db = new Database(dbPath);

/**
 * Initialize database tables on a given connection
 */
function initSchema(database) {
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
    database.pragma('foreign_keys = ON');
    database.exec(createTableSQL);
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error.message);
    throw error;
  }
}

/**
 * Reconnect to the database (e.g. after the file was replaced or deleted)
 */
function reconnect() {
  try { _db.close(); } catch (e) { /* ignore */ }
  _db = new Database(dbPath);
  initSchema(_db);
}

/**
 * Return a statement-like object that transparently retries on SQLITE_READONLY_DBMOVED
 */
function wrapStatement(sql) {
  function exec(method, args) {
    try {
      return _db.prepare(sql)[method](...args);
    } catch (e) {
      if (e.code === 'SQLITE_READONLY_DBMOVED') {
        reconnect();
        return _db.prepare(sql)[method](...args);
      }
      throw e;
    }
  }

  return {
    run(...args) { return exec('run', args); },
    get(...args) { return exec('get', args); },
    all(...args) { return exec('all', args); },
  };
}

/**
 * db object — wraps the underlying connection with reconnect logic.
 * _db is referenced by closure so reassignment in reconnect() is picked up automatically.
 */
const db = {
  prepare(sql) {
    return wrapStatement(sql);
  },
  exec(sql) {
    try { return _db.exec(sql); }
    catch (e) {
      if (e.code === 'SQLITE_READONLY_DBMOVED') { reconnect(); return _db.exec(sql); }
      throw e;
    }
  },
  pragma(...args) { return _db.pragma(...args); },
  get open() { return _db.open; },
  close() { return _db.close(); },
};

/**
 * Initialize database tables
 * Creates the todos table with the required schema
 */
function initDatabase() {
  initSchema(_db);
}

// Initialize database on module load
initSchema(_db);

module.exports = { db, initDatabase };
