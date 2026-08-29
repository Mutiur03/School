import { getClass6RegistrationSettings } from '@/queries/registration.queries';
import RegistrationNotice from '../_shared/RegistrationNotice';

export const metadata = {
  title: 'Class Six Registration Notice',
};

export default function Class6RegistrationNoticePage() {
  return (
    <RegistrationNotice
      title="Class Six Registration Notice"
      formHref="/registration/class-6/form"
      statusHref="/registration/class-6/status"
      yearKey="class6_year"
      getSettings={getClass6RegistrationSettings}
    />
  );
}
