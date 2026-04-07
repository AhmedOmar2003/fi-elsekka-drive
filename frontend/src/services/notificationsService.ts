import { supabase } from '@/lib/supabase';

export interface AppNotification {
    id: string;
    user_id: string;
    title: string;
    message: string;
    link?: string;
    is_read: boolean;
    created_at: string;
}

const DUPLICATE_NOTIFICATION_WINDOW_MS = 10000;
export const NOTIFICATIONS_SYNC_EVENT = 'fi-elsekka:notifications-sync';

export type NotificationsSyncDetail =
    | { type: 'mark-read'; userId: string; notificationId: string }
    | { type: 'mark-all-read'; userId: string }
    | { type: 'delete-one'; userId: string; notificationId: string }
    | { type: 'delete-all'; userId: string }
    | { type: 'upsert'; userId: string; notification: AppNotification };

const logNotificationMutationFailure = (action: string, details: Record<string, unknown>) => {
    console.error(`[notifications] ${action} failed`, details);
};

const getNotificationFingerprint = (notification: Pick<AppNotification, 'title' | 'message' | 'link'>) => {
    return `${notification.title}__${notification.message}__${notification.link || ''}`;
};

export const emitNotificationsSync = (detail: NotificationsSyncDetail) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent<NotificationsSyncDetail>(NOTIFICATIONS_SYNC_EVENT, { detail }));
};

const dedupeNotifications = (notifications: AppNotification[]) => {
    const seenIds = new Set<string>();
    const seenFingerprints = new Map<string, number>();

    return notifications
        .slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .filter((notification) => {
            if (seenIds.has(notification.id)) {
                return false;
            }

            seenIds.add(notification.id);

            const fingerprint = getNotificationFingerprint(notification);
            const createdAt = new Date(notification.created_at).getTime();
            const lastSeenAt = seenFingerprints.get(fingerprint);

            if (
                typeof lastSeenAt === 'number' &&
                Number.isFinite(createdAt) &&
                Math.abs(lastSeenAt - createdAt) <= DUPLICATE_NOTIFICATION_WINDOW_MS
            ) {
                return false;
            }

            seenFingerprints.set(fingerprint, Number.isFinite(createdAt) ? createdAt : Date.now());
            return true;
        });
};

export const mergeNotificationIntoList = (notifications: AppNotification[], notification: AppNotification) => {
    return dedupeNotifications([notification, ...notifications]);
};

/**
 * Fetches the most recent notifications for the logged-in user.
 */
export const fetchUserNotifications = async (userId: string, limit = 20): Promise<AppNotification[]> => {
    if (!userId) return [];

    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching notifications:', error?.message || error);
        return [];
    }

    return dedupeNotifications(data as AppNotification[]);
};

/**
 * Marks a specific notification as read.
 */
export const markNotificationAsRead = async (notificationId: string, userId: string): Promise<boolean> => {
    if (!notificationId || !userId) return false;

    const { data: existingRows, error: existingError } = await supabase
        .from('notifications')
        .select('id')
        .eq('id', notificationId)
        .eq('user_id', userId)
        .limit(1);

    if (existingError) {
        logNotificationMutationFailure('mark-read.lookup', { notificationId, userId, error: existingError.message || existingError });
        return false;
    }

    if (!existingRows || existingRows.length === 0) {
        return true;
    }

    const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', userId)
        .select('id');

    if (error) {
        logNotificationMutationFailure('mark-read.update', { notificationId, userId, error: error.message || error });
        return false;
    }

    const updatedRows = data ?? [];
    if (updatedRows.length === 0) {
        logNotificationMutationFailure('mark-read.no-rows', { notificationId, userId });
        return false;
    }

    return true;
};

/**
 * Marks all unread notifications as read for a specific user.
 */
export const markAllNotificationsAsRead = async (userId: string): Promise<boolean> => {
    if (!userId) return false;

    const { data: unreadRows, error: unreadError } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('is_read', false);

    if (unreadError) {
        logNotificationMutationFailure('mark-all.lookup', { userId, error: unreadError.message || unreadError });
        return false;
    }

    if (!unreadRows || unreadRows.length === 0) {
        return true;
    }

    const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)
        .select('id');

    if (error) {
        logNotificationMutationFailure('mark-all.update', { userId, error: error.message || error });
        return false;
    }

    const updatedRows = data ?? [];
    if (updatedRows.length !== unreadRows.length) {
        logNotificationMutationFailure('mark-all.partial', { userId, expected: unreadRows.length, actual: updatedRows.length });
        return false;
    }

    return true;
};

/**
 * Deletes a specific notification owned by the user.
 */
export const deleteNotification = async (notificationId: string, userId: string): Promise<boolean> => {
    if (!notificationId || !userId) return false;

    const { data: existingRows, error: existingError } = await supabase
        .from('notifications')
        .select('id')
        .eq('id', notificationId)
        .eq('user_id', userId)
        .limit(1);

    if (existingError) {
        logNotificationMutationFailure('delete-one.lookup', { notificationId, userId, error: existingError.message || existingError });
        return false;
    }

    if (!existingRows || existingRows.length === 0) {
        return true;
    }

    const { data, error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userId)
        .select('id');

    if (error) {
        logNotificationMutationFailure('delete-one.delete', { notificationId, userId, error: error.message || error });
        return false;
    }

    const deletedRows = data ?? [];
    if (deletedRows.length === 0) {
        logNotificationMutationFailure('delete-one.no-rows', { notificationId, userId });
        return false;
    }

    return true;
};

/**
 * Deletes all notifications for a specific user.
 */
export const deleteAllNotifications = async (userId: string): Promise<boolean> => {
    if (!userId) return false;

    const { data: existingRows, error: existingError } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', userId);

    if (existingError) {
        logNotificationMutationFailure('delete-all.lookup', { userId, error: existingError.message || existingError });
        return false;
    }

    if (!existingRows || existingRows.length === 0) {
        return true;
    }

    const { data, error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', userId)
        .select('id');

    if (error) {
        logNotificationMutationFailure('delete-all.delete', { userId, error: error.message || error });
        return false;
    }

    const deletedRows = data ?? [];
    if (deletedRows.length !== existingRows.length) {
        logNotificationMutationFailure('delete-all.partial', { userId, expected: existingRows.length, actual: deletedRows.length });
        return false;
    }

    return true;
};

/**
 * Creates a notification for a specific user. (Usually called server-side or by an admin context)
 */
export const createNotification = async (payload: Omit<AppNotification, 'id' | 'created_at' | 'is_read'>): Promise<boolean> => {
    const { error } = await supabase
        .from('notifications')
        .insert([{
            ...payload,
            is_read: false
        }]);

    if (error) {
        console.error('Error creating notification:', error?.message || error);
        return false;
    }

    return true;
};
