/**
 * Holidays (Nest), verified against server/src/nest/modules/holiday/: GET /api/holidays (school
 * from host, ordered by start_date), POST / PATCH /:id / DELETE /:id admin only, body
 * CreateHolidayDto { title, start_date, end_date, description?, is_optional? } with
 * forbidNonWhitelisted (so only these keys are ever sent).
 */
import type { ApiClient } from './client';
import { bool, num, objArray, str, ymd } from './parse';

export interface Holiday {
  id: number;
  title: string;
  /** `YYYY-MM-DD` */
  start_date: string;
  end_date: string;
  description: string;
  is_optional: boolean;
}

export interface HolidayInput {
  title: string;
  start_date: string;
  end_date: string;
  description: string;
  is_optional: boolean;
}

export const HOLIDAY_PATHS = {
  list: '/api/holidays',
  one: (id: number) => `/api/holidays/${id}`,
} as const;

export function parseHolidays(v: unknown): Holiday[] {
  return objArray(v, HOLIDAY_PATHS.list).map((h) => ({
    id: num(h.id),
    title: str(h.title),
    start_date: ymd(h.start_date),
    end_date: ymd(h.end_date) || ymd(h.start_date),
    description: str(h.description),
    is_optional: bool(h.is_optional),
  }));
}

/** Only the DTO's keys, trimmed. */
export const holidayBody = (i: HolidayInput): HolidayInput => ({
  title: i.title.trim(),
  start_date: i.start_date,
  end_date: i.end_date,
  description: i.description.trim(),
  is_optional: i.is_optional,
});

export function createHolidaysApi(client: ApiClient) {
  return {
    async list(signal?: AbortSignal): Promise<Holiday[]> {
      return parseHolidays(await client.get<unknown>(HOLIDAY_PATHS.list, { signal }));
    },
    async create(input: HolidayInput): Promise<void> {
      await client.post<unknown>(HOLIDAY_PATHS.list, holidayBody(input));
    },
    async update(id: number, input: HolidayInput): Promise<void> {
      await client.patch<unknown>(HOLIDAY_PATHS.one(id), holidayBody(input));
    },
    async remove(id: number): Promise<void> {
      await client.delete<unknown>(HOLIDAY_PATHS.one(id));
    },
  };
}

export type HolidaysApi = ReturnType<typeof createHolidaysApi>;
