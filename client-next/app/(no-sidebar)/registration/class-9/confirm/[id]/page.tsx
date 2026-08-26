import { redirect } from 'next/navigation';
import { fetchSchoolConfig } from '@/queries/school.queries';
import {
  getClass9RegistrationRecord,
  getClass9RegistrationSettings,
} from '@/queries/registration.queries';
import ConfirmationClass9Client from './ConfirmationClass9Client';
import ConfirmDownloadPDF from '@/components/ConfirmDownloadPDF';

interface Class9RegistrationConfirmPageProps {
  params: Promise<{
    id: string;
  }>;
}

export const metadata = {
  title: 'SSC Registration Confirmation',
};

export default async function Class9RegistrationConfirmPage({
  params,
}: Class9RegistrationConfirmPageProps) {
  const { id } = await params;
  const [schoolConfig, settings, registration] = await Promise.all([
    fetchSchoolConfig(),
    getClass9RegistrationSettings(),
    getClass9RegistrationRecord(id),
  ]);

  if (!registration) {
    redirect('/registration/class-9/form');
  }

  if (!settings.reg_open && registration.status !== 'approved') {
    redirect('/');
  }

  const pdfUrl = `/api/reg/class-9/form/${id}/pdf`;

  if (registration.status === 'approved') {
    return (
      <ConfirmDownloadPDF
        title2="Download Your SSC Registration Form"
        schoolConfig={schoolConfig}
        pdfUrl={pdfUrl}
        downloadFilename={`Class_9_Registration_${registration.student_name_en?.replace(/\s+/g, '_') || registration.roll}.pdf`}
      />
    );
  }

  return (
    <ConfirmationClass9Client
      registration={registration}
      schoolConfig={schoolConfig}
      pdfUrl={pdfUrl}
    />
  );
}
