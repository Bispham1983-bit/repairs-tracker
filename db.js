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
    recommendedVenue TEXT    DEFAULT '',
    createdAt   TEXT    DEFAULT (datetime('now')),
    updatedAt   TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id              TEXT PRIMARY KEY,
    num             INTEGER NOT NULL,
    dateIn          TEXT,
    customerName    TEXT,
    customerContact TEXT,
    device          TEXT,
    faults          TEXT,
    faultNotes      TEXT,
    quotedPrice     REAL DEFAULT 0,
    partsCost       REAL DEFAULT 0,
    mailIn          INTEGER DEFAULT 0,
    status          TEXT DEFAULT 'Checked In',
    paid            INTEGER DEFAULT 0,
    dateCompleted   TEXT,
    warrantyExpires TEXT,
    dateReceived    TEXT,
    datePostedBack  TEXT,
    notes           TEXT,
    createdAt       TEXT DEFAULT (datetime('now')),
    updatedAt       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Add new columns to existing DBs safely
try { db.exec("ALTER TABLE items ADD COLUMN recommendedVenue TEXT DEFAULT ''"); } catch(e) {}

// Initialise counter
if (!db.prepare("SELECT value FROM meta WHERE key='nextNum'").get()) {
  db.prepare("INSERT INTO meta (key,value) VALUES ('nextNum','1')").run();
}

// SQLite stores booleans as 0/1 — convert on the way out
function boolify(row) {
  if (!row) return row;
  const r = { ...row };

// Add new columns if they don't exist yet (safe on existing DBs)
['dateReceived','datePostedBack'].forEach(col => {
  try { db.prepare('ALTER TABLE jobs ADD COLUMN ' + col + ' TEXT').run(); } catch(e) {}
});
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
  'id','num','dateIn','status','category','brand','model','colour','condition',
  'faultDesc','repairNotes','hoursSpent','buyPrice','postageIn','partsCost',
  'estSalePrice','estProfit','saleVenue','listedEbay','listedVinted',
  'listedFacebook','listedCEX','listedOther','recommendedVenue','ebayItemNum','saleDate',
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
    // Always use MAX(num)+1 so deletions don't leave gaps in the counter
    const row = db.prepare("SELECT COALESCE(MAX(num), 0) + 1 AS next FROM items").get();
    return row.next;
  },

  // ── Jobs ──────────────────────────────────────────────────
  getAllJobs() {
    return db.prepare('SELECT * FROM jobs ORDER BY num ASC').all().map(j => ({...j, paid: !!j.paid, mailIn: !!j.mailIn}));
  },

  getJob(id) {
    const j = db.prepare('SELECT * FROM jobs WHERE id=?').get(id);
    return j ? {...j, paid: !!j.paid, mailIn: !!j.mailIn} : null;
  },

  createJob(data) {
    const num = db.prepare("SELECT COALESCE(MAX(num),0)+1 AS next FROM jobs").get().next;
    const id  = 'job-' + String(num).padStart(3,'0');
    const row = {
      id, num,
      dateIn:          data.dateIn          || new Date().toISOString().slice(0,10),
      customerName:    data.customerName    || '',
      customerContact: data.customerContact || '',
      device:          data.device          || '',
      faults:          data.faults          || '',
      faultNotes:      data.faultNotes      || '',
      quotedPrice:     data.quotedPrice     || 0,
      partsCost:       data.partsCost       || 0,
      mailIn:          data.mailIn          ? 1 : 0,
      status:          data.status          || 'Checked In',
      paid:            data.paid            ? 1 : 0,
      dateCompleted:   data.dateCompleted   || null,
      warrantyExpires: data.warrantyExpires || null,
      dateReceived:    data.dateReceived    || null,
      datePostedBack:  data.datePostedBack  || null,
      notes:           data.notes           || '',
    };
    db.prepare(`INSERT INTO jobs (id,num,dateIn,customerName,customerContact,device,faults,faultNotes,quotedPrice,partsCost,mailIn,status,paid,dateCompleted,warrantyExpires,dateReceived,datePostedBack,notes)
      VALUES (@id,@num,@dateIn,@customerName,@customerContact,@device,@faults,@faultNotes,@quotedPrice,@partsCost,@mailIn,@status,@paid,@dateCompleted,@warrantyExpires,@dateReceived,@datePostedBack,@notes)`).run(row);
    return this.getJob(id);
  },

  updateJob(id, data) {
    const allowed = ['dateIn','customerName','customerContact','device','faults','faultNotes','quotedPrice','partsCost','mailIn','status','paid','dateCompleted','warrantyExpires','dateReceived','datePostedBack','notes'];
    const row = {};
    for (const k of allowed) { if (k in data) row[k] = (k === 'paid' || k === 'mailIn') ? (data[k] ? 1 : 0) : data[k]; }
    if (!Object.keys(row).length) return this.getJob(id);
    const sql = 'UPDATE jobs SET ' + Object.keys(row).map(k => k+'=@'+k).join(',') + ", updatedAt=datetime('now') WHERE id=@id";
    db.prepare(sql).run({...row, id});
    return this.getJob(id);
  },

  deleteJob(id) {
    db.prepare('DELETE FROM jobs WHERE id=?').run(id);
  },


  // Used by seed script
  setCounter(n) {
    db.prepare("INSERT OR REPLACE INTO meta (key,value) VALUES ('nextNum',?)").run(String(n));
  },
};
