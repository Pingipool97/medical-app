import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notify } from '@/lib/notify';
import { expireOverdueSubscriptions } from '@/lib/subscription';
import { DEFAULT_REMINDER_HOURS } from '@/lib/constants';
import { fmtDate, fmtTime } from '@/lib/format';

// Job periodico: promemoria appuntamenti e scadenza abbonamenti.
// Finora l'evento 'appuntamento_promemoria' era dichiarato nella matrice notifiche ma
// non lo emetteva nessuno — nell'app non esisteva alcuno scheduler.
//
// Protezione: Vercel Cron manda `Authorization: Bearer $CRON_SECRET`. Senza il segreto
// configurato l'endpoint rifiuta sempre: meglio un job che non parte di un endpoint che
// chiunque può far girare a ripetizione.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization') ?? '';
  return header === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  const now = new Date();
  // Finestra ampia: si filtra poi per la preferenza del singolo utente, che può volere
  // il promemoria da 1 a 48 ore prima.
  const horizon = new Date(now.getTime() + 48 * 3600_000);

  const appts = await db.appointment.findMany({
    where: {
      status: { in: ['PRENOTATO', 'CONFERMATO'] },
      startsAt: { gt: now, lte: horizon },
      reminderSentAt: null,
    },
    include: {
      patient: { select: { userId: true } },
      doctor: { select: { userId: true, firstName: true, lastName: true } },
      service: { select: { name: true } },
    },
    take: 500,
  });

  let sent = 0;
  for (const a of appts) {
    const hoursAway = (a.startsAt.getTime() - now.getTime()) / 3600_000;

    // Ognuna delle due parti ha la propria preferenza di anticipo.
    const prefs = await db.notificationPreference.findMany({
      where: {
        eventKey: 'appuntamento_promemoria',
        userId: { in: [a.patient.userId, a.doctor.userId] },
      },
    });
    const anticipo = (userId: string) =>
      prefs.find((p) => p.userId === userId)?.reminderHours ?? DEFAULT_REMINDER_HOURS;

    const quando = `${fmtDate(a.startsAt)} alle ${fmtTime(a.startsAt)}`;
    let any = false;

    if (hoursAway <= anticipo(a.patient.userId)) {
      await notify({
        userId: a.patient.userId,
        eventKey: 'appuntamento_promemoria',
        title: 'Promemoria appuntamento',
        body: `Hai un appuntamento con ${a.doctor.lastName} ${a.doctor.firstName} il ${quando}.`,
        refType: 'Appointment',
        refId: a.id,
      });
      any = true;
    }
    if (hoursAway <= anticipo(a.doctor.userId)) {
      await notify({
        userId: a.doctor.userId,
        eventKey: 'appuntamento_promemoria',
        title: 'Promemoria appuntamento',
        body: `${a.service?.name ?? 'Appuntamento'} il ${quando}.`,
        refType: 'Appointment',
        refId: a.id,
      });
      any = true;
    }

    // Si marca solo se è partito almeno un avviso: altrimenti un appuntamento fra 48 ore
    // verrebbe marcato subito e il promemoria vero non arriverebbe mai.
    if (any) {
      await db.appointment.update({ where: { id: a.id }, data: { reminderSentAt: now } });
      sent++;
    }
  }

  const expired = await expireOverdueSubscriptions();

  return NextResponse.json({
    ok: true,
    ranAt: now.toISOString(),
    appuntamentiEsaminati: appts.length,
    promemoriaInviati: sent,
    abbonamentiScaduti: expired,
  });
}
