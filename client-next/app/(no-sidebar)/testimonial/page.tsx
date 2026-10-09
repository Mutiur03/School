import { fetchSchoolConfig } from '@/queries/school.queries';
import TestimonialClient from './TestimonialClient';

export const metadata = {
  title: 'Certificate (Protyoyonpatro)',
};

export default async function TestimonialPage() {
  const { academic } = await fetchSchoolConfig();
  // Boys'/girls' schools imply gender; co-ed (or unset) asks for it.
  const schoolGender =
    academic.gender === 'Boys' || academic.gender === 'Girls' ? academic.gender : null;
  return <TestimonialClient schoolGender={schoolGender} />;
}
