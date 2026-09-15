import Link from 'next/link';
import { Icon } from './icons';
import { fmtEuro } from '@/lib/format';
import { PREMIUM_BENEFITS, PREMIUM_PRICE_CENTS } from '@/lib/constants';

// Schermata mostrata al posto di una funzione IA quando il piano non la comprende.
// Spiega cosa si ottiene e quanto costa, senza togliere nulla di ciò che era già
// disponibile: il resto dell'app resta gratuito e raggiungibile.

export function PremiumGate({
  title = 'Funzione inclusa nel piano Premium',
  description = 'L’intelligenza artificiale di HABITUS è riservata agli abbonati.',
  compact = false,
}: {
  title?: string;
  description?: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-xl border border-accent-200 bg-gradient-to-b from-accent-50/70 to-white p-5 text-center">
      <span className="inline-flex w-11 h-11 rounded-xl bg-accent-100 text-accent-700 items-center justify-center mb-3">
        <Icon name="sparkles" className="w-5 h-5" />
      </span>
      <h3 className="font-semibold text-brand-950">{title}</h3>
      <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">{description}</p>

      {!compact && (
        <ul className="mt-4 text-left max-w-md mx-auto space-y-2">
          {PREMIUM_BENEFITS.slice(0, 3).map((b) => (
            <li key={b.title} className="flex gap-2 text-sm">
              <Icon name="check" className="w-4 h-4 text-accent-600 shrink-0 mt-0.5" />
              <span>
                <span className="font-medium text-brand-950">{b.title}</span>
                <span className="text-slate-600"> — {b.desc}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <Link href="/paziente/abbonamento" className="btn-primary">
          Attiva Premium — {fmtEuro(PREMIUM_PRICE_CENTS)}/anno
        </Link>
        <span className="text-xs text-slate-500">Il resto dell’app resta gratuito.</span>
      </div>
    </div>
  );
}
