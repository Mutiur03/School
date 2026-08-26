import { getClass9RegistrationSettings } from '@/queries/registration.queries';
import RegistrationNotice from '../_shared/RegistrationNotice';

export const metadata = {
  title: 'SSC Registration Notice',
};

export default function Class9RegistrationNoticePage() {
  return (
    <RegistrationNotice
      title="SSC Registration Notice"
      formHref="/registration/class-9/form"
      yearKey={['class9_year', 'ssc_year']}
      getSettings={getClass9RegistrationSettings}
    />
  );
}
