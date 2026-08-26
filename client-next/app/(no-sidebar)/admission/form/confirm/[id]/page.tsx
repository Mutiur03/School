import { fetchSchoolConfig } from '@/queries/school.queries';
import { getAdmissionFormRecord } from '@/queries/admission-form.queries';
import { redirect } from 'next/navigation';
import ConfirmationAdmissionClient from './ConfirmationAdmissionClient';
import { getAdmissionData } from '@/queries/admission.queries';
import ConfirmDownloadPDF from '@/components/ConfirmDownloadPDF';

interface AdmissionConfirmPageProps {
  params: Promise<{
    id: string;
  }>;
}

export const metadata = {
  title: 'Admission Confirmation',
};

export default async function AdmissionConfirmPage({ params }: AdmissionConfirmPageProps) {
  const { id } = await params;
  const [schoolConfig, admissionSettings, admissionRecord] = await Promise.all([
    fetchSchoolConfig(),
    getAdmissionData(),
    getAdmissionFormRecord(id),
  ]);

  if (!admissionRecord) {
    redirect('/admission/form');
  }

  if (!admissionSettings.admission_open && admissionRecord.status !== 'approved') {
    redirect('/');
  }
  if (admissionRecord.status === 'approved') {
    return (
      <ConfirmDownloadPDF
        title1="Admission Confirmed!"
        title2="Download Your Submitted Admission Form"
        bannerText="Your application has been successfully submitted"
        schoolConfig={schoolConfig}
        pdfUrl={`/api/admission/form/${id}/pdf`}
        downloadFilename={`${admissionRecord.student_name_en}.pdf`}
      />
    );
  }
  return (
    <ConfirmationAdmissionClient
      admission={admissionRecord}
      schoolConfig={schoolConfig}
      pdf_url={`/api/admission/form/${id}/pdf`}
    />
  );
}
