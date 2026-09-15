'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { Icon } from './icons';
import {
  CALENDAR_VIEW_LABEL,
  COLOR_MODE_LABEL,
  MONTH_LONG,
  STATUS_COLOR,
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  patientColor,
  type CalendarView,
  type ColorMode,
} from '@/lib/constants';
import { shiftDateKey, shiftMonthKey, startOfMonth, startOfWeek } from '@/lib/datetime';

// Calendario stile Google: viste Giorno / Settimana / Mese, griglia oraria posizionale,
// drag&drop per spostare un appuntamento, click su slot vuoto per crearne uno.
//
// Nessuna libreria: le date arrivano dal server già ridotte a (giorno, minuti) nel fuso
// italiano, così il client fa solo geometria e non rifà conversioni di fuso — che sarebbero
// la causa classica di disallineamento fra HTML server e idratazione client.
// Le altezze sono in rem: il selettore di dimensione testo dell'app (data-fontsize)
// scalerebbe il testo lasciando la griglia in px, e le righe si romperebbero.

export type CalEvent = {
  id: string;
  day: string; // 'YYYY-MM-DD' (ora italiana)
  startMin: number; // minuti dalla mezzanotte italiana
  endMin: number;
  title: string;
  subtitle?: string;
  /** Colore per ciascuna modalità; quello per stato è derivato da `status`. */
  colors?: { service?: string | null; patient?: string | null };
  status: string;
  href?: string;
  mode?: string;
};

type Props = {
  events: CalEvent[];
  today: string; // passato dal server: evitare new Date() in render
  initialView?: CalendarView;
  initialDate?: string;
  /** Prima e ultima ora mostrate nella griglia. */
  dayStartHour?: number;
  dayEndHour?: number;
  /** Granularità della griglia in minuti (righe cliccabili). */
  slotMinutes?: number;
  /** Abilita drag&drop e click su slot vuoto (solo professionista/segreteria). */
  canEdit?: boolean;
  onMove?: (id: string, dayISO: string, time: string) => void;
  onCreate?: (dayISO: string, time: string) => void;
  /** Legende per modalità: la barra in basso mostra quella della modalità attiva. */
  legends?: Partial<Record<ColorMode, { key: string; label: string }[]>>;
  /** Modalità di colorazione selezionabili. Una sola = nessun selettore mostrato. */
  colorModes?: ColorMode[];
  initialColorMode?: ColorMode;
  emptyHint?: string;
};

const HOUR_REM = 3.5; // altezza di un'ora nella griglia

function pad(n: number) {
  return String(n).padStart(2, '0');
}
function minToTime(min: number) {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}
function parseDay(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}
/** Giorno della settimana (0 = domenica) senza toccare il fuso locale. */
function dowOf(iso: string) {
  const { y, m, d } = parseDay(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
function longDate(iso: string) {
  const { y, m, d } = parseDay(iso);
  return `${WEEKDAY_LONG[dowOf(iso)]} ${d} ${MONTH_LONG[m - 1]} ${y}`;
}

/**
 * Colonne che si sovrappongono: gli appuntamenti concomitanti vengono affiancati invece
 * di coprirsi. Stesso comportamento di Google Calendar, senza il quale una sovrapposizione
 * diventa invisibile — che è esattamente il difetto della vecchia agenda a lista.
 */
function layout(events: CalEvent[]): (CalEvent & { col: number; cols: number })[] {
  const sorted = [...events].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const out: (CalEvent & { col: number; cols: number })[] = [];
  let cluster: (CalEvent & { col: number; cols: number })[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const cols = cluster.reduce((m, e) => Math.max(m, e.col + 1), 0);
    for (const e of cluster) out.push({ ...e, cols });
    cluster = [];
    clusterEnd = -1;
  };

  for (const ev of sorted) {
    if (cluster.length > 0 && ev.startMin >= clusterEnd) flush();
    const taken = new Set(cluster.filter((c) => c.endMin > ev.startMin).map((c) => c.col));
    let col = 0;
    while (taken.has(col)) col++;
    cluster.push({ ...ev, col, cols: 1 });
    clusterEnd = Math.max(clusterEnd, ev.endMin);
  }
  if (cluster.length > 0) flush();
  return out;
}

function statusStyle(status: string) {
  if (status === 'ANNULLATO') return 'opacity-50 line-through';
  if (status === 'NO_SHOW') return 'opacity-70 ring-1 ring-red-400';
  if (status === 'COMPLETATO') return 'opacity-80';
  return '';
}

export default function Calendar({
  events,
  today,
  initialView = 'week',
  initialDate,
  dayStartHour = 7,
  dayEndHour = 21,
  slotMinutes = 30,
  canEdit = false,
  onMove,
  onCreate,
  legends,
  colorModes = ['service'],
  initialColorMode,
  emptyHint = 'Nessun appuntamento in questo periodo.',
}: Props) {
  const [colorMode, setColorMode] = useState<ColorMode>(initialColorMode ?? colorModes[0] ?? 'service');

  /** Chiave palette dell'evento nella modalità attiva, con ricadute sensate se manca. */
  const colorOf = (e: CalEvent): string => {
    if (colorMode === 'status') return STATUS_COLOR[e.status] ?? 'slate';
    if (colorMode === 'patient') return e.colors?.patient ?? e.colors?.service ?? 'indigo';
    return e.colors?.service ?? e.colors?.patient ?? 'indigo';
  };
  const [view, setView] = useState<CalendarView>(initialView);
  const [anchor, setAnchor] = useState(initialDate ?? today);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ day: string; min: number } | null>(null);
  // Il drag usa i pointer event, non l'HTML5 drag&drop: quest'ultimo non esiste su
  // touch, e l'agenda va usata anche da tablet.
  const dragRef = useRef<{ id: string; startX: number; startY: number; moved: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const gridRef = useRef<HTMLDivElement>(null);

  const gridStart = dayStartHour * 60;
  const gridEnd = dayEndHour * 60;
  const totalMin = gridEnd - gridStart;

  // Giorni visibili nella vista corrente
  const days = useMemo(() => {
    if (view === 'day') return [anchor];
    if (view === 'week') {
      const mon = startOfWeek(anchor);
      return Array.from({ length: 7 }, (_, i) => shiftDateKey(mon, i));
    }
    // Mese: griglia completa lun→dom che include il mese intero
    const first = startOfMonth(anchor);
    const gridFirst = startOfWeek(first);
    const lastOfMonth = shiftDateKey(shiftMonthKey(first, 1), -1);
    const cells: string[] = [];
    let cur = gridFirst;
    while (cur <= lastOfMonth || cells.length % 7 !== 0) {
      cells.push(cur);
      cur = shiftDateKey(cur, 1);
      if (cells.length > 42) break;
    }
    return cells;
  }, [view, anchor]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of events) {
      if (!map.has(e.day)) map.set(e.day, []);
      map.get(e.day)!.push(e);
    }
    return map;
  }, [events]);

  const visibleCount = days.reduce((n, d) => n + (byDay.get(d)?.length ?? 0), 0);

  const move = (delta: number) => {
    if (view === 'month') setAnchor(shiftMonthKey(anchor, delta));
    else setAnchor(shiftDateKey(anchor, view === 'week' ? delta * 7 : delta));
  };

  const periodLabel = () => {
    if (view === 'day') return longDate(anchor);
    if (view === 'week') {
      const mon = startOfWeek(anchor);
      const sun = shiftDateKey(mon, 6);
      const a = parseDay(mon);
      const b = parseDay(sun);
      return a.m === b.m
        ? `${a.d}–${b.d} ${MONTH_LONG[a.m - 1]} ${a.y}`
        : `${a.d} ${MONTH_LONG[a.m - 1]} – ${b.d} ${MONTH_LONG[b.m - 1]} ${b.y}`;
    }
    const { y, m } = parseDay(anchor);
    return `${MONTH_LONG[m - 1]} ${y}`;
  };

  /** Minuti corrispondenti alla posizione verticale del puntatore dentro una colonna. */
  const minuteAt = (el: HTMLElement, clientY: number) => {
    const box = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientY - box.top) / box.height));
    const raw = gridStart + ratio * totalMin;
    return Math.round(raw / slotMinutes) * slotMinutes;
  };

  /** Giorno e minuto sotto il puntatore, individuati dalla colonna marcata data-day. */
  const targetAt = (clientX: number, clientY: number): { day: string; min: number } | null => {
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const col = el?.closest('[data-day]') as HTMLElement | null;
    const day = col?.dataset.day;
    if (!col || !day) return null;
    return { day, min: minuteAt(col, clientY) };
  };

  /**
   * Trascinamento con pointer event invece dell'HTML5 drag&drop: quest'ultimo non
   * esiste su touch, e un'agenda da studio si usa anche da tablet. Sotto la soglia di
   * movimento resta un clic normale, così il link sull'evento continua a funzionare.
   */
  const startDrag = (ev: React.PointerEvent<HTMLDivElement>, id: string) => {
    if (!onMove || ev.button !== 0) return;
    dragRef.current = { id, startX: ev.clientX, startY: ev.clientY, moved: false };

    // La cattura del puntatore è un'ottimizzazione, non un requisito: se fallisce
    // (puntatore non più attivo, evento sintetico) il drag deve funzionare lo stesso.
    try {
      ev.currentTarget.setPointerCapture(ev.pointerId);
    } catch {
      /* senza cattura bastano i listener su window */
    }

    // I listener stanno su window e non sull'elemento: così il trascinamento continua
    // anche quando il puntatore esce dall'evento — cioè sempre, appena lo si sposta.
    const onMoveEvt = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (!d.moved) {
        if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 6) return;
        d.moved = true;
        setDragId(d.id);
      }
      e.preventDefault();
      setDropTarget(targetAt(e.clientX, e.clientY));
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', onMoveEvt);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      dragRef.current = null;
      setDragId(null);
      setDropTarget(null);
    };

    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      const moved = Boolean(d?.moved);
      const id2 = d?.id;
      cleanup();
      if (!moved || !id2) return; // clic semplice: lascia passare il link sull'evento
      const target = targetAt(e.clientX, e.clientY);
      if (target) startTransition(() => onMove(id2, target.day, minToTime(target.min)));
    };

    const onCancel = () => cleanup();

    window.addEventListener('pointermove', onMoveEvt, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  };

  const hours = Array.from({ length: dayEndHour - dayStartHour }, (_, i) => dayStartHour + i);

  return (
    <div className="card overflow-hidden">
      {/* Barra comandi */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-b border-slate-200 surface-brand">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => move(-1)}
            className="w-8 h-8 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 flex items-center justify-center"
            aria-label="Periodo precedente"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setAnchor(today)}
            className="px-3 h-8 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-50"
          >
            Oggi
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            className="w-8 h-8 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 flex items-center justify-center"
            aria-label="Periodo successivo"
          >
            ›
          </button>
        </div>

        <h2 className="text-base font-semibold text-brand-950 capitalize flex-1 min-w-[12rem]">{periodLabel()}</h2>

        {colorModes.length > 1 && (
          <div className="flex items-center gap-1.5">
            <label htmlFor="colorMode" className="text-xs text-slate-500 whitespace-nowrap">Colora per</label>
            <select
              id="colorMode"
              value={colorMode}
              onChange={(e) => setColorMode(e.target.value as ColorMode)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700"
            >
              {colorModes.map((m) => (
                <option key={m} value={m}>{COLOR_MODE_LABEL[m]}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex rounded-lg border border-slate-300 overflow-hidden" role="group" aria-label="Vista calendario">
          {(['day', 'week', 'month'] as CalendarView[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`px-3 py-1.5 text-sm ${
                view === v ? 'bg-brand-700 text-white font-semibold' : 'bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {CALENDAR_VIEW_LABEL[v]}
            </button>
          ))}
        </div>
      </div>

      {pending && <div className="h-0.5 bg-brand-500 animate-pulse" aria-hidden />}

      {view === 'month' ? (
        /* ── Vista mese ── */
        <div>
          <div className="grid grid-cols-7 border-b border-slate-200 bg-brand-50/50">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <div key={d} className="px-2 py-1.5 text-xs font-semibold text-slate-500 text-center">
                {WEEKDAY_SHORT[d]}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const evs = (byDay.get(day) ?? []).sort((a, b) => a.startMin - b.startMin);
              const inMonth = day.slice(0, 7) === anchor.slice(0, 7);
              const isToday = day === today;
              return (
                <div
                  key={day}
                  className={`min-h-[6rem] border-b border-r border-slate-100 p-1.5 ${inMonth ? 'bg-white' : 'bg-slate-50/60'}`}
                  onDoubleClick={canEdit && onCreate ? () => onCreate(day, '09:00') : undefined}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setAnchor(day);
                      setView('day');
                    }}
                    className={`text-xs w-6 h-6 rounded-full flex items-center justify-center mb-1 ${
                      isToday ? 'bg-brand-700 text-white font-bold' : inMonth ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-400'
                    }`}
                  >
                    {parseDay(day).d}
                  </button>
                  <div className="space-y-0.5">
                    {evs.slice(0, 3).map((e) => {
                      const c = patientColor(colorOf(e));
                      const chip = (
                        <span className={`flex items-center gap-1 text-[11px] truncate rounded px-1 py-0.5 border ${c.chip} ${statusStyle(e.status)}`}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} aria-hidden />
                          <span className="tabular-nums">{minToTime(e.startMin)}</span>
                          <span className="truncate">{e.title}</span>
                        </span>
                      );
                      return e.href ? (
                        <Link key={e.id} href={e.href} className="block">{chip}</Link>
                      ) : (
                        <div key={e.id}>{chip}</div>
                      );
                    })}
                    {evs.length > 3 && (
                      <button
                        type="button"
                        onClick={() => {
                          setAnchor(day);
                          setView('day');
                        }}
                        className="text-[11px] text-brand-700 hover:underline pl-1"
                      >
                        +{evs.length - 3} altri
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ── Viste giorno e settimana ── */
        <div className="overflow-x-auto">
          <div style={{ minWidth: view === 'week' ? '48rem' : undefined }}>
            {/* Intestazione giorni */}
            <div className="grid border-b border-slate-200 bg-brand-50/60 backdrop-blur-sm sticky top-0 z-10" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0,1fr))` }}>
              <div />
              {days.map((day) => {
                const isToday = day === today;
                const dow = dowOf(day);
                return (
                  <div key={day} className="px-2 py-1.5 text-center border-l border-slate-200">
                    <div className="text-[11px] text-slate-500 uppercase">{WEEKDAY_SHORT[dow]}</div>
                    <div className={`text-sm font-semibold ${isToday ? 'text-white bg-brand-700 rounded-full w-7 h-7 mx-auto flex items-center justify-center' : 'text-slate-800'}`}>
                      {parseDay(day).d}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Griglia oraria */}
            <div ref={gridRef} className="grid relative" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0,1fr))` }}>
              {/* Colonna ore */}
              <div>
                {hours.map((h) => (
                  <div key={h} style={{ height: `${HOUR_REM}rem` }} className="relative">
                    <span className="absolute -top-2 right-1.5 text-[11px] text-slate-400 tabular-nums">{pad(h)}:00</span>
                  </div>
                ))}
              </div>

              {/* Colonne giorno */}
              {days.map((day) => {
                const evs = layout((byDay.get(day) ?? []).filter((e) => e.endMin > gridStart && e.startMin < gridEnd));
                return (
                  <div
                    key={day}
                    className="relative border-l border-slate-200"
                    style={{ height: `${hours.length * HOUR_REM}rem` }}
                    data-day={day}
                    onClick={
                      canEdit && onCreate
                        ? (e) => {
                            // Solo il click sullo sfondo: sugli eventi c'è già il loro handler
                            if (e.target !== e.currentTarget) return;
                            onCreate(day, minToTime(minuteAt(e.currentTarget, e.clientY)));
                          }
                        : undefined
                    }
                  >
                    {/* Righe orarie */}
                    {hours.map((h) => (
                      <div key={h} style={{ height: `${HOUR_REM}rem` }} className="border-b border-slate-100 pointer-events-none" />
                    ))}

                    {/* Indicatore di rilascio durante il drag */}
                    {dropTarget && dropTarget.day === day && (
                      <div
                        className="absolute inset-x-1 h-0.5 bg-brand-600 rounded pointer-events-none z-20"
                        style={{ top: `${((dropTarget.min - gridStart) / totalMin) * hours.length * HOUR_REM}rem` }}
                      >
                        <span className="absolute -top-4 left-0 text-[11px] font-semibold text-brand-700 bg-white px-1 rounded tabular-nums">
                          {minToTime(dropTarget.min)}
                        </span>
                      </div>
                    )}

                    {/* Eventi */}
                    {evs.map((e) => {
                      const c = patientColor(colorOf(e));
                      const top = ((Math.max(e.startMin, gridStart) - gridStart) / totalMin) * hours.length * HOUR_REM;
                      const height = ((Math.min(e.endMin, gridEnd) - Math.max(e.startMin, gridStart)) / totalMin) * hours.length * HOUR_REM;
                      const width = 100 / e.cols;
                      const short = height < 2;
                      const body = (
                        <>
                          <span className={`absolute left-0 inset-y-0 w-1 rounded-l ${c.bar}`} aria-hidden />
                          <span className="block font-semibold truncate">{e.title}</span>
                          {!short && (
                            <>
                              <span className="block tabular-nums text-[11px] opacity-80">
                                {minToTime(e.startMin)}–{minToTime(e.endMin)}
                              </span>
                              {e.subtitle && <span className="block truncate text-[11px] opacity-80">{e.subtitle}</span>}
                            </>
                          )}
                        </>
                      );
                      const movable = canEdit && !!onMove && e.status !== 'ANNULLATO' && e.status !== 'COMPLETATO';
                      const cls = `absolute rounded border pl-2 pr-1 py-0.5 text-xs overflow-hidden ${c.chip} ${statusStyle(e.status)} ${
                        movable ? 'cursor-grab active:cursor-grabbing select-none' : ''
                      } ${dragId === e.id ? 'opacity-40 ring-2 ring-brand-500' : ''}`;
                      const style = {
                        top: `${top}rem`,
                        height: `${Math.max(height, 1.15)}rem`,
                        left: `calc(${e.col * width}% + 2px)`,
                        width: `calc(${width}% - 4px)`,
                      };
                      return (
                        <div
                          key={e.id}
                          className={cls}
                          style={{ ...style, touchAction: movable ? 'none' : undefined }}
                          onPointerDown={movable ? (ev) => startDrag(ev, e.id) : undefined}
                          title={`${minToTime(e.startMin)}–${minToTime(e.endMin)} · ${e.title}${e.subtitle ? ' · ' + e.subtitle : ''}`}
                        >
                          {e.href ? <Link href={e.href} className="block">{body}</Link> : body}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Piè di pagina: legenda e stato vuoto */}
      {(visibleCount === 0 || (legends?.[colorMode]?.length ?? 0) > 0) && (
        <div className="px-3 py-2.5 border-t border-slate-200 bg-brand-50/40 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {visibleCount === 0 && (
            <p className="text-sm text-slate-500 flex items-center gap-1.5">
              <Icon name="calendar" className="w-4 h-4" /> {emptyHint}
            </p>
          )}
          {(legends?.[colorMode] ?? []).slice(0, 12).map((l) => {
            const c = patientColor(l.key);
            return (
              <span key={l.key + l.label} className="text-xs text-slate-600 flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} aria-hidden /> {l.label}
              </span>
            );
          })}
          {canEdit && (
            <span className="text-xs text-slate-400 ml-auto">
              Trascina per spostare · clic su uno spazio libero per creare
            </span>
          )}
        </div>
      )}
    </div>
  );
}
