import 'server-only';
import { db } from './db';

// Notifiche multi-canale. La regola evento→canali è configurata dall'admin (NotificationRule).
// Politica: le email/SMS non contengono MAI contenuto clinico — solo un avviso e il link
// alla piattaforma, dove il contenuto è dietro autenticazione.
// I canali EMAIL/SMS/PUSH richiedono un provider configurato; senza provider la notifica
// resta in-app e il tentativo esterno viene marcato PENDING (mai perso in silenzio).

export async function notify(opts: {
  userId: string;
  eventKey: string;
  title: string;
  body: string;
  refType?: string;
  refId?: string;
}) {
  const rule = await db.notificationRule.findUnique({ where: { eventKey: opts.eventKey } });
  const channels: string[] = rule?.enabled === false ? [] : rule ? JSON.parse(rule.channels) : ['INAPP'];
  if (!channels.includes('INAPP')) channels.unshift('INAPP');

  for (const channel of channels) {
    let status = 'SENT';
    if (channel !== 'INAPP') {
      const provider = await db.providerConfig.findFirst({ where: { kind: channel === 'EMAIL' ? 'EMAIL' : channel === 'SMS' ? 'SMS' : 'PUSH', enabled: true } });
      status = provider ? 'SENT' : 'PENDING'; // senza provider: accodata, visibile in admin
      // Qui il dispatcher reale (adapter provider). Il contenuto esterno è sempre e solo:
      // "Hai una nuova notifica su Cartella Intelligente. Accedi per leggerla."
    }
    await db.notification.create({
      data: {
        userId: opts.userId,
        eventKey: opts.eventKey,
        title: opts.title,
        body: opts.body,
        channel,
        status,
        refType: opts.refType,
        refId: opts.refId,
      },
    });
  }
}

export async function unreadCount(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, channel: 'INAPP', readAt: null } });
}
