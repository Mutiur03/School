import { redirect } from 'next/navigation';
import { getClass6RegistrationSettings } from '@/queries/registration.queries';
import RegistrationFormClient from '../../_shared/RegistrationFormClient';

export const metadata = {
  title: 'Class Six Registration Form',
};

export default async function Class6RegistrationFormPage() {
  const settings = await getClass6RegistrationSettings();

  if (!settings.reg_open) {
    redirect('/');
  }

  return <RegistrationFormClient kind="class-6" settings={settings} />;
}
