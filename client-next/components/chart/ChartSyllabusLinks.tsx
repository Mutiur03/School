"use client";

import { useSyllabuses } from "@/hooks/useSchoolData";
import { getFileUrl } from "@/lib/cdn";

const CLASS_LABELS: Record<number, string> = {
  6: "ষষ্ঠ শ্রেণি",
  7: "সপ্তম শ্রেণি",
  8: "অষ্টম শ্রেণি",
  9: "নবম শ্রেণি",
  10: "দশম শ্রেণি",
};

export function ChartSyllabusLinks() {
  const syllabusesQuery = useSyllabuses();

  const handleSyllabusClick = async (classNum: number) => {
    const syllabuses =
      syllabusesQuery.data ?? (await syllabusesQuery.refetch()).data ?? [];
    const classSyllabuses = syllabuses.filter(
      (syllabus) => syllabus.class === classNum,
    );
    const latest = classSyllabuses.reduce(
      (currentLatest, syllabus) =>
        syllabus.year > currentLatest.year ? syllabus : currentLatest,
      classSyllabuses[0],
    );

    if (latest?.pdf_url) {
      window.open(getFileUrl(latest.pdf_url), "_blank", "noopener,noreferrer");
    }
  };

  return (
    <ul>
      {[6, 7, 8, 9, 10].map((classNum) => (
        <li key={classNum}>
          <button
            type="button"
            onClick={() => handleSyllabusClick(classNum)}
            className="as-link"
          >
            {CLASS_LABELS[classNum]}
          </button>
        </li>
      ))}
    </ul>
  );
}
