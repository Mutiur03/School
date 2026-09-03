import { redirect } from 'next/navigation';
import { fetchSchoolConfig } from '@/queries/school.queries';
import { getJuniorScholarshipRegistrationSettings } from '@/queries/registration.queries';
import RegistrationFormClient from '../../_shared/RegistrationFormClient';

export const metadata = {
  title: 'Junior Scholarship Examination Form',
};

export default async function JuniorScholarshipFormPage() {
  const [settings, schoolConfig] = await Promise.all([
    getJuniorScholarshipRegistrationSettings(),
    fetchSchoolConfig(),
  ]);

  if (!settings.reg_open) {
    redirect('/');
  }

  return (
    <RegistrationFormClient
      kind="junior-scholarship"
      schoolConfig={schoolConfig}
      settings={settings}
    />
  );
}
