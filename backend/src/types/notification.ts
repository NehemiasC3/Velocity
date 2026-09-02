export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionPayload {
  endpoint: string;
  expirationTime?: number | null;
  keys: PushSubscriptionKeys;
}

export interface NotificationPreferences {
  zones: string[];       // e.g. ['Platanilla', 'Torti', 'La Siesta', 'Todas']
  priorities: string[];  // e.g. ['Alta', 'Normal']
  events: string[];      // e.g. ['orders', 'issues', 'audits']
}

export interface StoredSubscription {
  id: string;
  userId?: string;
  role?: 'supervisor' | 'technician' | 'all';
  subscription: PushSubscriptionPayload;
  preferences?: NotificationPreferences;
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
  zone?: string;
  priority?: 'Alta' | 'Normal' | string;
  event?: 'orders' | 'issues' | 'audits' | string;
  data?: {
    url?: string;
    id?: string | number;
    type?: string;
    zone?: string;
    priority?: string;
    event?: string;
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
