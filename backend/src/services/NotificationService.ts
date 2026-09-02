import webpush from 'web-push';
import fs from 'fs';
import path from 'path';
import writeFileAtomic from 'write-file-atomic';
import {
  PushSubscriptionPayload,
  StoredSubscription,
  NotificationPayload
} from '../types/notification';

export class NotificationService {
  private readonly publicKey: string;
  private readonly privateKey: string;
  private readonly subject: string;
  private readonly subsFilePath: string;
  private subscriptions: Map<string, StoredSubscription> = new Map();

  constructor() {
    this.publicKey = (
      process.env.VAPID_PUBLIC_KEY ||
      'BBH906nqp8-eqavWd95D9OJABc6VGbTkw2Ssm7FqNV00_oq2EMCLgijvbK7uiV8ystP0C78Q61cF3zn_1G2T9cE'
    ).trim();

    this.privateKey = (
      process.env.VAPID_PRIVATE_KEY ||
      'K_JfhcRAEP4IlIuDsKEJDrHueePyCJLDUGfAojRoU1A'
    ).trim();

    this.subject = (process.env.VAPID_SUBJECT || 'mailto:soporte@atg-rappido.com').trim();

    const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../../data');
    this.subsFilePath = path.join(dataDir, 'push_subscriptions.json');

    try {
      webpush.setVapidDetails(this.subject, this.publicKey, this.privateKey);
      console.log('[NotificationService 🔔] Web Push VAPID inicializado correctamente.');
    } catch (e: any) {
      console.error('[NotificationService] Error configurando VAPID:', e.message);
    }

    this.loadSubscriptions();
  }

  public getPublicKey(): string {
    return this.publicKey;
  }

  private loadSubscriptions(): void {
    try {
      if (fs.existsSync(this.subsFilePath)) {
        const raw = fs.readFileSync(this.subsFilePath, 'utf8');
        const list: StoredSubscription[] = JSON.parse(raw);
        list.forEach((sub) => {
          if (sub?.subscription?.endpoint) {
            this.subscriptions.set(sub.subscription.endpoint, sub);
          }
        });
        console.log(`[NotificationService] ${this.subscriptions.size} suscripciones Push cargadas desde disco.`);
      }
    } catch (e: any) {
      console.warn('[NotificationService] No se pudieron cargar suscripciones push:', e.message);
    }
  }

  private persistSubscriptions(): void {
    try {
      const list = Array.from(this.subscriptions.values());
      writeFileAtomic.sync(this.subsFilePath, JSON.stringify(list, null, 2));
    } catch (e: any) {
      console.error('[NotificationService] Error persistiendo suscripciones push:', e.message);
    }
  }

  public saveSubscription(
    subscription: PushSubscriptionPayload,
    userId?: string,
    role?: 'supervisor' | 'technician' | 'all',
    userAgent?: string
  ): StoredSubscription {
    const endpoint = subscription.endpoint;
    const now = new Date().toISOString();

    const existing = this.subscriptions.get(endpoint);
    const stored: StoredSubscription = {
      id: existing?.id || Math.random().toString(36).slice(2, 10),
      userId: userId || existing?.userId,
      role: role || existing?.role || 'all',
      subscription,
      userAgent: userAgent || existing?.userAgent,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };

    this.subscriptions.set(endpoint, stored);
    this.persistSubscriptions();
    console.log(`[NotificationService 🔔] Nueva suscripción Push guardada (${this.subscriptions.size} activas).`);
    return stored;
  }

  public removeSubscription(endpoint: string): boolean {
    const deleted = this.subscriptions.delete(endpoint);
    if (deleted) {
      this.persistSubscriptions();
      console.log(`[NotificationService] Suscripción removida: ${endpoint.slice(0, 30)}...`);
    }
    return deleted;
  }

  public getSubscriptionsCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Envía una notificación Push a todos los suscriptores o a un rol específico.
   */
  public async broadcastNotification(
    payload: NotificationPayload,
    targetRole?: 'supervisor' | 'technician' | 'all'
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;
    const invalidEndpoints: string[] = [];

    const stringifiedPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/logo-velocity.svg',
      badge: payload.badge || '/icon-192.png',
      tag: payload.tag || `velocity-${Date.now()}`,
      data: {
        url: payload.data?.url || '/',
        timestamp: Date.now(),
        ...(payload.data || {})
      },
      vibrate: payload.vibrate || [200, 100, 200],
      requireInteraction: payload.requireInteraction !== false
    });

    const promises: Promise<void>[] = [];

    for (const [endpoint, stored] of this.subscriptions.entries()) {
      if (targetRole && targetRole !== 'all' && stored.role !== 'all' && stored.role !== targetRole) {
        continue;
      }

      const p = webpush
        .sendNotification(stored.subscription as any, stringifiedPayload)
        .then(() => {
          sent++;
        })
        .catch((err: any) => {
          failed++;
          console.warn(`[NotificationService] Error enviando Push a ${endpoint.slice(0, 30)}...:`, err.statusCode || err.message);
          // Si el endpoint ya no es válido (404 o 410 Gone), marcarlo para eliminar
          if (err.statusCode === 404 || err.statusCode === 410) {
            invalidEndpoints.push(endpoint);
          }
        });

      promises.push(p);
    }

    await Promise.allSettled(promises);

    // Limpiar suscripciones inválidas
    if (invalidEndpoints.length > 0) {
      invalidEndpoints.forEach((ep) => this.subscriptions.delete(ep));
      this.persistSubscriptions();
    }

    console.log(`[NotificationService] Broadcast Push completado: ${sent} enviados, ${failed} fallidos.`);
    return { sent, failed };
  }
}

export const notificationService = new NotificationService();
