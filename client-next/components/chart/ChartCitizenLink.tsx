"use client";

import { useCitizenCharter } from "@/hooks/useSchoolData";

export function ChartCitizenLink() {
  const citizenCharterQuery = useCitizenCharter();

  const handleCitizenCharterClick = async () => {
    const url =
      citizenCharterQuery.data ?? (await citizenCharterQuery.refetch()).data;
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <ul>
      <li>
        <a onClick={handleCitizenCharterClick} style={{ cursor: "pointer" }}>
          সিটিজেন্‌স চার্টার
        </a>
      </li>
    </ul>
  );
}
