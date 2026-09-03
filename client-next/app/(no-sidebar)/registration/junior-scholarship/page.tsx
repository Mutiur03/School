import { getJuniorScholarshipRegistrationSettings } from '@/queries/registration.queries';
import RegistrationNotice from '../_shared/RegistrationNotice';

export const metadata = {
  title: 'Junior Scholarship Examination Notice',
};

export default function JuniorScholarshipNoticePage() {
  return (
    <RegistrationNotice
      title="Junior Scholarship Examination Notice"
      formHref="/registration/junior-scholarship/form"
      statusHref="/registration/junior-scholarship/status"
      yearKey="jse_year"
      getSettings={getJuniorScholarshipRegistrationSettings}
    />
  );
}
