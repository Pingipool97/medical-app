'use client';

import { useState } from 'react';
import { markIssuedReadAction } from '@/app/actions/issued';
import { Badge } from '@/components/ui';

// Dettaglio espandibile: alla prima apertura il documento viene segnato come letto
export function IssuedItem({ id, header, alreadyRead, children }: {
  id: string;
  header: React.ReactNode;
  alreadyRead: boolean;
  children: React.ReactNode;
}) {
  const [read, setRead] = useState(alreadyRead);
  return (
    <details
      className="card"
      onToggle={(e) => {
        if ((e.target as HTMLDetailsElement).open && !read) {
          setRead(true);
          void markIssuedReadAction(id);
        }
      }}
    >
      <summary className="cursor-pointer select-none px-4 sm:px-5 py-3.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {header}
          {read ? <Badge color="gray">Letto</Badge> : <Badge color="blue">Da leggere</Badge>}
        </div>
      </summary>
      <div className="px-4 sm:px-5 pb-4 border-t border-slate-100 pt-3">{children}</div>
    </details>
  );
}
