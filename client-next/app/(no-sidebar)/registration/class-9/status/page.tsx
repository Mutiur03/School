import {
  getClass9RegistrationYears,
  getClass9RegistrationSettingsForYear,
} from '@/queries/registration.queries';
import RegistrationStatusClient from '../../_shared/RegistrationStatusClient';

export const metadata = {
  title: 'Class Nine Registration Status',
};

export default async function Class9RegistrationStatusPage() {
  const years = await getClass9RegistrationYears();
  const settingsEntries = await Promise.all(
    years.map(
      async (year) => [String(year), await getClass9RegistrationSettingsForYear(year)] as const,
    ),
  );

  return (
    <RegistrationStatusClient
      classSlug="class-9"
      title="Class Nine Registration Status"
      years={years}
      settingsByYear={Object.fromEntries(settingsEntries)}
    />
  );
}
