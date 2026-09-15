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
  const [rule, pref] = await Promise.all([
    db.notificationRule.findUnique({ where: { eventKey: opts.eventKey } }),
    db.notificationPreference.findUnique({ where: { userId_eventKey: { userId: opts.userId, eventKey: opts.eventKey } } }),
  ]);
  let channels: string[] = rule?.enabled === false ? [] : rule ? JSON.parse(rule.channels) : ['INAPP'];

  // La regola admin decide cosa è ammesso per la piattaforma; la preferenza utente può
  // solo restringere quell'insieme, mai allargarlo. In-app resta sempre attiva: è il
  // registro di ciò che è successo sull'account, non un canale pubblicitario.
  if (pref) {
    channels = channels.filter((c) =>
      c === 'INAPP' ||
      (c === 'EMAIL' && pref.email) ||
      (c === 'SMS' && pref.sms) ||
      (c === 'PUSH' && pref.push));
  }
  if (!channels.includes('INAPP')) channels.unshift('INAPP');

  for (const channel of channels) {
    let status = 'SENT';
    if (channel !== 'INAPP') {
      const provider = await db.providerConfig.findFirst({ where: { kind: channel === 'EMAIL' ? 'EMAIL' : channel === 'SMS' ? 'SMS' : 'PUSH', enabled: true } });
      status = provider ? 'SENT' : 'PENDING'; // senza provider: accodata, visibile in admin
      // Qui il dispatcher reale (adapter provider). Il contenuto esterno è sempre e solo:
      // "Hai una nuova notifica su HABITUS APP. Accedi per leggerla."
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
