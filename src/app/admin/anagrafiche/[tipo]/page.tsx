import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, Badge, PageTitle, BackLink, EmptyState } from '@/components/ui';
import { AnagraficaForm, ToggleActiveButton, type FieldSpec } from './forms';

export const dynamic = 'force-dynamic';

const SEVERITY_OPTIONS = [
  { value: 'GRAVE', label: 'Grave' },
  { value: 'MODERATA', label: 'Moderata' },
  { value: 'LIEVE', label: 'Lieve' },
];

type RowView = { id: string; active: boolean; cells: (string | null)[]; defaults: Record<string, string> };
type PageDef = { title: string; subtitle: string; columns: string[]; fields: FieldSpec[]; rows: RowView[] };

function parseAliases(json: string | null): string {
  if (!json) return '';
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.join(', ') : '';
  } catch {
    return '';
  }
}

async function buildPage(tipo: string): Promise<PageDef | null> {
  switch (tipo) {
    case 'specializzazioni': {
      const items = await db.specialization.findMany({ orderBy: { name: 'asc' } });
      return {
        title: 'Specializzazioni',
        subtitle: 'Specializzazioni mediche selezionabili in fase di registrazione e profilo medico.',
        columns: ['Codice', 'Nome'],
        fields: [
          { name: 'code', label: 'Codice', required: true, placeholder: 'cardiologia', hint: 'Identificativo tecnico, minuscolo.' },
          { name: 'name', label: 'Nome', required: true, placeholder: 'Cardiologia' },
        ],
        rows: items.map((i) => ({
          id: i.id,
          active: i.active,
          cells: [i.code, i.name],
          defaults: { code: i.code, name: i.name },
        })),
      };
    }
    case 'tipi-documento': {
      const items = await db.documentTypeDef.findMany({ orderBy: { name: 'asc' } });
      return {
        title: 'Tipi di documento',
        subtitle: 'Classificazione dei documenti caricati dai pazienti e dai medici.',
        columns: ['Codice', 'Nome'],
        fields: [
          { name: 'code', label: 'Codice', required: true, placeholder: 'REFERTO_LAB', readOnlyOnEdit: true, hint: 'Il codice non è modificabile dopo la creazione.' },
          { name: 'name', label: 'Nome', required: true, placeholder: 'Referto di laboratorio' },
        ],
        rows: items.map((i) => ({
          id: i.code,
          active: i.active,
          cells: [i.code, i.name],
          defaults: { code: i.code, name: i.name },
        })),
      };
    }
    case 'tipi-richiesta': {
      const items = await db.requestTypeDef.findMany({ orderBy: { name: 'asc' } });
      return {
        title: 'Tipi di richiesta',
        subtitle: 'Tipologie di richiesta paziente→medico, con SLA di risposta di default.',
        columns: ['Codice', 'Nome', 'SLA default (ore)'],
        fields: [
          { name: 'code', label: 'Codice', required: true, placeholder: 'RINNOVO_RICETTA', readOnlyOnEdit: true, hint: 'Il codice non è modificabile dopo la creazione.' },
          { name: 'name', label: 'Nome', required: true, placeholder: 'Rinnovo ricetta' },
          { name: 'defaultSlaHours', label: 'SLA di default (ore)', type: 'number', step: '1', required: true, placeholder: '48' },
        ],
        rows: items.map((i) => ({
          id: i.code,
          active: i.active,
          cells: [i.code, i.name, String(i.defaultSlaHours)],
          defaults: { code: i.code, name: i.name, defaultSlaHours: String(i.defaultSlaHours) },
        })),
      };
    }
    case 'analiti': {
      const items = await db.labAnalyte.findMany({ orderBy: { code: 'asc' } });
      return {
        title: 'Analiti di laboratorio',
        subtitle: 'Catalogo degli esami con unità di misura, range di riferimento e sinonimi per il matching estrattivo.',
        columns: ['Codice', 'Nome', 'Unità', 'Rif. min', 'Rif. max', 'Categoria', 'Sinonimi'],
        fields: [
          { name: 'code', label: 'Codice', required: true, placeholder: 'HGB' },
          { name: 'name', label: 'Nome', required: true, placeholder: 'Emoglobina' },
          { name: 'unit', label: 'Unità di misura', required: true, placeholder: 'g/dL' },
          { name: 'refLow', label: 'Riferimento min', type: 'number', step: 'any' },
          { name: 'refHigh', label: 'Riferimento max', type: 'number', step: 'any' },
          { name: 'category', label: 'Categoria', placeholder: 'Emocromo' },
          { name: 'aliases', label: 'Sinonimi', placeholder: 'Hb, emoglobina totale', hint: 'Separati da virgola: usati per riconoscere l’analita nei referti.' },
        ],
        rows: items.map((i) => ({
          id: i.id,
          active: i.active,
          cells: [i.code, i.name, i.unit, i.refLow?.toString() ?? '—', i.refHigh?.toString() ?? '—', i.category ?? '—', parseAliases(i.aliases) || '—'],
          defaults: {
            code: i.code,
            name: i.name,
            unit: i.unit,
            refLow: i.refLow?.toString() ?? '',
            refHigh: i.refHigh?.toString() ?? '',
            category: i.category ?? '',
            aliases: parseAliases(i.aliases),
          },
        })),
      };
    }
    case 'interazioni': {
      const items = await db.drugInteractionRule.findMany({ orderBy: [{ substanceA: 'asc' }, { substanceB: 'asc' }] });
      return {
        title: 'Interazioni farmacologiche',
        subtitle: 'Banca dati deterministica: il motore di controllo lavora su queste regole, mai su testo generato.',
        columns: ['Sostanza A', 'Sostanza B', 'Gravità', 'Nota'],
        fields: [
          { name: 'substanceA', label: 'Sostanza A', required: true, placeholder: 'warfarin', hint: 'Principio attivo o classe, minuscolo.' },
          { name: 'substanceB', label: 'Sostanza B', required: true, placeholder: 'acido acetilsalicilico' },
          { name: 'severity', label: 'Gravità', required: true, options: SEVERITY_OPTIONS },
          { name: 'note', label: 'Nota', required: true, placeholder: 'Aumentato rischio di sanguinamento' },
        ],
        rows: items.map((i) => ({
          id: i.id,
          active: i.active,
          cells: [i.substanceA, i.substanceB, i.severity, i.note],
          defaults: { substanceA: i.substanceA, substanceB: i.substanceB, severity: i.severity, note: i.note },
        })),
      };
    }
    case 'controindicazioni': {
      const items = await db.drugContraindication.findMany({ orderBy: { substance: 'asc' } });
      return {
        title: 'Controindicazioni',
        subtitle: 'Controindicazioni per singola sostanza: gravidanza, allattamento, allergie crociate.',
        columns: ['Sostanza', 'Condizione', 'Gravità', 'Nota'],
        fields: [
          { name: 'substance', label: 'Sostanza', required: true, placeholder: 'isotretinoina', hint: 'Principio attivo, minuscolo.' },
          { name: 'condition', label: 'Condizione', required: true, placeholder: 'GRAVIDANZA', hint: 'GRAVIDANZA | ALLATTAMENTO | ALLERGIA:<allergene>' },
          { name: 'severity', label: 'Gravità', required: true, options: SEVERITY_OPTIONS },
          { name: 'note', label: 'Nota', required: true, placeholder: 'Teratogena: controindicazione assoluta in gravidanza' },
        ],
        rows: items.map((i) => ({
          id: i.id,
          active: i.active,
          cells: [i.substance, i.condition, i.severity, i.note],
          defaults: { substance: i.substance, condition: i.condition, severity: i.severity, note: i.note },
        })),
      };
    }
    default:
      return null;
  }
}

const SEVERITY_BADGE: Record<string, 'red' | 'amber' | 'gray'> = { GRAVE: 'red', MODERATA: 'amber', LIEVE: 'gray' };

export default async function AnagraficaTipoPage({ params }: { params: { tipo: string } }) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') redirect('/login');

  const def = await buildPage(params.tipo);
  if (!def) notFound();

  const isSeverityCol = (col: string) => col === 'Gravità';

  return (
    <>
      <div className="mb-3"><BackLink href="/admin/anagrafiche" label="Tutte le anagrafiche" /></div>
      <PageTitle title={def.title} subtitle={def.subtitle} />

      <div className="space-y-4">
        <Card title={`Voci (${def.rows.length})`}>
          {def.rows.length === 0 ? (
            <EmptyState title="Nessuna voce presente" hint="Aggiungi la prima voce con il modulo qui sotto." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    {def.columns.map((c) => (
                      <th key={c} className="py-2 pr-3 font-medium">{c}</th>
                    ))}
                    <th className="py-2 pr-3 font-medium">Stato</th>
                    <th className="py-2 font-medium">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {def.rows.map((r) => (
                    <tr key={r.id} className={`border-b border-slate-100 align-top ${r.active ? '' : 'opacity-60'}`}>
                      {r.cells.map((cell, idx) => (
                        <td key={idx} className="py-2 pr-3">
                          {isSeverityCol(def.columns[idx]) && cell ? (
                            <Badge color={SEVERITY_BADGE[cell] ?? 'gray'}>{cell}</Badge>
                          ) : (
                            cell ?? '—'
                          )}
                        </td>
                      ))}
                      <td className="py-2 pr-3">
                        {r.active ? <Badge color="green">Attiva</Badge> : <Badge color="gray">Disattivata</Badge>}
                      </td>
                      <td className="py-2">
                        <div className="flex flex-col items-start gap-2">
                          <ToggleActiveButton tipo={params.tipo} id={r.id} active={r.active} />
                          <details className="w-full">
                            <summary className="cursor-pointer text-brand-700 text-xs hover:underline">Modifica</summary>
                            <div className="mt-3 p-3 rounded-lg border border-slate-200 bg-slate-50 min-w-[280px]">
                              <AnagraficaForm
                                tipo={params.tipo}
                                id={r.id}
                                fields={def.fields}
                                defaults={r.defaults}
                                submitLabel="Salva modifiche"
                              />
                            </div>
                          </details>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Aggiungi voce">
          <AnagraficaForm tipo={params.tipo} fields={def.fields} submitLabel="Aggiungi" />
        </Card>
      </div>
    </>
  );
}
