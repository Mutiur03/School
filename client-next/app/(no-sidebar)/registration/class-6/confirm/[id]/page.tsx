import { redirect } from 'next/navigation';
import { fetchSchoolConfig } from '@/queries/school.queries';
import {
  getClass6RegistrationRecord,
  getClass6RegistrationSettings,
} from '@/queries/registration.queries';
import ConfirmationClient from '../../../_shared/ConfirmationClient';
import ConfirmDownloadPDF from '@/components/ConfirmDownloadPDF';

interface Class6RegistrationConfirmPageProps {
  params: Promise<{
    id: string;
  }>;
}

export const metadata = {
  title: 'Class Six Registration Confirmation',
};

export default async function Class6RegistrationConfirmPage({
  params,
}: Class6RegistrationConfirmPageProps) {
  const { id } = await params;
  const [schoolConfig, settings, registration] = await Promise.all([
    fetchSchoolConfig(),
    getClass6RegistrationSettings(),
    getClass6RegistrationRecord(id),
  ]);

  if (!registration) {
    redirect('/registration/class-6/form');
  }

  if (!settings.reg_open && registration.status !== 'approved') {
    redirect('/');
  }

  const pdfUrl = `/api/reg/class-6/form/${id}/pdf`;

  if (registration.status === 'approved') {
    return (
      <ConfirmDownloadPDF
        schoolConfig={schoolConfig}
        pdfUrl={pdfUrl}
        downloadFilename={`Class6_Reg_${registration.student_name_en?.replace(/\s+/g, '_')}.pdf`}
      />
    );
  }

  return (
    <ConfirmationClient
      kind="class-6"
      registration={registration}
      schoolConfig={schoolConfig}
      pdfUrl={pdfUrl}
    />
  );
}
