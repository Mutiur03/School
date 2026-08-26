import { PeopleListPage } from '../_shared/PeopleListPage';
import { fetchTeachers } from '@/queries/teacher.queries';

export default async function page() {
  const people = (await fetchTeachers())
    .filter((t) => (t.available === undefined ? true : !!t.available))
    .sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));

  return (
    <PeopleListPage
      title="Teacher List"
      emptyLabel="No teachers found."
      nameColumnLabel="Name & Email"
      people={people}
      showEmailAlways
    />
  );
}
