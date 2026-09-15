// Logo HABITUS. Due varianti dallo stesso brand:
//  - `full`  → logo orizzontale con wordmark, per intestazioni e pagine pubbliche
//  - `mark`  → solo il segno (figura nelle cornici), per spazi stretti e favicon-like
// Sono <img> semplici, come l'unica altra immagine del progetto: niente next/image,
// che qui non aggiungerebbe nulla (asset locali, dimensioni note, nessun layout shift
// perché width/height sono sempre dichiarate).

export function Logo({
  variant = 'full',
  className = '',
  priority = false,
}: {
  variant?: 'full' | 'mark';
  className?: string;
  priority?: boolean;
}) {
  if (variant === 'mark') {
    return (
      <img
        src="/logo-habitus-mark.png"
        alt="HABITUS"
        width={240}
        height={260}
        className={className}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
      />
    );
  }
  return (
    <img
      src="/logo-habitus.png"
      alt="HABITUS — Fisio·Benessere"
      width={320}
      height={117}
      className={className}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
    />
  );
}
