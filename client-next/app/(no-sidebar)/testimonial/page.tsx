import { fetchSchoolConfig } from '@/queries/school.queries';
import TestimonialClient from './TestimonialClient';

export const metadata = {
  title: 'Testimonial',
};

export default async function TestimonialPage() {
  const { academic } = await fetchSchoolConfig();
  // Boys'/girls' schools imply gender; ask only for co-ed (or unset).
  const askGender = academic.gender !== 'Boys' && academic.gender !== 'Girls';
  return <TestimonialClient askGender={askGender} />;
}
