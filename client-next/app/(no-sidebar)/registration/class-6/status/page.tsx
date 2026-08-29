import {
  getClass6RegistrationYears,
  getClass6RegistrationSettingsForYear,
} from '@/queries/registration.queries';
import RegistrationStatusClient from '../../_shared/RegistrationStatusClient';

export const metadata = {
  title: 'Class Six Registration Status',
};

export default async function Class6RegistrationStatusPage() {
  const years = await getClass6RegistrationYears();
  const settingsEntries = await Promise.all(
    years.map(
      async (year) => [String(year), await getClass6RegistrationSettingsForYear(year)] as const,
    ),
  );

  return (
    <RegistrationStatusClient
      classSlug="class-6"
      title="Class Six Registration Status"
      years={years}
      settingsByYear={Object.fromEntries(settingsEntries)}
    />
  );
}
