export const removeInitialZeros = (str: string) => str.replace(/^0+/, "");

export const parseDob = (value: string) => {
  const raw = value.trim();
  if (!raw) return null;

  const datePartOnly =
    raw.match(/\d{1,4}[\/.-]\d{1,2}[\/.-]\d{1,4}/)?.[0] ||
    raw.split(/[T\s]/)[0];
  const normalized = datePartOnly
    .replace(/[^0-9/.-]/g, "")
    .replace(/\/{2,}/g, "/")
    .replace(/-{2,}/g, "-")
    .replace(/\.+/g, ".")
    .replace(/[./]/g, (match) => (match === "." ? "/" : match));

  if (/^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(normalized)) {
    const [year, month, day] = normalized.split(/[/-]/).map(Number);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date;
    }
    return null;
  }

  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(normalized)) {
    const [day, month, year] = normalized.split(/[/-]/).map(Number);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date;
    }
    return null;
  }

  const fallback = new Date(normalized);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

export const isValidDob = (value: string) => {
  const dobDate = parseDob(value);
  if (!dobDate) return false;
  const today = new Date();
  return dobDate <= today && dobDate.getFullYear() >= 1980;
};

export const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const normalizeText = (value: unknown) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

export const normalizeOptionalText = (value: unknown) => {
  if (value === undefined || value === null) return null;
  const normalized = normalizeText(value);
  return normalized.length ? normalized : null;
};

export const normalizeDob = (value: unknown) => {
  const raw = String(value || "").trim();
  const parsed = parseDob(raw);
  return parsed ? toIsoDate(parsed) : raw;
};

export const toExcelString = (value: unknown) =>
  value == null ? "" : String(value).trim();

export const normalizeExcelDate = (value: unknown) => {
  if (value == null || value === "") return "";

  const toIso = (year: number, month: number, day: number) => {
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return "";
    }
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
      2,
      "0",
    )}`;
  };

  if (!Number.isNaN(Number(value)) && typeof value !== "string") {
    // Excel numeric date (days since 1900-01-01)
    const excelDate = new Date((Number(value) - 25569) * 86400 * 1000);
    return excelDate.toISOString().split("T")[0];
  }

  const raw = String(value).trim();
  if (!raw) return "";

  const dateToken = raw.match(/\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}/)?.[0] || raw;
  const normalized = dateToken
    .replace(/[^0-9/.-]/g, "")
    .replace(/[.]/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/-{2,}/g, "-");

  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(normalized)) {
    const [day, month, year] = normalized.split(/[/-]/).map(Number);
    return toIso(year, month, day) || raw;
  }

  if (/^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(normalized)) {
    const [year, month, day] = normalized.split(/[/-]/).map(Number);
    return toIso(year, month, day) || raw;
  }

  return raw;
};

export const formatDobForDateInput = (value: string | null | undefined) => {
  if (!value) return "";
  const raw = String(value).split("T")[0].trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split(/[/-]/);
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return "";
};
