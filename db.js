const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'repairs.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id          TEXT PRIMARY KEY,
    num         INTEGER NOT NULL,
    dateIn      TEXT,
    status      TEXT,
    category    TEXT,
    brand       TEXT,
    colour      TEXT,
    condition   TEXT,
    faultDesc   TEXT,
    repairNotes TEXT,
    hoursSpent  REAL    DEFAULT 0,
    buyPrice    REAL    DEFAULT 0,
    postageIn   REAL    DEFAULT 0,
    partsCost   REAL    DEFAULT 0,
    estSalePrice REAL   DEFAULT 0,
    estProfit   REAL    DEFAULT 0,
    saleVenue   TEXT    DEFAULT '',
    listedEbay  INTEGER DEFAULT 0,
    listedVinted INTEGER DEFAULT 0,
    listedFacebook INTEGER DEFAULT 0,
    listedCEX   INTEGER DEFAULT 0,
    listedOther INTEGER DEFAULT 0,
    ebayItemNum TEXT    DEFAULT '',
    saleDate    TEXT    DEFAULT '',
    salePrice   REAL    DEFAULT 0,
    feesPost    REAL    DEFAULT 0,
    netProfit   REAL    DEFAULT 0,
    margin      REAL    DEFAULT 0,
    createdAt   TEXT    DEFAULT (datetime('now')),
    updatedAt   TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Initialise counter
if (!db.prepare("SELECT value FROM meta WHERE key='nextNum'").get()) {
  db.prepare("INSERT INTO meta (key,value) VALUES ('nextNum','1')").run();
}

// SQLite stores booleans as 0/1 — convert on the way out
function boolify(row) {
  if (!row) return row;
  const r = { ...row };
  for (const k of ['listedEbay','listedVinted','listedFacebook','listedCEX','listedOther']) {
    r[k] = !!r[k];
  }
  return r;
}

function intify(obj) {
  const r = { ...obj };
  for (const k of ['listedEbay','listedVinted','listedFacebook','listedCEX','listedOther']) {
    if (k in r) r[k] = r[k] ? 1 : 0;
  }
  return r;
}

const ITEM_COLS = [
  'id','num','dateIn','status','category','brand','colour','condition',
  'faultDesc','repairNotes','hoursSpent','buyPrice','postageIn','partsCost',
  'estSalePrice','estProfit','saleVenue','listedEbay','listedVinted',
  'listedFacebook','listedCEX','listedOther','ebayItemNum','saleDate',
  'salePrice','feesPost','netProfit','margin',
];

const INSERT_STMT = db.prepare(`
  INSERT OR REPLACE INTO items (${ITEM_COLS.join(',')})
  VALUES (${ITEM_COLS.map(c => '@'+c).join(',')})
`);

module.exports = {
  getAllItems() {
    return db.prepare('SELECT * FROM items ORDER BY num ASC').all().map(boolify);
  },

  getItem(id) {
    return boolify(db.prepare('SELECT * FROM items WHERE id=?').get(id));
  },

  createItem(data) {
    const row = intify(data);
    ITEM_COLS.forEach(k => { if (!(k in row)) row[k] = null; });
    INSERT_STMT.run(row);
    return this.getItem(data.id);
  },

  updateItem(id, data) {
    const row = intify(data);
    const setCols = Object.keys(row).filter(k => k !== 'id' && ITEM_COLS.includes(k));
    if (!setCols.length) return this.getItem(id);
    const sql = `UPDATE items SET ${setCols.map(k => `${k}=@${k}`).join(',')}, updatedAt=datetime('now') WHERE id=@id`;
    db.prepare(sql).run({ ...row, id });
    return this.getItem(id);
  },

  deleteItem(id) {
    db.prepare('DELETE FROM items WHERE id=?').run(id);
  },

  getNextNum() {
    return parseInt(db.prepare("SELECT value FROM meta WHERE key='nextNum'").get().value);
  },

  consumeNextNum() {
    const n = this.getNextNum();
    db.prepare("UPDATE meta SET value=? WHERE key='nextNum'").run(String(n + 1));
    return n;
  },

  // Used by seed script
  setCounter(n) {
    db.prepare("INSERT OR REPLACE INTO meta (key,value) VALUES ('nextNum',?)").run(String(n));
  },
};
