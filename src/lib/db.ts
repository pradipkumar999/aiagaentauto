import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    website TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS affiliate_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    link TEXT NOT NULL,
    audience TEXT,
    commission TEXT
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    product_id INTEGER,
    daily_limit INTEGER DEFAULT 50,
    status TEXT DEFAULT 'active',
    FOREIGN KEY (product_id) REFERENCES affiliate_products (id)
  );

  CREATE TABLE IF NOT EXISTS emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER,
    campaign_id INTEGER,
    smtp_id INTEGER,
    subject TEXT,
    content TEXT,
    status TEXT DEFAULT 'pending',
    sent_at DATETIME,
    FOREIGN KEY (contact_id) REFERENCES contacts (id),
    FOREIGN KEY (campaign_id) REFERENCES campaigns (id),
    FOREIGN KEY (smtp_id) REFERENCES smtps (id)
  );

  CREATE TABLE IF NOT EXISTS replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER,
    email_id INTEGER,
    message TEXT,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contact_id) REFERENCES contacts (id),
    FOREIGN KEY (email_id) REFERENCES emails (id)
  );

  CREATE TABLE IF NOT EXISTS smtps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    user TEXT NOT NULL,
    pass TEXT NOT NULL,
    from_name TEXT,
    from_email TEXT NOT NULL,
    secure BOOLEAN DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    gemini_api_key TEXT,
    gemini_model TEXT DEFAULT 'gemini-1.5-flash',
    daily_email_limit INTEGER DEFAULT 50,
    default_tone TEXT DEFAULT 'friendly',
    jwt_secret TEXT
  );

  -- Migration for existing DB
  PRAGMA table_info(settings);
`);

try {
  db.exec("ALTER TABLE settings ADD COLUMN gemini_model TEXT DEFAULT 'gemini-1.5-flash';");
} catch { }
try {
  db.exec("ALTER TABLE settings ADD COLUMN smtp_from_name TEXT;");
} catch { }
try {
  db.exec("ALTER TABLE settings ADD COLUMN smtp_secure BOOLEAN DEFAULT 0;");
} catch { }
try {
  db.exec("ALTER TABLE emails ADD COLUMN opened INTEGER DEFAULT 0;");
} catch { }
try {
  db.exec("ALTER TABLE emails ADD COLUMN clicked INTEGER DEFAULT 0;");
} catch { }
try {
  db.exec("ALTER TABLE emails ADD COLUMN tracking_id TEXT;");
} catch { }
try {
  db.exec("ALTER TABLE emails ADD COLUMN follow_up_sent BOOLEAN DEFAULT 0;");
} catch { }
try {
  db.exec("ALTER TABLE settings ADD COLUMN jwt_secret TEXT;");
} catch { }

db.exec(`
  -- Insert default settings row if not exists
  INSERT OR IGNORE INTO settings (id, jwt_secret) VALUES (1, '${Math.random().toString(36).substring(2, 15)}');
  
  -- Insert initial user
  INSERT OR IGNORE INTO users (email, password) VALUES ('pradipchoudhary11@gmail.com', 'password');
`);

export default db;
