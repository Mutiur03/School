import { api } from '@/lib/backend';

export type PublicExamOption = {
  exam_name: string;
  result_date: string | null;
  visible?: boolean;
};

/** Public exam list for the result lookup form (server-side). */
export async function fetchPublicExams(
  year: number,
  classInt: number,
): Promise<PublicExamOption[]> {
  try {
    const response = await api.get<PublicExamOption[]>('/api/marks/public/exams', {
      params: { year: String(year), class: String(classInt) },
      revalidate: 30,
    });
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    console.error('Error fetching public exams:', error);
    return [];
  }
}
