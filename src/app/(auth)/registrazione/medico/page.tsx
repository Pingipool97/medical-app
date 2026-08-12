import { db } from '@/lib/db';
import DoctorForm from './form';

export const dynamic = 'force-dynamic';

export default async function RegisterDoctor() {
  const specs = await db.specialization.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  return <DoctorForm specializations={specs.map((s) => ({ value: s.code, label: s.name }))} />;
}
