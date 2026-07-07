import { db } from './sync';
import { supabase } from './supabase';
import { isOnline } from './sync';

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ─── Dedup guard ────────────────────────────────────────────────────────────
// Prevents the same "type+key" combo from firing more than once per session.
const _sessionFired = new Set();

function dedupKey(type, key) {
  return `${type}::${key}`;
}

/**
 * Add a notification (locally + Supabase if online).
 * @param {string} type - Notification type string
 * @param {string} message - Human-readable message
 * @param {string} targetRole - Who should see it (e.g. 'Owner')
 * @param {string} actorName - Name/tag of whoever triggered it
 * @param {string|null} dedupSessionKey - If set, notification will only fire once per browser session for this key
 */
export async function addNotification(type, message, targetRole = 'Owner', actorName = '', dedupSessionKey = null) {
  // Dedup guard: skip if already fired this session
  if (dedupSessionKey) {
    const key = dedupKey(type, dedupSessionKey);
    if (_sessionFired.has(key)) return null;
    _sessionFired.add(key);
  }

  const notification = {
    id: generateId(),
    type,
    message,
    created_at: new Date().toISOString(),
    read: false,
    target_role: targetRole,
    actor_name: actorName,
  };

  // Always save locally
  try {
    await db.notifications.add(notification);
  } catch (e) {
    console.warn('Failed to save notification locally:', e);
  }

  // Push to Supabase if online
  if (isOnline()) {
    try {
      await supabase.from('notifications').insert([notification]);
    } catch (e) {
      console.warn('Failed to push notification to Supabase:', e);
    }
  }

  return notification;
}

/**
 * Fetch all notifications for a given role, newest first.
 * Falls back to local IndexedDB when offline.
 */
export async function getNotifications(targetRole = 'Owner') {
  if (isOnline()) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('target_role', targetRole)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error && data) {
        // Cache locally
        try {
          for (const n of data) {
            await db.notifications.put(n);
          }
        } catch (e) { /* ignore */ }
        return data;
      }
    } catch (e) {
      console.warn('Remote notifications fetch failed, using local:', e);
    }
  }

  // Offline fallback
  try {
    const local = await db.notifications
      .where('target_role').equals(targetRole)
      .reverse()
      .limit(50)
      .toArray();
    return local.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } catch (e) {
    return [];
  }
}

/**
 * Count unread notifications for a given role.
 */
export async function getUnreadCount(targetRole = 'Owner') {
  try {
    const notifications = await getNotifications(targetRole);
    return notifications.filter(n => !n.read).length;
  } catch (e) {
    return 0;
  }
}

/**
 * Mark all notifications as read for a given role.
 */
export async function markAllRead(targetRole = 'Owner') {
  try {
    // Update locally
    const local = await db.notifications
      .where('target_role').equals(targetRole)
      .toArray();
    for (const n of local) {
      await db.notifications.put({ ...n, read: true });
    }

    // Update Supabase if online
    if (isOnline()) {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('target_role', targetRole)
        .eq('read', false);
    }
  } catch (e) {
    console.warn('markAllRead failed:', e);
  }
}

/**
 * Subscribe to real-time notifications via Supabase channel.
 * Returns an unsubscribe function.
 */
export function subscribeToNotifications(targetRole, onNewNotification) {
  if (!isOnline()) return () => {};

  const channel = supabase
    .channel(`notifications-${targetRole}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `target_role=eq.${targetRole}` },
      (payload) => {
        if (payload.new) {
          // Cache locally
          db.notifications.put(payload.new).catch(() => {});
          onNewNotification(payload.new);
        }
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

// ─── Auto-check helpers ─────────────────────────────────────────────────────

/**
 * Check current feed stock and fire a low_stock notification if below threshold.
 * Safe to call on every inventory load — uses session dedup to avoid spam.
 * @param {number} feedStockKg - Current feed stock in kg
 * @param {number} minThreshold - Minimum threshold in kg
 * @param {string} actorName - Who triggered the check (optional)
 */
export async function checkAndNotifyLowStock(feedStockKg, minThreshold, actorName = 'System') {
  if (feedStockKg < minThreshold) {
    const todayKey = new Date().toISOString().split('T')[0];
    await addNotification(
      'low_stock',
      `⚠️ Feed stock is low! Only ${feedStockKg} kg remaining (threshold: ${minThreshold} kg). Please restock immediately.`,
      'Owner',
      actorName,
      `low_stock_${todayKey}` // dedup: fires once per day per session
    );
  }
}

/**
 * Check health records for overdue/upcoming vaccinations and fire notifications.
 * Safe to call on every health data load — uses session dedup per pig+date.
 * @param {Array} records - Health records array
 * @param {Array} pigs - Pigs array
 */
export async function checkAndNotifyVaccinations(records, pigs) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sevenDaysLater = new Date(today);
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

  const todayKey = today.toISOString().split('T')[0];

  const overdueRecords = [];
  const upcomingRecords = [];

  records.forEach(r => {
    if (!r.next_due) return;
    const dueDate = new Date(r.next_due);
    dueDate.setHours(0, 0, 0, 0);

    if (dueDate < today) {
      overdueRecords.push(r);
    } else if (dueDate <= sevenDaysLater) {
      upcomingRecords.push(r);
    }
  });

  // Fire overdue notification (grouped, one per day per session)
  if (overdueRecords.length > 0) {
    const pigNames = overdueRecords.map(r => {
      const pig = pigs.find(p => p.id === r.pig_id);
      return pig ? pig.tag : r.pig_id;
    });
    const uniquePigs = [...new Set(pigNames)];
    await addNotification(
      'vaccination_overdue',
      `🚨 ${overdueRecords.length} health record(s) are OVERDUE for pig(s): ${uniquePigs.join(', ')}. Immediate attention required!`,
      'Owner',
      'System',
      `vaccination_overdue_${todayKey}`
    );
  }

  // Fire upcoming notification (grouped, one per day per session)
  if (upcomingRecords.length > 0) {
    const pigNames = upcomingRecords.map(r => {
      const pig = pigs.find(p => p.id === r.pig_id);
      return pig ? pig.tag : r.pig_id;
    });
    const uniquePigs = [...new Set(pigNames)];
    await addNotification(
      'vaccination_due',
      `💉 ${upcomingRecords.length} vaccination(s) due in the next 7 days for pig(s): ${uniquePigs.join(', ')}.`,
      'Owner',
      'System',
      `vaccination_due_${todayKey}`
    );
  }
}

/**
 * Fire a missed feeding notification for the Owner.
 * Safe to call when missed feedings count changes — uses session dedup.
 * @param {number} missedCount - Number of missed feedings
 */
export async function checkAndNotifyMissedFeedings(missedCount) {
  if (missedCount > 0) {
    const todayKey = new Date().toISOString().split('T')[0];
    await addNotification(
      'missed_feeding',
      `🍽️ ${missedCount} feeding schedule(s) were missed today. Please check the feeding logs!`,
      'Owner',
      'System',
      `missed_feeding_${todayKey}`
    );
  }
}
