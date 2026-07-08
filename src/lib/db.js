import Dexie from 'dexie';

export const db = new Dexie('SwineSyncDB');

// ---- Version 1 (original) ----
db.version(1).stores({
  pigs: 'id, tag, name, status, updated_at',
  breedings: 'id, pig_id, status, expected_farrow, updated_at',
  feeding_schedules: 'id, time, type, updated_at',
  feeding_logs: 'id, schedule_id, time, updated_at',
  inventory: 'id, feed_stock_kg, updated_at',
  financial_transactions: 'id, type, date, updated_at',
  health_records: 'id, pig_id, type, date, updated_at',
  growth_records: 'id, pig_id, date, updated_at',
  mortality_records: 'id, pig_id, date, updated_at',
  profiles: 'id, username, role, updated_at',
  sync_queue: '++id, table, operation, record_id, timestamp, retries',
});

// ---- Version 2 (adds feed_type and pig_id to feeding_schedules) ----
db.version(2).stores({
  pigs: 'id, tag, name, status, updated_at',
  breedings: 'id, pig_id, status, expected_farrow, updated_at',
  feeding_schedules: 'id, time, type, feed_type, pig_id, updated_at',   // <-- new fields
  feeding_logs: 'id, schedule_id, time, updated_at',
  inventory: 'id, feed_stock_kg, updated_at',
  financial_transactions: 'id, type, date, updated_at',
  health_records: 'id, pig_id, type, date, updated_at',
  growth_records: 'id, pig_id, date, updated_at',
  mortality_records: 'id, pig_id, date, updated_at',
  profiles: 'id, username, role, updated_at',
  sync_queue: '++id, table, operation, record_id, timestamp, retries',
});

export const withTimestamp = (data) => ({
  ...data,
  updated_at: new Date().toISOString(),
});

export default db;