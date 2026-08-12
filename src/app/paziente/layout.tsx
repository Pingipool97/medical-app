import AppShell from '@/components/AppShell';

export default function L({ children }: { children: React.ReactNode }) {
  return <AppShell role="PATIENT">{children}</AppShell>;
}
