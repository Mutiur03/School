"use client";

import { useCitizenCharter } from "@/hooks/useSchoolData";
import { getFileUrl } from "@/lib/cdn";

export function ChartCitizenLink() {
  const citizenCharterQuery = useCitizenCharter();

  const handleCitizenCharterClick = async () => {
    const key =
      citizenCharterQuery.data ?? (await citizenCharterQuery.refetch()).data;
    if (key) {
      window.open(getFileUrl(key), "_blank", "noopener,noreferrer");
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
