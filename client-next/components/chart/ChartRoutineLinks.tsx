"use client";

import type { MouseEvent } from "react";
import { useRoutinePDF } from "@/hooks/useSchoolData";
import { getFileUrl } from "@/lib/cdn";

const CLASS_LABELS = [
  "ষষ্ঠ শ্রেণি",
  "সপ্তম শ্রেণি",
  "অষ্টম শ্রেণি",
  "নবম শ্রেণি",
  "দশম শ্রেণি",
];

export function ChartRoutineLinks() {
  const routineQuery = useRoutinePDF();

  const handleRoutineClick = async (e: MouseEvent) => {
    e.preventDefault();
    const pdfUrl = routineQuery.data ?? (await routineQuery.refetch()).data;
    if (pdfUrl) {
      window.open(getFileUrl(pdfUrl), "_blank", "noopener,noreferrer");
    }
  };

  return (
    <ul>
      {CLASS_LABELS.map((label) => (
        <li key={label}>
          <button type="button" onClick={handleRoutineClick} className="as-link">
            {label}
          </button>
        </li>
      ))}
    </ul>
  );
}
