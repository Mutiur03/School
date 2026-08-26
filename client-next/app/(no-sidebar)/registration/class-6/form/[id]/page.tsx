import { redirect } from 'next/navigation';
import {
  getClass6RegistrationRecord,
  getClass6RegistrationSettings,
} from '@/queries/registration.queries';
import RegistrationFormClient from '../../../_shared/RegistrationFormClient';

interface Class6RegistrationEditPageProps {
  params: Promise<{
    id: string;
  }>;
}

export const metadata = {
  title: 'Edit Class Six Registration',
};

export default async function Class6RegistrationEditPage({
  params,
}: Class6RegistrationEditPageProps) {
  const { id } = await params;
  const [settings, record] = await Promise.all([
    getClass6RegistrationSettings(),
    getClass6RegistrationRecord(id),
  ]);

  if (!record) {
    redirect('/registration/class-6/form');
  }

  if (record.status && record.status !== 'pending') {
    redirect(`/registration/class-6/confirm/${id}`);
  }

  if (!settings.reg_open) {
    redirect('/');
  }

  return <RegistrationFormClient kind="class-6" settings={settings} initialRecord={record} />;
}
