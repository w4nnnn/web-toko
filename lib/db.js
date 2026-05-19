import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";

sqlite3.verbose();

const projectRoot = process.cwd();

function resolveAbsolute(targetPath) {
  return path.isAbsolute(targetPath) ? targetPath : path.join(projectRoot, targetPath);
}

const envDbDir = process.env.DATABASE_DIR;
const envDbFile = process.env.DATABASE_FILE;
const DEFAULT_DB_PATH = path.join(resolveAbsolute(envDbDir), envDbFile);
let db = null;

const RUNTIME_SCHEMA_TABLES = [
  {
    table: "users",
    createSQL: `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      no_hp TEXT,
      is_online INTEGER NOT NULL DEFAULT 0 CHECK (is_online IN (0,1)),
      last_active DATETIME
    );`,
  },
  {
    table: "avatar",
    createSQL: `CREATE TABLE IF NOT EXISTS avatar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      image_path TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );`,
  },
  {
    table: "categories",
    createSQL: `CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );`,
  },
  {
    table: "products",
    createSQL: `CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      image_path TEXT,
      category_id INTEGER,
      show_stock INTEGER NOT NULL DEFAULT 1 CHECK (show_stock IN (0,1)),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL
    );`,
  },
  {
    table: "app_settings",
    createSQL: `CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
  },
  {
    table: "product_units",
    createSQL: `CREATE TABLE IF NOT EXISTS product_units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      unit_name TEXT NOT NULL,
      qty_per_unit REAL NOT NULL DEFAULT 1,
      price REAL NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
    );`,
  },
  {
    table: "discount",
    createSQL: `CREATE TABLE IF NOT EXISTS discount (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      value_type TEXT NOT NULL DEFAULT 'percentage',
      value REAL NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
      type TEXT NOT NULL DEFAULT 'product',
      start_at DATETIME,
      end_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
  },
  {
    table: "discount_products",
    createSQL: `CREATE TABLE IF NOT EXISTS discount_products (
      discount_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      FOREIGN KEY (discount_id) REFERENCES discount(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );`,
  },
  {
    table: "discount_units",
    createSQL: `CREATE TABLE IF NOT EXISTS discount_units (
      discount_id INTEGER NOT NULL,
      unit_id INTEGER NOT NULL,
      FOREIGN KEY (discount_id) REFERENCES discount(id) ON DELETE CASCADE,
      FOREIGN KEY (unit_id) REFERENCES product_units(id) ON DELETE CASCADE
    );`,
  },
  {
    table: "discount_tiers",
    createSQL: `CREATE TABLE IF NOT EXISTS discount_tiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discount_id INTEGER NOT NULL,
      label TEXT,
      min_quantity INTEGER,
      max_quantity INTEGER,
      min_amount REAL,
      max_amount REAL,
      value_type TEXT NOT NULL,
      value REAL NOT NULL DEFAULT 0,
      priority INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (discount_id) REFERENCES discount(id) ON DELETE CASCADE
    );`,
  },
  {
    table: "cart",
    createSQL: `CREATE TABLE IF NOT EXISTS cart (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      unit_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (unit_id) REFERENCES product_units(id) ON DELETE CASCADE
    );`,
  },
  {
    table: "payment_methods",
    createSQL: `CREATE TABLE IF NOT EXISTS payment_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment TEXT NOT NULL,
      no_payment TEXT,
      image_path TEXT
    );`,
  },
  {
    table: "orders",
    createSQL: `CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      order_number TEXT NOT NULL UNIQUE,
      total_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'menunggu',
      payment_id INTEGER NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'belum_bayar',
      proof_payment_path TEXT,
      shipping_type TEXT NOT NULL DEFAULT 'delivery',
      shipping_address TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (payment_id) REFERENCES payment_methods(id) ON DELETE CASCADE
    );`,
  },
  {
    table: "order_items",
    createSQL: `CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      unit_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      unit_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      discount_amount REAL NOT NULL DEFAULT 0,
      total_price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (unit_id) REFERENCES product_units(id) ON DELETE SET NULL
    );`,
  },
  {
    table: "chat",
    createSQL: `CREATE TABLE IF NOT EXISTS chat (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id INTEGER NOT NULL,
      to_user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
    );`,
  },
  {
    table: "brands",
    createSQL: `CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      logo TEXT
    );`,
  },
];

const RUNTIME_SCHEMA_COLUMNS = [
  {
    table: "users",
    column: "name",
    alterSQL: "ALTER TABLE users ADD COLUMN name TEXT",
  },
  {
    table: "users",
    column: "username",
    alterSQL: "ALTER TABLE users ADD COLUMN username TEXT",
  },
  {
    table: "users",
    column: "password",
    alterSQL: "ALTER TABLE users ADD COLUMN password TEXT",
  },
  {
    table: "users",
    column: "role",
    alterSQL: "ALTER TABLE users ADD COLUMN role TEXT",
  },
  {
    table: "users",
    column: "no_hp",
    alterSQL: "ALTER TABLE users ADD COLUMN no_hp TEXT",
  },
  {
    table: "products",
    column: "name",
    alterSQL: "ALTER TABLE products ADD COLUMN name TEXT",
  },
  {
    table: "products",
    column: "description",
    alterSQL: "ALTER TABLE products ADD COLUMN description TEXT",
  },
  {
    table: "products",
    column: "image_path",
    alterSQL: "ALTER TABLE products ADD COLUMN image_path TEXT",
  },
  {
    table: "products",
    column: "category_id",
    alterSQL: "ALTER TABLE products ADD COLUMN category_id INTEGER",
  },
  {
    table: "products",
    column: "show_stock",
    alterSQL: "ALTER TABLE products ADD COLUMN show_stock INTEGER NOT NULL DEFAULT 1 CHECK (show_stock IN (0,1))",
  },
  {
    table: "products",
    column: "created_at",
    alterSQL: "ALTER TABLE products ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP",
  },
  {
    table: "products",
    column: "updated_at",
    alterSQL: "ALTER TABLE products ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP",
  },
  {
    table: "users",
    column: "is_online",
    alterSQL: "ALTER TABLE users ADD COLUMN is_online INTEGER NOT NULL DEFAULT 0 CHECK (is_online IN (0,1))",
  },
  {
    table: "users",
    column: "last_active",
    alterSQL: "ALTER TABLE users ADD COLUMN last_active DATETIME",
  },
  {
    table: "avatar",
    column: "user_id",
    alterSQL: "ALTER TABLE avatar ADD COLUMN user_id INTEGER",
  },
  {
    table: "avatar",
    column: "image_path",
    alterSQL: "ALTER TABLE avatar ADD COLUMN image_path TEXT",
  },
  {
    table: "categories",
    column: "name",
    alterSQL: "ALTER TABLE categories ADD COLUMN name TEXT",
  },
  {
    table: "product_units",
    column: "product_id",
    alterSQL: "ALTER TABLE product_units ADD COLUMN product_id INTEGER",
  },
  {
    table: "product_units",
    column: "unit_name",
    alterSQL: "ALTER TABLE product_units ADD COLUMN unit_name TEXT",
  },
  {
    table: "product_units",
    column: "qty_per_unit",
    alterSQL: "ALTER TABLE product_units ADD COLUMN qty_per_unit REAL NOT NULL DEFAULT 1",
  },
  {
    table: "product_units",
    column: "price",
    alterSQL: "ALTER TABLE product_units ADD COLUMN price REAL NOT NULL DEFAULT 0",
  },
  {
    table: "product_units",
    column: "stock",
    alterSQL: "ALTER TABLE product_units ADD COLUMN stock INTEGER NOT NULL DEFAULT 0",
  },
  {
    table: "discount",
    column: "name",
    alterSQL: "ALTER TABLE discount ADD COLUMN name TEXT",
  },
  {
    table: "discount",
    column: "value_type",
    alterSQL: "ALTER TABLE discount ADD COLUMN value_type TEXT NOT NULL DEFAULT 'percentage'",
  },
  {
    table: "discount",
    column: "value",
    alterSQL: "ALTER TABLE discount ADD COLUMN value REAL NOT NULL DEFAULT 0",
  },
  {
    table: "discount",
    column: "active",
    alterSQL: "ALTER TABLE discount ADD COLUMN active BOOLEAN NOT NULL DEFAULT 1 CHECK (active IN (0,1))",
  },
  {
    table: "discount",
    column: "type",
    alterSQL: "ALTER TABLE discount ADD COLUMN type TEXT NOT NULL DEFAULT 'product'",
  },
  {
    table: "discount",
    column: "start_at",
    alterSQL: "ALTER TABLE discount ADD COLUMN start_at DATETIME",
  },
  {
    table: "discount",
    column: "end_at",
    alterSQL: "ALTER TABLE discount ADD COLUMN end_at DATETIME",
  },
  {
    table: "discount",
    column: "created_at",
    alterSQL: "ALTER TABLE discount ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP",
  },
  {
    table: "app_settings",
    column: "value",
    alterSQL: "ALTER TABLE app_settings ADD COLUMN value TEXT",
  },
  {
    table: "app_settings",
    column: "updated_at",
    alterSQL: "ALTER TABLE app_settings ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP",
  },
  {
    table: "discount_products",
    column: "discount_id",
    alterSQL: "ALTER TABLE discount_products ADD COLUMN discount_id INTEGER",
  },
  {
    table: "discount_products",
    column: "product_id",
    alterSQL: "ALTER TABLE discount_products ADD COLUMN product_id INTEGER",
  },
  {
    table: "discount_units",
    column: "discount_id",
    alterSQL: "ALTER TABLE discount_units ADD COLUMN discount_id INTEGER",
  },
  {
    table: "discount_units",
    column: "unit_id",
    alterSQL: "ALTER TABLE discount_units ADD COLUMN unit_id INTEGER",
  },
  {
    table: "discount_tiers",
    column: "discount_id",
    alterSQL: "ALTER TABLE discount_tiers ADD COLUMN discount_id INTEGER",
  },
  {
    table: "discount_tiers",
    column: "label",
    alterSQL: "ALTER TABLE discount_tiers ADD COLUMN label TEXT",
  },
  {
    table: "discount_tiers",
    column: "min_quantity",
    alterSQL: "ALTER TABLE discount_tiers ADD COLUMN min_quantity INTEGER",
  },
  {
    table: "discount_tiers",
    column: "max_quantity",
    alterSQL: "ALTER TABLE discount_tiers ADD COLUMN max_quantity INTEGER",
  },
  {
    table: "discount_tiers",
    column: "min_amount",
    alterSQL: "ALTER TABLE discount_tiers ADD COLUMN min_amount REAL",
  },
  {
    table: "discount_tiers",
    column: "max_amount",
    alterSQL: "ALTER TABLE discount_tiers ADD COLUMN max_amount REAL",
  },
  {
    table: "discount_tiers",
    column: "value_type",
    alterSQL: "ALTER TABLE discount_tiers ADD COLUMN value_type TEXT",
  },
  {
    table: "discount_tiers",
    column: "value",
    alterSQL: "ALTER TABLE discount_tiers ADD COLUMN value REAL NOT NULL DEFAULT 0",
  },
  {
    table: "discount_tiers",
    column: "priority",
    alterSQL: "ALTER TABLE discount_tiers ADD COLUMN priority INTEGER NOT NULL DEFAULT 0",
  },
  {
    table: "cart",
    column: "user_id",
    alterSQL: "ALTER TABLE cart ADD COLUMN user_id INTEGER",
  },
  {
    table: "cart",
    column: "unit_id",
    alterSQL: "ALTER TABLE cart ADD COLUMN unit_id INTEGER",
  },
  {
    table: "cart",
    column: "quantity",
    alterSQL: "ALTER TABLE cart ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1",
  },
  {
    table: "cart",
    column: "created_at",
    alterSQL: "ALTER TABLE cart ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP",
  },
  {
    table: "cart",
    column: "updated_at",
    alterSQL: "ALTER TABLE cart ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP",
  },
  {
    table: "payment_methods",
    column: "payment",
    alterSQL: "ALTER TABLE payment_methods ADD COLUMN payment TEXT",
  },
  {
    table: "payment_methods",
    column: "no_payment",
    alterSQL: "ALTER TABLE payment_methods ADD COLUMN no_payment TEXT",
  },
  {
    table: "payment_methods",
    column: "image_path",
    alterSQL: "ALTER TABLE payment_methods ADD COLUMN image_path TEXT",
  },
  {
    table: "orders",
    column: "user_id",
    alterSQL: "ALTER TABLE orders ADD COLUMN user_id INTEGER",
  },
  {
    table: "orders",
    column: "order_number",
    alterSQL: "ALTER TABLE orders ADD COLUMN order_number TEXT",
  },
  {
    table: "orders",
    column: "total_amount",
    alterSQL: "ALTER TABLE orders ADD COLUMN total_amount REAL NOT NULL DEFAULT 0",
  },
  {
    table: "orders",
    column: "status",
    alterSQL: "ALTER TABLE orders ADD COLUMN status TEXT NOT NULL DEFAULT 'menunggu'",
  },
  {
    table: "orders",
    column: "payment_id",
    alterSQL: "ALTER TABLE orders ADD COLUMN payment_id INTEGER",
  },
  {
    table: "orders",
    column: "payment_status",
    alterSQL: "ALTER TABLE orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'belum_bayar'",
  },
  {
    table: "orders",
    column: "proof_payment_path",
    alterSQL: "ALTER TABLE orders ADD COLUMN proof_payment_path TEXT",
  },
  {
    table: "orders",
    column: "shipping_type",
    alterSQL: "ALTER TABLE orders ADD COLUMN shipping_type TEXT NOT NULL DEFAULT 'delivery'",
  },
  {
    table: "orders",
    column: "shipping_address",
    alterSQL: "ALTER TABLE orders ADD COLUMN shipping_address TEXT",
  },
  {
    table: "orders",
    column: "notes",
    alterSQL: "ALTER TABLE orders ADD COLUMN notes TEXT",
  },
  {
    table: "orders",
    column: "created_at",
    alterSQL: "ALTER TABLE orders ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP",
  },
  {
    table: "orders",
    column: "updated_at",
    alterSQL: "ALTER TABLE orders ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP",
  },
  {
    table: "order_items",
    column: "order_id",
    alterSQL: "ALTER TABLE order_items ADD COLUMN order_id INTEGER",
  },
  {
    table: "order_items",
    column: "unit_id",
    alterSQL: "ALTER TABLE order_items ADD COLUMN unit_id INTEGER",
  },
  {
    table: "order_items",
    column: "product_name",
    alterSQL: "ALTER TABLE order_items ADD COLUMN product_name TEXT",
  },
  {
    table: "order_items",
    column: "unit_name",
    alterSQL: "ALTER TABLE order_items ADD COLUMN unit_name TEXT",
  },
  {
    table: "order_items",
    column: "quantity",
    alterSQL: "ALTER TABLE order_items ADD COLUMN quantity INTEGER",
  },
  {
    table: "order_items",
    column: "unit_price",
    alterSQL: "ALTER TABLE order_items ADD COLUMN unit_price REAL",
  },
  {
    table: "order_items",
    column: "discount_amount",
    alterSQL: "ALTER TABLE order_items ADD COLUMN discount_amount REAL NOT NULL DEFAULT 0",
  },
  {
    table: "order_items",
    column: "total_price",
    alterSQL: "ALTER TABLE order_items ADD COLUMN total_price REAL",
  },
  {
    table: "chat",
    column: "from_user_id",
    alterSQL: "ALTER TABLE chat ADD COLUMN from_user_id INTEGER",
  },
  {
    table: "chat",
    column: "to_user_id",
    alterSQL: "ALTER TABLE chat ADD COLUMN to_user_id INTEGER",
  },
  {
    table: "chat",
    column: "message",
    alterSQL: "ALTER TABLE chat ADD COLUMN message TEXT",
  },
  {
    table: "chat",
    column: "created_at",
    alterSQL: "ALTER TABLE chat ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP",
  },
  {
    table: "brands",
    column: "name",
    alterSQL: "ALTER TABLE brands ADD COLUMN name TEXT",
  },
  {
    table: "brands",
    column: "logo",
    alterSQL: "ALTER TABLE brands ADD COLUMN logo TEXT",
  },
];

function isSafeIdentifier(value) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(value || ""));
}

function dbExecRaw(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function dbAllRaw(sql) {
  return new Promise((resolve, reject) => {
    db.all(sql, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

async function ensureTable(table, createSQL) {
  if (!isSafeIdentifier(table)) {
    throw new Error(`Unsafe table name in migration: ${table}`);
  }
  await dbExecRaw(createSQL);
}

async function ensureColumn(table, column, alterSQL) {
  if (!isSafeIdentifier(table) || !isSafeIdentifier(column)) {
    throw new Error(`Unsafe identifier in migration: ${table}.${column}`);
  }

  const cols = await dbAllRaw(`PRAGMA table_info(${table})`);
  const exists = Array.isArray(cols) && cols.some((c) => c?.name === column);
  if (!exists) {
    await dbExecRaw(alterSQL);
  }
}

async function applyRuntimeMigrations() {
  for (const t of RUNTIME_SCHEMA_TABLES) {
    try {
      await ensureTable(t.table, t.createSQL);
    } catch (err) {
      console.warn(`Migration warning (table ${t.table}):`, err);
    }
  }

  for (const c of RUNTIME_SCHEMA_COLUMNS) {
    try {
      await ensureColumn(c.table, c.column, c.alterSQL);
    } catch (err) {
      console.warn(`Migration warning (column ${c.table}.${c.column}):`, err);
    }
  }
}

/**
 * Inisialisasi koneksi SQLite.
 * - Membuat folder jika belum ada
 * - Membuka file DB
 * - Menjalankan PRAGMA optimasi (WAL, foreign_keys, busy_timeout, dll)
 * @param {string} [dbPath]
 * @returns {Promise<sqlite3.Database>}
 */
export function init(dbPath = DEFAULT_DB_PATH) {
  const targetDbPath = resolveAbsolute(dbPath ?? DEFAULT_DB_PATH);
  if (db) return Promise.resolve(db);

  const dir = path.dirname(targetDbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(targetDbPath, (err) => {
      if (err) {
        db = null;
        return reject(err);
      }

      // PRAGMA yang direkomendasikan untuk performa dan konsistensi
      const pragmas = [
        "PRAGMA foreign_keys = ON",         // aktifkan foreign key
        "PRAGMA journal_mode = WAL",        // WAL memperbaiki concurrency
        "PRAGMA wal_autocheckpoint = 1000", // checkpoint period
        "PRAGMA synchronous = NORMAL",      // performa yg baik untuk WAL
        "PRAGMA temp_store = MEMORY",       // simpan temp di memory
        "PRAGMA cache_size = -2000",        // cache ~2MB (negatif = KB)
        "PRAGMA busy_timeout = 5000"        // tunggu 5s saat DB busy
      ].join("; ");

      db.exec(pragmas, (pErr) => {
        if (pErr) {
          // jangan gagal total jika PRAGMA bermasalah, hanya log
          console.warn("PRAGMA setup warning:", pErr);
        }

        applyRuntimeMigrations()
          .then(() => resolve(db))
          .catch((mErr) => {
            console.warn("Runtime migration warning:", mErr);
            resolve(db);
          });
      });
    });
  });
}

/**
 * Jalankan pernyataan (INSERT/UPDATE/DELETE)
 */
export function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("Database not initialized. Call init() first."));
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

/**
 * Ambil satu baris
 */
export function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("Database not initialized. Call init() first."));
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

/**
 * Ambil semua baris
 */
export function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("Database not initialized. Call init() first."));
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

/**
 * Eksekusi beberapa statement (no result)
 */
export function exec(sql) {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("Database not initialized. Call init() first."));
    db.exec(sql, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

/**
 * Optimasi database:
 * - PRAGMA optimize (jika tersedia)
 * - ANALYZE untuk update statistik query planner
 * - VACUUM untuk defragmentasi (opsional, bisa mahal => gunakan secara terjadwal)
 */
export function optimize({ vacuum = false } = {}) {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("Database not initialized. Call init() first."));
    const steps = ["PRAGMA optimize", "ANALYZE"];
    if (vacuum) steps.push("VACUUM");
    const sql = steps.join("; ");
    db.exec(sql, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

/**
 * Tutup koneksi DB
 */
export function close() {
  return new Promise((resolve, reject) => {
    if (!db) return resolve();
    db.close((err) => {
      if (err) return reject(err);
      db = null;
      resolve();
    });
  });
}