import Dexie from 'dexie';
import { supabase } from './supabase';

const db = new Dexie('SwineSyncDB');

db.version(2).stores({
  syncQueue: '++id, table, operation, timestamp',
  pigs: 'id, tag, name, gender, status, reproductive_status, updated_at',
  breedings: 'id, pig_id, mating_date, expected_farrow, status, notes, updated_at',
  feeding_schedules: 'id, time, type, amount_kg, updated_at',
  feeding_logs: 'id, amount_kg, time, schedule_id, type, updated_at',
  inventory: 'id, feed_stock_kg, min_threshold, last_restock, updated_at',
  inventory_restocks: 'id, amount_kg, date, notes, updated_at',
  financial_transactions: 'id, type, amount, description, category, date, updated_at',
  health_records: 'id, pig_id, type, date, next_due, updated_at',
  growth_records: 'id, pig_id, date, weight_kg, gain, updated_at',
  mortality_records: 'id, pig_id, cause, date, updated_at',
  profiles: 'id, username, role, updated_at',
});

db.version(3).stores({
  syncQueue: '++id, table, operation, timestamp',
  pigs: 'id, tag, name, gender, status, reproductive_status, updated_at',
  breedings: 'id, pig_id, mating_date, expected_farrow, status, notes, updated_at',
  feeding_schedules: 'id, time, type, amount_kg, updated_at',
  feeding_logs: 'id, amount_kg, time, schedule_id, type, updated_at',
  inventory: 'id, feed_stock_kg, min_threshold, last_restock, updated_at',
  inventory_restocks: 'id, amount_kg, date, notes, updated_at',
  financial_transactions: 'id, type, amount, description, category, date, updated_at',
  health_records: 'id, pig_id, type, date, next_due, updated_at',
  growth_records: 'id, pig_id, date, weight_kg, gain, updated_at',
  mortality_records: 'id, pig_id, cause, date, updated_at',
  profiles: 'id, username, role, updated_at',
  notifications: 'id, type, message, created_at, read, target_role, actor_name',
});

export { db };

export function isOnline() {
  return navigator.onLine;
}

export async function getPendingCount() {
  const count = await db.syncQueue.count();
  return count;
}

export async function addToQueue(table, operation, record) {
  await db.syncQueue.add({
    table,
    operation,
    record,
    timestamp: new Date().toISOString(),
  });
}

export async function pullAllFromSupabase(tableName) {
  try {
    const { data, error } = await supabase.from(tableName).select('*');
    if (error) throw error;
    if (data && data.length > 0) {
      await db[tableName].clear();
      await db[tableName].bulkPut(data);
    }
    return data || [];
  } catch (err) {
    console.warn(`pullAllFromSupabase(${tableName}) failed:`, err);
    return null;
  }
}

async function processQueueItem(item) {
  const { table, operation, record } = item;
  const tableName = table;

  if (operation === 'insert') {
    const { error } = await supabase.from(tableName).insert([record]);
    if (error) throw error;
  } else if (operation === 'update') {
    const { data: remote, error: fetchError } = await supabase
      .from(tableName)
      .select('updated_at')
      .eq('id', record.id)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

    if (remote && remote.updated_at && remote.updated_at > record.updated_at) {
      const { data: fullRemote } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', record.id)
        .single();
      if (fullRemote) {
        await db[tableName].put(fullRemote);
      }
      return;
    }

    const { id, ...rest } = record;
    const { error } = await supabase.from(tableName).update(rest).eq('id', id);
    if (error) throw error;
  } else if (operation === 'delete') {
    const { error } = await supabase.from(tableName).delete().eq('id', record.id);
    if (error) throw error;
  }
}

export async function syncAll() {
  const items = await db.syncQueue.toArray();
  for (const item of items) {
    try {
      await processQueueItem(item);
      await db.syncQueue.delete(item.id);
    } catch (err) {
      console.error('Sync failed for item:', item, err);
    }
  }
}