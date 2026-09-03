import {
  getJuniorScholarshipRegistrationYears,
  getJuniorScholarshipRegistrationSettingsForYear,
} from '@/queries/registration.queries';
import RegistrationStatusClient from '../../_shared/RegistrationStatusClient';

export const metadata = {
  title: 'Junior Scholarship Examination Status',
};

export default async function JuniorScholarshipStatusPage() {
  const years = await getJuniorScholarshipRegistrationYears();
  const settingsEntries = await Promise.all(
    years.map(
      async (year) =>
        [String(year), await getJuniorScholarshipRegistrationSettingsForYear(year)] as const,
    ),
  );

  return (
    <RegistrationStatusClient
      classSlug="junior-scholarship"
      title="Junior Scholarship Examination Status"
      years={years}
      settingsByYear={Object.fromEntries(settingsEntries)}
    />
  );
}
