// Grafico SVG scritto a mano per l'andamento di un analita:
// linea dei valori, banda del range di riferimento, punti vuoti per i valori
// estratti automaticamente e non ancora confermati da un umano.

export type LabPoint = { dateISO: string; value: number; confirmed: boolean };

export function LabChart({
  name, unit, refLow, refHigh, points,
}: {
  name: string;
  unit: string;
  refLow: number | null;
  refHigh: number | null;
  points: LabPoint[];
}) {
  const W = 640, H = 220, PL = 52, PR = 14, PT = 14, PB = 32;
  const sorted = [...points].sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  const times = sorted.map((p) => new Date(p.dateISO).getTime());
  const values = sorted.map((p) => p.value);

  let vMin = Math.min(...values, refLow ?? Infinity);
  let vMax = Math.max(...values, refHigh ?? -Infinity);
  if (!isFinite(vMin)) vMin = Math.min(...values);
  if (!isFinite(vMax)) vMax = Math.max(...values);
  if (vMin === vMax) { vMin -= 1; vMax += 1; }
  const span = vMax - vMin;
  vMin -= span * 0.12;
  vMax += span * 0.12;

  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const x = (t: number) => PL + ((t - t0) / (t1 - t0 || 1)) * (W - PL - PR);
  const y = (v: number) => PT + (1 - (v - vMin) / (vMax - vMin)) * (H - PT - PB);

  const fmt = (d: string) => new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const fmtVal = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, ''));

  const polyline = sorted.map((p, i) => `${x(times[i]).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const bandTop = refHigh != null ? y(Math.min(refHigh, vMax)) : null;
  const bandBottom = refLow != null ? y(Math.max(refLow, vMin)) : null;

  return (
    <div>
      <p className="text-sm font-semibold text-slate-800">
        {name} <span className="font-normal text-slate-500">({unit || 'u. n.d.'})</span>
      </p>
      <div className="overflow-x-auto mt-1">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`Andamento di ${name}`} className="max-w-full h-auto">
          {/* Banda del range di riferimento */}
          {bandTop != null && bandBottom != null && bandBottom > bandTop && (
            <rect x={PL} y={bandTop} width={W - PL - PR} height={bandBottom - bandTop} fill="#d1fae5" opacity={0.7} />
          )}
          {refHigh != null && (
            <>
              <line x1={PL} x2={W - PR} y1={y(refHigh)} y2={y(refHigh)} stroke="#059669" strokeWidth={1} strokeDasharray="4 3" />
              <text x={W - PR} y={y(refHigh) - 3} textAnchor="end" fontSize={10} fill="#059669">max {fmtVal(refHigh)}</text>
            </>
          )}
          {refLow != null && (
            <>
              <line x1={PL} x2={W - PR} y1={y(refLow)} y2={y(refLow)} stroke="#059669" strokeWidth={1} strokeDasharray="4 3" />
              <text x={W - PR} y={y(refLow) + 11} textAnchor="end" fontSize={10} fill="#059669">min {fmtVal(refLow)}</text>
            </>
          )}

          {/* Assi */}
          <line x1={PL} x2={PL} y1={PT} y2={H - PB} stroke="#94a3b8" strokeWidth={1} />
          <line x1={PL} x2={W - PR} y1={H - PB} y2={H - PB} stroke="#94a3b8" strokeWidth={1} />
          <text x={PL - 6} y={y(Math.max(...values)) + 3} textAnchor="end" fontSize={10} fill="#475569">{fmtVal(Math.max(...values))}</text>
          <text x={PL - 6} y={y(Math.min(...values)) + 3} textAnchor="end" fontSize={10} fill="#475569">{fmtVal(Math.min(...values))}</text>
          <text x={PL} y={H - PB + 14} textAnchor="start" fontSize={10} fill="#475569">{fmt(sorted[0].dateISO)}</text>
          <text x={W - PR} y={H - PB + 14} textAnchor="end" fontSize={10} fill="#475569">{fmt(sorted[sorted.length - 1].dateISO)}</text>

          {/* Linea dei valori */}
          <polyline points={polyline} fill="none" stroke="#1d4ed8" strokeWidth={2} />

          {/* Punti: pieni = confermati, vuoti tratteggiati = estratti non confermati */}
          {sorted.map((p, i) => (
            <g key={i}>
              <circle
                cx={x(times[i])}
                cy={y(p.value)}
                r={4.5}
                fill={p.confirmed ? '#1d4ed8' : '#ffffff'}
                stroke="#1d4ed8"
                strokeWidth={1.5}
                strokeDasharray={p.confirmed ? undefined : '2 2'}
              />
              <title>{`${fmtVal(p.value)} ${unit} — ${fmt(p.dateISO)}${p.confirmed ? '' : ' (non confermato)'}`}</title>
            </g>
          ))}
        </svg>
      </div>
      <p className="text-xs text-slate-500 mt-1">
        <span aria-hidden>●</span> valore confermato · <span aria-hidden>◌</span> valore estratto automaticamente, non confermato ·{' '}
        <span className="inline-block w-3 h-3 align-middle rounded-sm bg-emerald-100 border border-emerald-300" aria-hidden /> range di riferimento
      </p>
    </div>
  );
}
