// One-time migration: backfill brand + model for existing 49 items
// Run on the N100 with: node migrate-brands.js
// Safe to run multiple times (idempotent WHERE clause)

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'repairs.db');
const db = new Database(DB_PATH);

// Mapping derived from Google Sheets (Console_Repair_Tracker)
// num → { brand, model }
const updates = [
  // Xbox Series S/X — most items
  ...[1,2,3,4,5,7,8,9,10,11,12,13,14,15,16,17,18,19,21,22,23,25,26,27,28,29,31,32,33,34,35,36,37,38,40,41,42,43,44,45,46,47,48,49]
    .map(num => ({ num, brand: 'Microsoft', model: 'Xbox Series S / X' })),
  // Xbox One
  ...[20, 24, 30, 39]
    .map(num => ({ num, brand: 'Microsoft', model: 'Xbox One' })),
  // PS5 DualSense
  { num: 6, brand: 'Sony', model: 'DualSense (PS5)' },
];

const stmt = db.prepare(`
  UPDATE items SET brand = ?, model = ?
  WHERE num = ? AND (brand IS NULL OR brand = '')
`);

let updated = 0;
const runAll = db.transaction(() => {
  for (const { num, brand, model } of updates) {
    const result = stmt.run(brand, model, num);
    if (result.changes > 0) {
      console.log(`  #${num}: → ${brand} / ${model}`);
      updated++;
    }
  }
});

console.log('Running brand/model backfill migration...');
runAll();
console.log(`\nDone. ${updated} item(s) updated.`);

db.close();
