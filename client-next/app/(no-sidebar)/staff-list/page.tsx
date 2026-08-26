import { PeopleListPage } from '../_shared/PeopleListPage';
import { fetchStaffs } from '@/queries/staff.queries';

export default async function page() {
  const people = (await fetchStaffs()).sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));

  return (
    <PeopleListPage
      title="Staff List"
      emptyLabel="No staff found."
      nameColumnLabel="Name & Designation"
      people={people}
    />
  );
}
