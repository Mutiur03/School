import { redirect } from 'next/navigation';
import { fetchSchoolConfig } from '@/queries/school.queries';
import { getClass8RegistrationSettings } from '@/queries/registration.queries';
import RegistrationFormClient from '../../_shared/RegistrationFormClient';

export const metadata = {
  title: 'Class Eight Registration Form',
};

export default async function Class8RegistrationFormPage() {
  const [settings, schoolConfig] = await Promise.all([
    getClass8RegistrationSettings(),
    fetchSchoolConfig(),
  ]);

  if (!settings.reg_open) {
    redirect('/');
  }

  return <RegistrationFormClient kind="class-8" schoolConfig={schoolConfig} settings={settings} />;
}
