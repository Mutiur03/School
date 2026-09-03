import { redirect } from 'next/navigation';
import { fetchSchoolConfig } from '@/queries/school.queries';
import {
  getJuniorScholarshipRegistrationRecord,
  getJuniorScholarshipRegistrationSettings,
} from '@/queries/registration.queries';
import RegistrationFormClient from '../../../_shared/RegistrationFormClient';

interface JuniorScholarshipEditPageProps {
  params: Promise<{
    id: string;
  }>;
}

export const metadata = {
  title: 'Edit Junior Scholarship Examination Form',
};

export default async function JuniorScholarshipEditPage({
  params,
}: JuniorScholarshipEditPageProps) {
  const { id } = await params;
  const [settings, record, schoolConfig] = await Promise.all([
    getJuniorScholarshipRegistrationSettings(),
    getJuniorScholarshipRegistrationRecord(id),
    fetchSchoolConfig(),
  ]);

  if (!record) {
    redirect('/registration/junior-scholarship/form');
  }

  if (record.status && record.status !== 'pending') {
    redirect(`/registration/junior-scholarship/confirm/${id}`);
  }

  if (!settings.reg_open) {
    redirect('/');
  }

  return (
    <RegistrationFormClient
      kind="junior-scholarship"
      schoolConfig={schoolConfig}
      settings={settings}
      initialRecord={record}
    />
  );
}
