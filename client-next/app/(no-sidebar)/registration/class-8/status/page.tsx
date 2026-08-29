import {
  getClass8RegistrationYears,
  getClass8RegistrationSettingsForYear,
} from '@/queries/registration.queries';
import RegistrationStatusClient from '../../_shared/RegistrationStatusClient';

export const metadata = {
  title: 'Class Eight Registration Status',
};

export default async function Class8RegistrationStatusPage() {
  const years = await getClass8RegistrationYears();
  const settingsEntries = await Promise.all(
    years.map(
      async (year) => [String(year), await getClass8RegistrationSettingsForYear(year)] as const,
    ),
  );

  return (
    <RegistrationStatusClient
      classSlug="class-8"
      title="Class Eight Registration Status"
      years={years}
      settingsByYear={Object.fromEntries(settingsEntries)}
    />
  );
}
