import { redirect } from 'next/navigation';
import { fetchSchoolConfig } from '@/queries/school.queries';
import {
  getJuniorScholarshipRegistrationRecord,
  getJuniorScholarshipRegistrationSettings,
} from '@/queries/registration.queries';
import ConfirmationClient from '../../../_shared/ConfirmationClient';
import ConfirmDownloadPDF from '@/components/ConfirmDownloadPDF';

interface JuniorScholarshipConfirmPageProps {
  params: Promise<{
    id: string;
  }>;
}

export const metadata = {
  title: 'Junior Scholarship Examination Confirmation',
};

export default async function JuniorScholarshipConfirmPage({
  params,
}: JuniorScholarshipConfirmPageProps) {
  const { id } = await params;
  const [schoolConfig, settings, registration] = await Promise.all([
    fetchSchoolConfig(),
    getJuniorScholarshipRegistrationSettings(),
    getJuniorScholarshipRegistrationRecord(id),
  ]);

  if (!registration) {
    redirect('/registration/junior-scholarship/form');
  }

  if (!settings.reg_open && registration.status !== 'approved') {
    redirect('/');
  }

  const pdfUrl = `/api/reg/junior-scholarship/form/${id}/pdf`;

  if (registration.status === 'approved') {
    return (
      <ConfirmDownloadPDF
        schoolConfig={schoolConfig}
        pdfUrl={pdfUrl}
        downloadFilename={`JuniorScholarship_${registration.student_name_en?.replace(/\s+/g, '_')}.pdf`}
      />
    );
  }

  return (
    <ConfirmationClient
      kind="junior-scholarship"
      registration={registration}
      schoolConfig={schoolConfig}
      pdfUrl={pdfUrl}
    />
  );
}
