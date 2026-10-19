/**
 * Class-teacher assignments ("levels", legacy Express), verified against
 * server/src/modules/level/ and dashboard/src/pages/Admin/AddLevel.tsx:
 *
 *   GET    /api/level/getLevels       admin; every assignment, ordered class → section
 *   POST   /api/level/addLevel        admin; levelFormSchema { class_name, section, year, teacher_id }
 *   PUT    /api/level/updateLevel/:id admin; same body
 *   DELETE /api/level/deleteLevel/:id admin
 */
import type { ApiClient } from './client';
import { bool, num, objArray, str } from './parse';

export interface Level {
  id: number;
  class_name: number;
  section: string;
  year: number;
  teacher_id: number | null;
  teacher_name: string;
  teacher_available: boolean;
}

export interface LevelInput {
  class_name: number;
  section: string;
  year: number;
  teacher_id: number;
}

export const LEVEL_PATHS = {
  list: '/api/level/getLevels',
  add: '/api/level/addLevel',
  update: (id: number) => `/api/level/updateLevel/${id}`,
  remove: (id: number) => `/api/level/deleteLevel/${id}`,
} as const;

export const LEVEL_CLASSES = [6, 7, 8, 9, 10] as const;
export const LEVEL_SECTIONS = ['A', 'B'] as const;

export function parseLevels(v: unknown): Level[] {
  return objArray(v, LEVEL_PATHS.list).map((l) => ({
    id: num(l.id),
    class_name: num(l.class_name),
    section: str(l.section),
    year: num(l.year),
    teacher_id: typeof l.teacher_id === 'number' ? l.teacher_id : null,
    teacher_name: str(l.teacher_name, 'Unknown'),
    teacher_available: bool(l.teacher_available),
  }));
}

const levelBody = (i: LevelInput): LevelInput => ({
  class_name: i.class_name,
  section: i.section.trim().toUpperCase(),
  year: i.year,
  teacher_id: i.teacher_id,
});

export function createLevelsApi(client: ApiClient) {
  return {
    async list(signal?: AbortSignal) {
      return parseLevels(await client.get(LEVEL_PATHS.list, { signal }));
    },
    async create(i: LevelInput): Promise<void> {
      await client.post<unknown>(LEVEL_PATHS.add, levelBody(i));
    },
    async update(id: number, i: LevelInput): Promise<void> {
      await client.put<unknown>(LEVEL_PATHS.update(id), levelBody(i));
    },
    async remove(id: number): Promise<void> {
      await client.delete<unknown>(LEVEL_PATHS.remove(id));
    },
  };
}

export type LevelsApi = ReturnType<typeof createLevelsApi>;
