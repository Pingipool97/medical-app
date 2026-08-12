import AppShell from '@/components/AppShell';

export default function SegreteriaLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="STAFF">{children}</AppShell>;
}
