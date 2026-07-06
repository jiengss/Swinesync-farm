import { supabase } from './supabase';
import { db, addToQueue, isOnline, syncAll } from './sync';

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function applyLocalOptions(records, options = {}) {
  let result = [...records];

  if (options.filters) {
    Object.entries(options.filters).forEach(([key, value]) => {
      if (typeof value === 'object') {
        Object.entries(value).forEach(([op, val]) => {
          if (op === 'gte') result = result.filter(r => r[key] >= val);
          else if (op === 'gt') result = result.filter(r => r[key] > val);
          else if (op === 'lte') result = result.filter(r => r[key] <= val);
          else if (op === 'lt') result = result.filter(r => r[key] < val);
          else if (op === 'eq') result = result.filter(r => r[key] === val);
          else if (op === 'neq') result = result.filter(r => r[key] !== val);
        });
      } else {
        result = result.filter(r => r[key] === value);
      }
    });
  }

  if (options.orderBy) {
    const { column, ascending } = options.orderBy;
    const asc = ascending !== false;
    result.sort((a, b) => {
      if (a[column] < b[column]) return asc ? -1 : 1;
      if (a[column] > b[column]) return asc ? 1 : -1;
      return 0;
    });
  }

  if (options.limit) {
    result = result.slice(0, options.limit);
  }

  return result;
}

function createAPI(tableName) {
  return {
    async getAll(options = {}) {
      if (isOnline()) {
        try {
          let query = supabase.from(tableName).select('*');
          if (options.filters) {
            Object.entries(options.filters).forEach(([key, value]) => {
              if (typeof value === 'object') {
                Object.entries(value).forEach(([op, val]) => {
                  query = query.filter(key, op, val);
                });
              } else {
                query = query.eq(key, value);
              }
            });
          }
          if (options.orderBy) {
            query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending !== false });
          }
          if (options.limit) {
            query = query.limit(options.limit);
          }
          const { data, error } = await query;
          if (error) throw error;

          if (!options.filters && !options.limit) {
            try {
              await db[tableName].clear();
              if (data && data.length > 0) {
                await db[tableName].bulkPut(data);
              }
            } catch (cacheErr) { /* ignore */ }
          } else if (data && data.length > 0) {
            try {
              await db[tableName].bulkPut(data);
            } catch (cacheErr) { /* ignore */ }
          }

          return data || [];
        } catch (err) {
          console.warn(`Online fetch failed for ${tableName}, falling back to local:`, err);
        }
      }

      try {
        const localData = await db[tableName].toArray();
        return applyLocalOptions(localData, options);
      } catch (localErr) {
        console.error(`Local read also failed for ${tableName}:`, localErr);
        return [];
      }
    },

    async getById(id) {
      if (isOnline()) {
        try {
          const { data, error } = await supabase.from(tableName).select('*').eq('id', id).single();
          if (error && error.code !== 'PGRST116') throw error;
          if (data) {
            try {
              await db[tableName].put(data);
            } catch (cacheErr) { /* ignore */ }
          }
          return data || null;
        } catch (err) {
          console.warn(`Online getById failed for ${tableName}/${id}, falling back to local:`, err);
        }
      }

      try {
        const localRecord = await db[tableName].get(id);
        return localRecord || null;
      } catch (localErr) {
        console.error(`Local getById also failed for ${tableName}/${id}:`, localErr);
        return null;
      }
    },

    async insert(record) {
      const id = record.id || generateId();
      const newRecord = { ...record, id, updated_at: new Date().toISOString() };
      if (!isOnline()) {
        await addToQueue(tableName, 'insert', newRecord);
        await db[tableName].add(newRecord);
        return newRecord;
      }
      const { data, error } = await supabase.from(tableName).insert([newRecord]).select();
      if (error) throw error;
      await db[tableName].put(data[0] || newRecord);
      return data[0];
    },

    async update(id, updates) {
      const updatesWithTimestamp = { ...updates, updated_at: new Date().toISOString() };
      if (!isOnline()) {
        await addToQueue(tableName, 'update', { id, ...updatesWithTimestamp });
        const local = await db[tableName].get(id);
        if (local) {
          await db[tableName].put({ ...local, ...updatesWithTimestamp });
        }
        return { id, ...updatesWithTimestamp };
      }
      const { data, error } = await supabase.from(tableName).update(updatesWithTimestamp).eq('id', id).select();
      if (error) throw error;
      const updated = data[0] || { ...updatesWithTimestamp, id };
      await db[tableName].put(updated);
      return data[0];
    },

    async delete(id) {
      if (!isOnline()) {
        await addToQueue(tableName, 'delete', { id });
        await db[tableName].delete(id);
        return;
      }
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) throw error;
      await db[tableName].delete(id);
    },
  };
}

export const dataAPI = {
  pigs: createAPI('pigs'),
  breedings: createAPI('breedings'),
  feeding_schedules: createAPI('feeding_schedules'),
  feeding_logs: createAPI('feeding_logs'),
  inventory: createAPI('inventory'),
  inventory_restocks: createAPI('inventory_restocks'),
  financial_transactions: createAPI('financial_transactions'),
  growth_records: createAPI('growth_records'),
  mortality_records: createAPI('mortality_records'),
  health_records: createAPI('health_records'),
  profiles: createAPI('profiles'),
};