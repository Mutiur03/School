import { redirect } from 'next/navigation';
import { fetchSchoolConfig } from '@/queries/school.queries';
import {
  getClass8RegistrationRecord,
  getClass8RegistrationSettings,
} from '@/queries/registration.queries';
import ConfirmationClass8Client from './ConfirmationClass8Client';
import ConfirmDownloadPDF from '@/components/ConfirmDownloadPDF';

interface Class8RegistrationConfirmPageProps {
  params: Promise<{
    id: string;
  }>;
}

export const metadata = {
  title: 'Class Eight Registration Confirmation',
};

export default async function Class8RegistrationConfirmPage({
  params,
}: Class8RegistrationConfirmPageProps) {
  const { id } = await params;
  const [schoolConfig, settings, registration] = await Promise.all([
    fetchSchoolConfig(),
    getClass8RegistrationSettings(),
    getClass8RegistrationRecord(id),
  ]);

  if (!registration) {
    redirect('/registration/class-8/form');
  }

  if (!settings.reg_open && registration.status !== 'approved') {
    redirect('/');
  }

  const pdfUrl = `/api/reg/class-8/form/${id}/pdf`;

  if (registration.status === 'approved') {
    return (
      <ConfirmDownloadPDF
        schoolConfig={schoolConfig}
        pdfUrl={pdfUrl}
        downloadFilename={`Class8_Reg_${registration.student_name_en?.replace(/\s+/g, '_')}.pdf`}
      />
    );
  }

  return (
    <ConfirmationClass8Client
      registration={registration}
      schoolConfig={schoolConfig}
      pdfUrl={pdfUrl}
    />
  );
}
