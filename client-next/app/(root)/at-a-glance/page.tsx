import { fetchSchoolConfig } from '@/queries/school.queries';
import { fetchHeadMasterMsg } from '@/queries/teacher.queries';

export default async function At_a_glance() {
  const [schoolConfig, head] = await Promise.all([fetchSchoolConfig(), fetchHeadMasterMsg()]);
  const config = schoolConfig as Record<string, any>;

  const asText = (value: unknown): string | null => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    if (typeof value === 'number') return String(value);
    return null;
  };

  const schoolNameEn = asText(config.name?.en);
  const schoolNameBn = asText(config.name?.bn);
  const schoolName =
    schoolNameEn && schoolNameBn
      ? `${schoolNameEn} (${schoolNameBn})`
      : (schoolNameEn ?? schoolNameBn);
  const website = asText(config.contact?.website);
  const email = asText(config.contact?.email);
  const phone = asText(config.contact?.phone);
  const eiin = asText(config.identifiers?.eiin);
  const centerCode = asText(config.identifiers?.centerCode);
  const schoolCode = asText(config.identifiers?.schoolCode);
  const address = asText(config.contact?.address);
  const established = asText(config.history?.established);
  const nationalized = asText(config.history?.nationalized);
  const grades = asText(config.academic?.grades);
  const enrollment = asText(config.academic?.enrollment);
  const studentTeacherRatio = asText(config.academic?.studentTeacherRatio);
  const medium = asText(config.academic?.medium);
  const board = asText(config.academic?.board);
  const ownership = asText(config.academic?.ownership);
  const gender = asText(config.academic?.gender);
  const campusArea = asText(config.academic?.campusArea);
  const playgroundArea = asText(config.academic?.playgroundArea);
  const headmaster = asText(head?.teacher?.name);
  const colors = asText(config.academic?.colors);
  const descriptionMain = asText(config.descriptions?.main);
  const descriptionSub = asText(config.descriptions?.sub);
  const subjects = asText(config.academic?.subjects);
  const ageRange = asText(config.academic?.ageRange);

  const row = (label: string, value: string | null | undefined) =>
    value ? { label, value } : null;

  type AtAGlanceRow = { label: string; value: React.ReactNode };
  const allRows: AtAGlanceRow[] = [];

  for (const entry of [
    row('College / School Name', schoolName),
    row('Website', website),
    row('E-mail', email),
    row('Phone', phone),
    row('Code (EIIN)', eiin),
    row('Center Code', centerCode),
    row('School Code', schoolCode),
    row('Address', address),
    row('Established', established),
    row('Nationalized', nationalized),
    row('Grades', grades),
    row('Age Range', ageRange),
    row('Groups', subjects),
    row('Enrollment', enrollment),
    row('Student-Teacher Ratio', studentTeacherRatio),
    row('Medium', medium),
    row('Board', board),
    row('Ownership', ownership),
    row('School For', gender),
    row('Campus / Land Area', campusArea),
    row('Playground', playgroundArea),
    row('Headmaster', headmaster),
    row('Uniform Color', colors),
  ]) {
    if (entry) allRows.push(entry);
  }

  if (descriptionMain || descriptionSub) {
    allRows.push({
      label: 'Description',
      value: (
        <div>
          {descriptionMain ? (
            <p className="mb-2 text-sm leading-relaxed text-gray-700">{descriptionMain}</p>
          ) : null}
          {descriptionSub ? (
            <p className="text-sm leading-relaxed text-gray-600">{descriptionSub}</p>
          ) : null}
        </div>
      ),
    });
  }

  const renderCellValue = (val: React.ReactNode) => {
    if (typeof val === 'string') {
      return val.split('\n').map((line, i) => (
        <div key={i} className="leading-relaxed">
          {line}
        </div>
      ));
    }
    return val;
  };

  return (
    <div className="py-8 sm:py-12">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-2xl text-balance sm:text-3xl md:text-4xl">At a glance</h2>

        <div className="mt-6 sm:mt-8">
          {allRows.length === 0 ? (
            <p className="text-sm text-gray-600">No school information available yet.</p>
          ) : (
            <div className="overflow-hidden rounded-xs bg-white shadow">
              {/* Mobile: stacked definition list */}
              <dl className="divide-y divide-gray-300 border border-gray-300 md:hidden">
                {allRows.map((row, idx) => {
                  const isEven = idx % 2 === 0;
                  return (
                    <div
                      key={row.label}
                      className={`px-3 py-3 sm:px-4 sm:py-4 ${isEven ? 'bg-gray-50' : 'bg-white'}`}
                    >
                      <dt className="text-sm font-semibold text-gray-900">{row.label}</dt>
                      <dd className="mt-1 min-w-0 text-sm break-words text-gray-700">
                        {renderCellValue(row.value)}
                      </dd>
                    </div>
                  );
                })}
              </dl>

              {/* Desktop: table */}
              <table className="hidden min-w-full border-collapse text-sm md:table">
                <tbody className="border border-gray-300">
                  {allRows.map((row, idx) => {
                    const isEven = idx % 2 === 0;
                    return (
                      <tr key={row.label} className={isEven ? 'bg-gray-50' : 'bg-white'}>
                        <td className="w-5/12 border-b border-gray-300 px-4 py-4 align-top font-semibold">
                          {row.label}
                        </td>
                        <td className="w-12 border-b border-gray-300 px-2 py-4 text-center align-top">
                          :
                        </td>
                        <td className="min-w-0 border-b border-gray-300 px-4 py-4 break-words">
                          {renderCellValue(row.value)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
