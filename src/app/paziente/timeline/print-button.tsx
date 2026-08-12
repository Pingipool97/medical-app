'use client';

import { Icon } from '@/components/icons';

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-secondary print:hidden inline-flex items-center gap-1.5">
      <Icon name="printer" className="w-4 h-4" /> Versione stampabile
    </button>
  );
}
