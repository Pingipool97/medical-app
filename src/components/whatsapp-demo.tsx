'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './icons';
import { AGENT_RULES, DEMO_CONVERSATIONS, type WaConversation, type WaMessage } from '@/lib/demo/whatsapp-data';

// Anteprima "WhatsApp con agente IA". Tutto in memoria: nessuna connessione a Meta,
// nessun messaggio reale, nessun dato salvato. Serve a far vedere il flusso e il layout.
//
// Layout a due pannelli su desktop (elenco + conversazione) e a pannello singolo su
// telefono, dove la conversazione copre lo schermo e si torna indietro con la freccia —
// come nell'app vera.

const BG_CHAT =
  // Trama leggera tipo sfondo WhatsApp, disegnata in CSS per non caricare immagini.
  'repeating-linear-gradient(45deg, rgba(0,0,0,0.014) 0 2px, transparent 2px 9px)';

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

/** Orario "HH:MM" a N minuti fa. Calcolato dopo il mount: in SSR darebbe un valore diverso. */
function useClockLabels(base: Date | null) {
  return useMemo(() => {
    if (!base) return null;
    return (minutesAgo: number) => {
      const d = new Date(base.getTime() - minutesAgo * 60_000);
      return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    };
  }, [base]);
}

function Ticks({ state }: { state?: WaMessage['state'] }) {
  if (!state) return null;
  const color = state === 'letto' ? 'text-sky-500' : 'text-slate-400';
  return (
    <span className={`inline-flex ${color}`} aria-label={state}>
      <svg viewBox="0 0 18 12" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M1 6.5 4.2 9.8 10.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
        {state !== 'inviato' && <path d="M7.2 6.5 10.4 9.8 16.7 2.5" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
    </span>
  );
}

function AttachmentBubble({ a }: { a: NonNullable<WaMessage['attachment']> }) {
  const icon = a.kind === 'image' ? 'file' : a.kind === 'audio' ? 'message' : 'file';
  return (
    <span className="flex items-center gap-2.5 rounded-lg bg-black/5 px-2.5 py-2 my-0.5">
      <span className="w-9 h-9 rounded-lg bg-white/80 flex items-center justify-center text-slate-500 shrink-0">
        <Icon name={icon} className="w-4 h-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium truncate">{a.name}</span>
        <span className="block text-[11px] text-slate-500">{a.size}</span>
      </span>
    </span>
  );
}

function Bubble({ m, time }: { m: WaMessage; time: string }) {
  const mine = m.author !== 'PAZIENTE';
  const isAgent = m.author === 'AGENTE';
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'} px-3`}>
      <div
        className={`relative max-w-[min(32rem,82%)] rounded-lg px-2.5 py-1.5 my-0.5 text-[15px] leading-snug shadow-sm ${
          mine ? 'bg-[#d9fdd3] text-slate-900' : 'bg-white text-slate-900'
        }`}
      >
        {mine && (
          <span className={`block text-[11px] font-semibold mb-0.5 ${isAgent ? 'text-accent-700' : 'text-brand-700'}`}>
            {isAgent ? 'Agente IA' : 'Tu'}
          </span>
        )}
        {m.attachment && <AttachmentBubble a={m.attachment} />}
        {m.text && <span className="whitespace-pre-wrap break-words">{m.text}</span>}
        <span className="float-right ml-2 mt-1 flex items-center gap-1 text-[11px] text-slate-500 select-none">
          {time}
          <Ticks state={m.state} />
        </span>
      </div>
    </div>
  );
}

export default function WhatsAppDemo({ embedded = false }: { embedded?: boolean }) {
  const [convs, setConvs] = useState<WaConversation[]>(DEMO_CONVERSATIONS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Gli orari si calcolano solo dopo il mount: in SSR il server e il browser
  // produrrebbero minuti diversi e React segnalerebbe un errore di idratazione.
  useEffect(() => setNow(new Date()), []);
  const at = useClockLabels(now);

  const active = convs.find((c) => c.id === activeId) ?? null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [activeId, active?.messages.length]);

  const filtered = convs.filter(
    (c) => c.name.toLowerCase().includes(query.toLowerCase()) || c.phone.includes(query),
  );

  const open = (id: string) => {
    setActiveId(id);
    setConvs((cs) => cs.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
  };

  const send = (attachment?: WaMessage['attachment']) => {
    if (!active || (!draft.trim() && !attachment)) return;
    const msg: WaMessage = {
      id: `x${Date.now()}`,
      author: 'MEDICO',
      text: draft.trim(),
      minutesAgo: 0,
      state: 'inviato',
      attachment,
    };
    setConvs((cs) =>
      cs.map((c) =>
        c.id === active.id
          ? { ...c, messages: [...c.messages, msg], handledBy: 'MEDICO', tag: 'Presa in carico' }
          : c,
      ),
    );
    setDraft('');
    // Riscontro di consegna simulato, per far vedere il comportamento delle spunte.
    setTimeout(() => {
      setConvs((cs) =>
        cs.map((c) =>
          c.id === active.id
            ? { ...c, messages: c.messages.map((m) => (m.id === msg.id ? { ...m, state: 'consegnato' } : m)) }
            : c,
        ),
      );
    }, 900);
  };

  const toggleHandler = () => {
    if (!active) return;
    setConvs((cs) =>
      cs.map((c) =>
        c.id === active.id
          ? { ...c, handledBy: c.handledBy === 'AGENTE' ? 'MEDICO' : 'AGENTE', tag: c.handledBy === 'AGENTE' ? 'Presa in carico' : 'Gestita dall’agente' }
          : c,
      ),
    );
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const kind: 'image' | 'pdf' | 'audio' =
      f.type.startsWith('image/') ? 'image' : f.type.startsWith('audio/') ? 'audio' : 'pdf';
    const kb = f.size / 1024;
    send({ name: f.name, kind, size: kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB` });
    e.target.value = '';
  };

  return (
    <div
      className={`flex flex-col bg-slate-100 ${
        embedded ? 'h-[calc(100dvh-10rem)] min-h-[32rem] rounded-xl border border-slate-200 overflow-hidden' : 'h-[100dvh]'
      }`}
    >
      {/* Fascia di avviso: questa è un'anteprima, non un'integrazione attiva */}
      <div className="bg-amber-100 border-b border-amber-300 text-amber-900 text-xs px-3 py-1.5 flex items-center gap-2 shrink-0">
        <Icon name="shield" className="w-4 h-4 shrink-0" />
        <span className="flex-1">
          <strong>Anteprima dimostrativa.</strong> Conversazioni finte: nessun collegamento a Meta/WhatsApp, nessun messaggio inviato davvero.
        </span>
        {!embedded && <a href="/login" className="underline whitespace-nowrap">Esci</a>}
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* ── Elenco conversazioni ── */}
        <aside
          className={`${active ? 'hidden md:flex' : 'flex'} w-full md:w-[22rem] shrink-0 flex-col border-r border-slate-300 bg-white`}
        >
          <header className="surface-brand px-3 py-2.5 border-b border-slate-200 flex items-center gap-2">
            <span className="w-9 h-9 rounded-full bg-accent-600 text-white flex items-center justify-center text-sm font-semibold shrink-0">
              LB
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-brand-950 text-sm truncate">Studio Bianchi</p>
              <p className="text-[11px] text-slate-500 truncate">Agente IA attivo · 5 conversazioni</p>
            </div>
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="w-9 h-9 rounded-full hover:bg-white/60 flex items-center justify-center text-slate-600"
              aria-label="Impostazioni agente"
            >
              <Icon name="settings" className="w-4.5 h-4.5" />
            </button>
          </header>

          <div className="p-2 border-b border-slate-200">
            <div className="relative">
              <Icon name="search" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cerca o inizia una chat"
                className="w-full rounded-lg bg-slate-100 pl-9 pr-3 py-2 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-brand-300"
              />
            </div>
          </div>

          <ul className="flex-1 overflow-y-auto">
            {filtered.map((c) => {
              const last = c.messages[c.messages.length - 1];
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => open(c.id)}
                    className={`w-full text-left flex gap-3 px-3 py-2.5 border-b border-slate-100 hover:bg-slate-50 ${
                      activeId === c.id ? 'bg-brand-50' : ''
                    }`}
                  >
                    <span
                      className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${
                        c.patientLinked ? 'bg-brand-100 text-brand-800' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {c.patientLinked ? initials(c.name) : '?'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="font-medium text-slate-900 truncate flex-1">{c.name}</span>
                        <span className="text-[11px] text-slate-400 shrink-0">{at ? at(last.minutesAgo) : ''}</span>
                      </span>
                      <span className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[13px] text-slate-500 truncate flex-1 flex items-center gap-1">
                          {last.author !== 'PAZIENTE' && <span className="text-slate-400 shrink-0">✓</span>}
                          {last.attachment && <Icon name="paperclip" className="w-3.5 h-3.5 shrink-0 text-slate-400" />}
                          <span className="truncate">{last.attachment ? last.attachment.name : last.text}</span>
                        </span>
                        {c.unread > 0 && (
                          <span className="shrink-0 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-accent-600 text-white text-[11px] font-semibold flex items-center justify-center">
                            {c.unread}
                          </span>
                        )}
                      </span>
                      {c.tag && (
                        <span
                          className={`inline-flex items-center gap-1 mt-1 text-[10px] px-1.5 py-0.5 rounded ${
                            c.handledBy === 'AGENTE' ? 'bg-accent-50 text-accent-800' : 'bg-brand-50 text-brand-800'
                          }`}
                        >
                          <Icon name={c.handledBy === 'AGENTE' ? 'cpu' : 'user'} className="w-3 h-3" />
                          {c.tag}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && <li className="p-6 text-center text-sm text-slate-500">Nessuna conversazione trovata.</li>}
          </ul>
        </aside>

        {/* ── Conversazione ── */}
        <section className={`${active ? 'flex' : 'hidden md:flex'} flex-1 min-w-0 flex-col`}>
          {!active ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 bg-slate-50">
              <Icon name="message" className="w-12 h-12 text-slate-300" />
              <p className="mt-3 text-slate-500">Seleziona una conversazione per leggerla</p>
              <p className="text-sm text-slate-400 mt-1 max-w-sm">
                L’agente IA risponde da solo su agenda, prezzi e promemoria. Sulle domande cliniche si ferma e passa la parola a te.
              </p>
            </div>
          ) : (
            <>
              <header className="surface-brand px-2 py-2 border-b border-slate-200 flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveId(null)}
                  className="md:hidden w-9 h-9 rounded-full hover:bg-white/60 flex items-center justify-center text-slate-600 text-xl"
                  aria-label="Torna all’elenco"
                >
                  ‹
                </button>
                <span
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${
                    active.patientLinked ? 'bg-brand-100 text-brand-800' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {active.patientLinked ? initials(active.name) : '?'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 text-sm truncate">{active.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">{active.phone}</p>
                </div>
                <button
                  type="button"
                  onClick={toggleHandler}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border whitespace-nowrap ${
                    active.handledBy === 'AGENTE'
                      ? 'bg-white border-brand-300 text-brand-800 hover:bg-brand-50'
                      : 'bg-accent-50 border-accent-300 text-accent-800 hover:bg-accent-100'
                  }`}
                >
                  {active.handledBy === 'AGENTE' ? 'Prendi in carico' : 'Torna all’agente'}
                </button>
              </header>

              {active.handledBy === 'MEDICO' && (
                <p className="bg-brand-50 text-brand-900 text-[11px] px-3 py-1.5 border-b border-brand-100 shrink-0">
                  Stai rispondendo tu: l’agente IA non interviene finché non gliela restituisci.
                </p>
              )}

              <div className="flex-1 overflow-y-auto py-3 bg-[#efeae2]" style={{ backgroundImage: BG_CHAT }}>
                {!active.patientLinked && (
                  <p className="mx-3 mb-3 text-[12px] text-center bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-3 py-2">
                    Numero non collegato a nessun paziente in piattaforma: nessun dato clinico è accessibile da questa chat.
                  </p>
                )}
                {active.messages.map((m) => (
                  <Bubble key={m.id} m={m} time={at ? at(m.minutesAgo) : ''} />
                ))}
                <div ref={endRef} />
              </div>

              <div className="bg-slate-100 border-t border-slate-200 px-2 py-2 flex items-end gap-2 shrink-0">
                <input ref={fileRef} type="file" className="hidden" onChange={onFile} />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-10 h-10 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500 shrink-0"
                  aria-label="Allega un file"
                >
                  <Icon name="paperclip" className="w-5 h-5" />
                </button>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  placeholder="Scrivi un messaggio"
                  className="flex-1 resize-none rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[15px] outline-none focus:ring-2 focus:ring-brand-300 max-h-32"
                />
                <button
                  type="button"
                  onClick={() => send()}
                  disabled={!draft.trim()}
                  className="w-10 h-10 rounded-full bg-accent-600 text-white flex items-center justify-center shrink-0 disabled:opacity-40"
                  aria-label="Invia"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2z" /></svg>
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      {/* ── Impostazioni dell'agente ── */}
      {showSettings && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}
        >
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[85dvh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-brand-950">Agente IA — cosa gestisce</h2>
            <p className="text-sm text-slate-600 mt-1 mb-4">
              L’agente risponde da solo entro questo perimetro. Tutto il resto arriva a te.
            </p>
            <ul className="space-y-3">
              {AGENT_RULES.map((r) => (
                <li key={r.key} className="flex gap-3">
                  <span
                    className={`mt-0.5 w-9 h-5 rounded-full shrink-0 relative ${r.on ? 'bg-accent-600' : 'bg-slate-300'}`}
                    aria-hidden
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${r.on ? 'left-[1.15rem]' : 'left-0.5'}`} />
                  </span>
                  <span>
                    <span className="block font-medium text-slate-900 text-sm">{r.label}</span>
                    <span className="block text-[13px] text-slate-600">{r.desc}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-500 mt-4 border-t border-slate-200 pt-3">
              Nell’anteprima gli interruttori sono fissi: servono a mostrare il perimetro, non sono ancora collegati.
            </p>
            <button type="button" onClick={() => setShowSettings(false)} className="btn-primary w-full mt-4">
              Chiudi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
