import { fetchSchoolConfig } from '@/queries/school.queries';
import Image from 'next/image';

export default async function At_a_glance() {
  const schoolConfig = await fetchSchoolConfig();
  const config = schoolConfig as Record<string, any>;

  const asText = (value: unknown, fallback = '—') => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : fallback;
    }
    if (typeof value === 'number') return String(value);
    return fallback;
  };

  const schoolNameEn = asText(config.name?.en);
  const schoolNameBn = asText(config.name?.bn);
  const website = asText(config.contact?.website);
  const email = asText(config.contact?.email);
  const phone = asText(config.contact?.phone);
  const eiin = asText(config.identifiers?.eiin);
  const centerCode = asText(config.identifiers?.centerCode);
  const location = asText(config.contact?.location);
  const established = asText(config.history?.established);
  const nationalized = asText(config.history?.nationalized);
  const grades = asText(config.academic?.grades);
  const enrollment = asText(config.academic?.enrollment);
  const studentTeacherRatio = asText(config.academic?.studentTeacherRatio);
  const medium = asText(config.academic?.medium);
  const board = asText(config.academic?.board);
  const campusArea = asText(config.academic?.campusArea);
  const playgroundArea = asText(config.academic?.playgroundArea);
  const headmaster = asText(config.academic?.headmaster);
  const colors = asText(config.academic?.colors);
  const address = asText(config.contact?.address);
  const descriptionMain = asText(config.descriptions?.main);
  const descriptionSub = asText(config.descriptions?.sub);
  const subjects = asText(config.academic?.subjects);
  const ageRange = asText(config.academic?.ageRange);
  const motto = asText(config.academic?.motto);

  const banners = Array.isArray(config.assets?.banners)
    ? config.assets.banners.filter((item: unknown) => typeof item === 'string' && item.trim())
    : [];
  const campusImage = banners[0] || '/placeholder.svg';
  const locationPart = location.split(',')[1]?.trim() || location;

  const allRows: { label: string; value: React.ReactNode }[] = [
    {
      label: 'College / School Name',
      value: `${schoolNameEn} (${schoolNameBn})`,
    },
    { label: 'Website', value: website },
    { label: 'E-mail', value: email },
    { label: 'Phone', value: phone },
    { label: 'Code (EIIN)', value: eiin },
    { label: 'Center Code', value: centerCode },
    { label: 'Location', value: location },
    { label: 'Established', value: established },
    { label: 'Nationalized', value: nationalized },
    { label: 'Grades', value: grades },
    { label: 'Enrollment', value: enrollment },
    {
      label: 'Student-Teacher Ratio',
      value: studentTeacherRatio,
    },
    { label: 'Medium', value: medium },
    { label: 'Board', value: board },
    { label: 'Campus / Land Area', value: campusArea },
    { label: 'Playground', value: playgroundArea },
    { label: 'Headmaster', value: headmaster },
    { label: 'Uniform Color', value: colors },

    {
      label: 'Description',
      value: (
        <div>
          <p className="mb-2 text-sm leading-relaxed text-gray-700">{descriptionMain}</p>
          <p className="text-sm leading-relaxed text-gray-600">{descriptionSub}</p>
        </div>
      ),
    },

    {
      label: 'Academic Programs',
      value: (
        <ul className="list-disc pl-5 text-sm text-gray-600">
          <li>Secondary Education ({grades} level)</li>
          <li>National Curriculum ({medium} medium)</li>
          <li>{subjects}</li>
          <li>Special care for board exams</li>
        </ul>
      ),
    },

    {
      label: 'Student Body',
      value: (
        <ul className="list-disc pl-5 text-sm text-gray-600">
          <li>Enrollment: {enrollment}</li>
          <li>Age Range: {ageRange}</li>
          <li>Student-Teacher Ratio: {studentTeacherRatio}</li>
          {/* <li>Active Student Council & Publication "Anushilon"</li> */}
        </ul>
      ),
    },

    {
      label: 'Achievements & Reputation',
      value: (
        <ul className="list-disc pl-5 text-sm text-gray-600">
          <li>Consistently strong SSC results</li>
          <li>Recognized as a leading school in {locationPart}</li>
          <li>Notable alumni and community impact</li>
          {/* <li>School magazine: "Anushilon"</li> */}
        </ul>
      ),
    },

    {
      label: 'School Details',
      value: (
        <ul className="list-disc pl-5 text-sm text-gray-600">
          <li>Founded: {established}</li>
          <li>Nationalized: {nationalized}</li>
          <li>Motto: “{motto}”</li>
          <li>Uniform Color: {colors}</li>
        </ul>
      ),
    },

    { label: 'Address', value: address },
    { label: 'Contact Phone', value: phone },
    { label: 'Contact E-mail', value: email },

    {
      label: 'Campus Image',
      value: (
        <div className="w-full max-w-md">
          <Image
            width={400}
            height={300}
            src={campusImage}
            alt="School Campus"
            className="h-48 w-full rounded-md object-cover shadow-sm"
          />
          <div className="mt-1 text-xs text-gray-500">School Campus</div>
        </div>
      ),
    },
  ];

  const renderCellValue = (val: React.ReactNode) => {
    if (typeof val === 'string') {
      return val.trim()
        ? val.split('\n').map((line, i) => (
            <div key={i} className="leading-relaxed">
              {line}
            </div>
          ))
        : '—';
    }
    return val ?? '—';
  };

  return (
    <div className="py-12">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-4xl">At a glance</h2>

        <div className="mt-8">
          <div className="overflow-hidden rounded-xs bg-white shadow">
            <table className="min-w-full border-collapse text-sm">
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
                      <td className="border-b border-gray-300 px-4 py-4">
                        {renderCellValue(row.value)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
