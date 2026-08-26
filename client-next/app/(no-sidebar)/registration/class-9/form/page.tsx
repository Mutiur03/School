import { redirect } from 'next/navigation';
import { fetchSchoolConfig } from '@/queries/school.queries';
import { getClass9RegistrationSettings } from '@/queries/registration.queries';
import RegistrationFormClient from '../../_shared/RegistrationFormClient';

export const metadata = {
  title: 'SSC Registration Form',
};

export default async function Class9RegistrationFormPage() {
  const [settings, schoolConfig] = await Promise.all([
    getClass9RegistrationSettings(),
    fetchSchoolConfig(),
  ]);

  if (!settings.reg_open) {
    redirect('/');
  }

  return <RegistrationFormClient kind="class-9" schoolConfig={schoolConfig} settings={settings} />;
}
