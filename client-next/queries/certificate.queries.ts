import { api } from '@/lib/backend';
import type { TestimonialData } from '@school/shared-schemas';

export type CertificateRecord = {
  id: string;
  status: 'pending' | 'approved';
  data: TestimonialData;
};

export const getCertificateRecord = async (id: string): Promise<CertificateRecord | null> => {
  const response = await api.get<{ success: boolean; data: CertificateRecord }>(
    `/api/certificates/${id}`,
    { cache: 'no-store' },
  );
  return response.data?.data ?? null;
};
