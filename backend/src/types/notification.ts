export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionPayload {
  endpoint: string;
  expirationTime?: number | null;
  keys: PushSubscriptionKeys;
}

export interface StoredSubscription {
  id: string;
  userId?: string;
  role?: 'supervisor' | 'technician' | 'all';
  subscription: PushSubscriptionPayload;
  userAgent?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    url?: string;
    id?: string | number;
    type?: string;
    timestamp?: number;
    [key: string]: any;
  };
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  vibrate?: number[];
  requireInteraction?: boolean;
}
