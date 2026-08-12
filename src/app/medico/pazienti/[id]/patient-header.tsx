import { ageFrom } from '@/lib/format';
import { Badge } from '@/components/ui';

type HeaderPatient = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: Date;
  biologicalSex: string;
  allergies: { id: string; allergen: string; severity: string; kind: string; reaction: string | null }[];
  pregnancy: { isPregnant: boolean; isBreastfeeding: boolean } | null;
};

// Header di sicurezza della cartella: sempre visibile in ogni vista del paziente.
// Le allergie non si nascondono MAI.
export function PatientHeader({ patient }: { patient: HeaderPatient }) {
  return (
    <div className="sticky top-0 lg:top-0 z-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-white border-b border-slate-200 shadow-sm space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-lg font-bold text-slate-900">
          {patient.firstName} {patient.lastName}
        </h1>
        <span className="text-sm text-slate-600">
          {ageFrom(patient.birthDate)} anni · {patient.biologicalSex === 'F' ? 'F' : 'M'}
        </span>
        {patient.pregnancy?.isPregnant && <Badge color="amber">Gravidanza in corso</Badge>}
        {patient.pregnancy?.isBreastfeeding && <Badge color="amber">Allattamento</Badge>}
      </div>
      {patient.allergies.length > 0 ? (
        <div className="alert-critical !py-2 text-sm" role="alert">
          ⚠️ <strong>ALLERGIE:</strong>{' '}
          {patient.allergies
            .map((a) => `${a.allergen} (${a.severity.toLowerCase()}${a.reaction ? `, reazione: ${a.reaction}` : ''})`)
            .join(' · ')}
        </div>
      ) : (
        <p className="text-xs text-slate-500">Nessuna allergia registrata nel diario del paziente (verifica sempre in anamnesi).</p>
      )}
    </div>
  );
}
