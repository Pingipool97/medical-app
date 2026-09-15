import 'server-only';
import { db } from './db';
import { NOTIFICATION_EVENTS, DEFAULT_REMINDER_HOURS } from './constants';
import type { PrefRow } from '@/components/notification-prefs';

// Quali eventi ha senso mostrare a chi: il paziente non deve vedere "Nuova richiesta
// dal paziente", il professionista non deve vedere "Collegamento attivato".
const EVENTS_BY_ROLE: Record<string, string[]> = {
  PATIENT: [
    'appuntamento_promemoria',
    'appuntamento_prenotato',
    'appuntamento_annullato',
    'slot_liberato',
    'documento_emesso',
    'documento_elaborato',
    'richiesta_aggiornata',
    'messaggio_nuovo',
    'collegamento_attivo',
  ],
  DOCTOR: [
    'appuntamento_promemoria',
    'appuntamento_prenotato',
    'appuntamento_annullato',
    'richiesta_nuova',
    'messaggio_nuovo',
    'documento_condiviso',
    'collegamento_richiesto',
    'bozza_ia_in_attesa',
    'red_flag',
  ],
};
EVENTS_BY_ROLE.CAREGIVER = EVENTS_BY_ROLE.PATIENT;
EVENTS_BY_ROLE.STAFF = ['appuntamento_prenotato', 'appuntamento_annullato', 'messaggio_nuovo'];

/**
 * Righe del pannello preferenze: unisce l'elenco eventi del ruolo, i canali che la
 * policy della piattaforma ammette (NotificationRule) e la scelta già salvata dall'utente.
 * Senza riga salvata valgono i default: email e push sì, SMS no.
 */
export async function loadNotificationPrefs(userId: string, role: string): Promise<PrefRow[]> {
  const keys = EVENTS_BY_ROLE[role] ?? EVENTS_BY_ROLE.PATIENT;
  const [rules, prefs] = await Promise.all([
    db.notificationRule.findMany({ where: { eventKey: { in: keys } } }),
    db.notificationPreference.findMany({ where: { userId, eventKey: { in: keys } } }),
  ]);

  const ruleByKey = new Map(rules.map((r) => [r.eventKey, r]));
  const prefByKey = new Map(prefs.map((p) => [p.eventKey, p]));
  const labelByKey = new Map(NOTIFICATION_EVENTS.map((e) => [e.key, e.label]));

  return keys
    // Un evento disattivato a livello di piattaforma non si mostra: non c'è niente da scegliere.
    .filter((k) => ruleByKey.get(k)?.enabled !== false)
    .map((eventKey) => {
      const rule = ruleByKey.get(eventKey);
      let allowed: string[] = ['INAPP'];
      try {
        if (rule) allowed = JSON.parse(rule.channels);
      } catch {
        // channels malformato in DB: si degrada al solo in-app invece di far saltare la pagina
      }
      const pref = prefByKey.get(eventKey);
      return {
        eventKey,
        label: labelByKey.get(eventKey) ?? eventKey,
        allowed,
        email: pref?.email ?? true,
        sms: pref?.sms ?? false,
        push: pref?.push ?? true,
        reminderHours: pref?.reminderHours ?? (eventKey === 'appuntamento_promemoria' ? DEFAULT_REMINDER_HOURS : null),
      };
    });
}
