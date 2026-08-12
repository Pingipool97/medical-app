// Set di icone SVG professionali (stile lineare, stroke currentColor).
// Uso: <Icon name="home" className="w-5 h-5" />

const PATHS: Record<string, React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5M5.5 8.5V21h13V8.5M9.5 21v-6h5v6" />,
  activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  file: <path d="M14 3H6v18h12V7l-4-4zM14 3v4h4M9 12h6M9 16h6" />,
  book: <path d="M4 4h12a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2V4zM4 17a2 2 0 0 1 2-2h12M8 8h6" />,
  inbox: <path d="M3 13h5l2 3h4l2-3h5M5 5h14l2 8v6H3v-6l2-8z" />,
  message: <path d="M21 12a8 8 0 0 1-8 8H4l1.5-3A8 8 0 1 1 21 12zM8.5 12h.01M12 12h.01M15.5 12h.01" />,
  calendar: <path d="M4 6h16v15H4V6zM8 3v5M16 3v5M4 11h16" />,
  stethoscope: <path d="M5 3v6a5 5 0 0 0 10 0V3M10 14v3a5 5 0 0 0 10 0v-2M20 13a2 2 0 1 0 0 2" />,
  help: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5A2.5 2.5 0 0 1 14 11c0 1.5-2 2-2 3.2M12 17.2h.01" />,
  shield: <path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6l8-3zM9 12l2 2 4-4" />,
  settings: <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.15-1.4l2.1-1.6-2-3.4-2.5 1a7 7 0 0 0-2.4-1.4L13.6 2.5h-3.2l-.45 2.7a7 7 0 0 0-2.4 1.4l-2.5-1-2 3.4 2.1 1.6A7 7 0 0 0 5 12c0 .5.05 1 .15 1.4l-2.1 1.6 2 3.4 2.5-1a7 7 0 0 0 2.4 1.4l.45 2.7h3.2l.45-2.7a7 7 0 0 0 2.4-1.4l2.5 1 2-3.4-2.1-1.6c.1-.4.15-.9.15-1.4z" />,
  users: <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M15 3.1a4 4 0 0 1 0 7.8" />,
  sparkles: <path d="M12 4l1.8 4.6L18 10.4l-4.2 1.8L12 16.8l-1.8-4.6L6 10.4l4.2-1.8L12 4zM19 15l.9 2.3L22 18l-2.1.7L19 21l-.9-2.3L16 18l2.1-.7L19 15zM5 3l.7 1.8L7.5 5.5l-1.8.7L5 8l-.7-1.8L2.5 5.5l1.8-.7L5 3z" />,
  chart: <path d="M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3M20 16V6" />,
  key: <path d="M15 9a6 6 0 1 0-5.7 6L11 13.3V11h2.3L15 9zM15 9l6 6-2 2-2-2-2 2-2-2" />,
  pencil: <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1zM14 6l4 4" />,
  mail: <path d="M3 6h18v12H3V6zM3 7l9 6 9-6" />,
  bell: <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6zM10 19a2 2 0 0 0 4 0" />,
  folder: <path d="M3 6h6l2 2h10v12H3V6z" />,
  search: <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5" />,
  clipboard: <path d="M9 4h6v3H9V4zM9 4H6v17h12V4h-3M9 11h6M9 15h6" />,
  toggle: <path d="M8 17a5 5 0 1 1 0-10h8a5 5 0 1 1 0 10H8zM16 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />,
  printer: <path d="M7 8V3h10v5M5 8h14a2 2 0 0 1 2 2v6h-4M5 8a2 2 0 0 0-2 2v6h4M7 13h10v8H7v-8z" />,
  paperclip: <path d="M20 11.5 11.7 19.8a5 5 0 0 1-7-7L13 4.5a3.3 3.3 0 0 1 4.7 4.7L9.5 17.4a1.7 1.7 0 0 1-2.4-2.4l7.6-7.6" />,
  refresh: <path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" />,
  check: <path d="M4 12.5 10 18 20 6" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  flask: <path d="M10 3h4M10 3v6l-6 10a2 2 0 0 0 1.8 3h12.4a2 2 0 0 0 1.8-3L14 9V3M7.5 15h9" />,
  cpu: <path d="M7 7h10v10H7V7zM10 10h4v4h-4v-4zM9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />,
  user: <path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" />,
  logout: <path d="M9 21H4V3h5M15 16l4-4-4-4M19 12H9" />,
};

export function Icon({ name, className = 'w-5 h-5' }: { name: string; className?: string }) {
  const path = PATHS[name] ?? PATHS.file;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {path}
    </svg>
  );
}
