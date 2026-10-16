import { redirect } from 'next/navigation';
import { fetchSchoolConfig } from '@/queries/school.queries';
import { getCertificateRecord } from '@/queries/certificate.queries';
import ConfirmationClient from '../ConfirmationClient';

export const metadata = {
  title: 'Certificate Confirmation',
};

export default async function CertificateConfirmPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [schoolConfig, certificate] = await Promise.all([
    fetchSchoolConfig(),
    getCertificateRecord(id),
  ]);

  if (!certificate) {
    redirect('/testimonial');
  }

  return <ConfirmationClient certificate={certificate} schoolConfig={schoolConfig} />;
}
