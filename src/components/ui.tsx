import Link from 'next/link';

// Primitive UI condivise. Linguaggio: sempre italiano comprensibile, mai messaggi tecnici grezzi.

export function Card({ title, children, action, className = '' }: { title?: string; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <section className={`card p-4 sm:p-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-3 gap-2">
          {title && <h2 className="text-base font-semibold text-slate-800">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const BADGE_STYLES: Record<string, string> = {
  gray: 'bg-slate-100 text-slate-700',
  blue: 'bg-brand-100 text-brand-800',
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
  violet: 'bg-violet-100 text-violet-800',
};

export function Badge({ color = 'gray', children }: { color?: keyof typeof BADGE_STYLES; children: React.ReactNode }) {
  return <span className={`badge ${BADGE_STYLES[color] ?? BADGE_STYLES.gray}`}>{children}</span>;
}

export function statusBadgeColor(status: string): keyof typeof BADGE_STYLES {
  const map: Record<string, keyof typeof BADGE_STYLES> = {
    NUOVA: 'blue', PRESA_IN_CARICO: 'amber', ATTESA_INFO: 'violet', EVASA: 'green', RIFIUTATA: 'red', ANNULLATA: 'gray',
    UPLOADED: 'gray', PROCESSING: 'amber', PROCESSED: 'green', FAILED: 'red', QUARANTINED: 'red', NEEDS_REVIEW: 'amber',
    PRENOTATO: 'blue', CONFERMATO: 'green', ANNULLATO: 'gray', COMPLETATO: 'green', NO_SHOW: 'red',
    DRAFT: 'amber', REVIEWED: 'blue', PUBLISHED: 'green', REJECTED: 'gray', EXPIRED: 'gray',
    ACTIVE: 'green', PENDING: 'amber', REVOKED: 'red', ENDED: 'gray', VERIFIED: 'green',
  };
  return map[status] ?? 'gray';
}

export function Field({ label, name, type = 'text', required, defaultValue, placeholder, hint, ...rest }: {
  label: string; name: string; type?: string; required?: boolean; defaultValue?: string; placeholder?: string; hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}{required && <span className="text-red-600" aria-hidden> *</span>}</label>
      <input id={name} name={name} type={type} required={required} defaultValue={defaultValue} placeholder={placeholder} className="input" {...rest} />
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

export function SelectField({ label, name, options, required, defaultValue, hint }: {
  label: string; name: string; options: { value: string; label: string }[]; required?: boolean; defaultValue?: string; hint?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}{required && <span className="text-red-600" aria-hidden> *</span>}</label>
      <select id={name} name={name} required={required} defaultValue={defaultValue ?? ''} className="input">
        <option value="" disabled>Seleziona…</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

export function TextArea({ label, name, required, defaultValue, placeholder, rows = 4, hint }: {
  label: string; name: string; required?: boolean; defaultValue?: string; placeholder?: string; rows?: number; hint?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}{required && <span className="text-red-600" aria-hidden> *</span>}</label>
      <textarea id={name} name={name} required={required} defaultValue={defaultValue} placeholder={placeholder} rows={rows} className="input" />
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

export function Alert({ kind = 'info', children }: { kind?: 'info' | 'warn' | 'error' | 'success' | 'critical'; children: React.ReactNode }) {
  const styles = {
    info: 'border-brand-300 bg-brand-50 text-brand-900',
    warn: 'border-amber-300 bg-amber-50 text-amber-900',
    error: 'border-red-300 bg-red-50 text-red-900',
    success: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    critical: 'border-red-600 border-2 bg-red-50 text-red-900 font-medium',
  };
  return <div role={kind === 'error' || kind === 'critical' ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${styles[kind]}`}>{children}</div>;
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="text-center py-10 px-4">
      <p className="text-slate-600 font-medium">{title}</p>
      {hint && <p className="text-sm text-slate-500 mt-1">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-600 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// Disclaimer IA non rimovibile: componente unico usato ovunque compaia output IA
export function AiDisclaimer({ audience = 'DOCTOR' }: { audience?: 'DOCTOR' | 'PATIENT' }) {
  return (
    <p className="text-xs text-slate-500 border-t border-slate-200 pt-2 mt-3">
      ⚕️ {audience === 'DOCTOR'
        ? 'Contenuto generato da IA a supporto del medico. Non costituisce diagnosi né prescrizione: ogni decisione clinica spetta al medico.'
        : 'Spiegazione informativa generata automaticamente e validata dal tuo medico. Non sostituisce il parere medico.'}
    </p>
  );
}

export function EmergencyBanner() {
  return (
    <div className="alert-critical text-sm" role="note">
      ⚠️ Questa piattaforma NON è un canale di emergenza. In caso di sintomi gravi o improvvisi chiama subito il <strong>112</strong>.
    </div>
  );
}

export function BackLink({ href, label = 'Indietro' }: { href: string; label?: string }) {
  return <Link href={href} className="text-sm text-brand-700 hover:underline">← {label}</Link>;
}
