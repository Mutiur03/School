import { getClass8RegistrationSettings } from '@/queries/registration.queries';
import RegistrationNotice from '../_shared/RegistrationNotice';

export const metadata = {
  title: 'Class Eight Registration Notice',
};

export default function Class8RegistrationNoticePage() {
  return (
    <RegistrationNotice
      title="Class Eight Registration Notice"
      formHref="/registration/class-8/form"
      yearKey="class8_year"
      getSettings={getClass8RegistrationSettings}
    />
  );
}
