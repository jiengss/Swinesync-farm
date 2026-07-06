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

/**
 * Add a notification (locally + Supabase if online).
 * @param {string} type - 'pig_added' | 'feed_logged' | 'low_stock'
 * @param {string} message - Human-readable message
 * @param {string} targetRole - Who should see it (e.g. 'Owner')
 * @param {string} actorName - Name/tag of whoever triggered it
 */
export async function addNotification(type, message, targetRole = 'Owner', actorName = '') {
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
