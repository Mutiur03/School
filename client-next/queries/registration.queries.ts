import { api } from '@/lib/backend';
import type {
  Class6RegistrationRecord,
  Class6RegistrationSettingsData,
  Class8RegistrationRecord,
  Class8RegistrationSettingsData,
  JuniorScholarshipRegistrationRecord,
  JuniorScholarshipRegistrationSettingsData,
  Class9RegistrationRecord,
  Class9RegistrationSettingsData,
} from '@school/shared-schemas';

function makeRegistrationQueries<TSettings, TRecord>(
  classSlug: string,
  defaultSettings: TSettings,
) {
  return {
    getSettings: async (): Promise<TSettings> => {
      try {
        const response = await api.get<TSettings>(`/api/reg/${classSlug}`);
        return response.data ?? defaultSettings;
      } catch {
        return defaultSettings;
      }
    },
    getRecord: async (id: string): Promise<TRecord | null> => {
      const response = await api.get<TRecord>(`/api/reg/${classSlug}/form/${id}`, {
        cache: 'no-store',
      });
      return response.data ?? null;
    },
    getYears: async (): Promise<Array<string | number>> => {
      const response = await api.get<Array<string | number>>(`/api/reg/${classSlug}/years`);
      return response.data ?? [];
    },
    getSettingsForYear: async (year: string | number): Promise<TSettings> => {
      try {
        const response = await api.get<TSettings>(`/api/reg/${classSlug}`, {
          params: { year },
          cache: 'no-store',
        });
        return response.data ?? defaultSettings;
      } catch {
        return defaultSettings;
      }
    },
  };
}

const class6Defaults: Class6RegistrationSettingsData & {
  notice?: string | null;
  reg_open?: boolean;
  classmates?: string | null;
} = {
  reg_open: false,
  class6_year: new Date().getFullYear(),
};

const class8Defaults: Class8RegistrationSettingsData & {
  notice?: string | null;
  reg_open?: boolean;
  classmates?: string | null;
} = {
  reg_open: false,
  class8_year: new Date().getFullYear(),
};

const juniorScholarshipDefaults: JuniorScholarshipRegistrationSettingsData & {
  notice?: string | null;
  reg_open?: boolean;
  classmates?: string | null;
} = {
  reg_open: false,
  jse_year: new Date().getFullYear(),
};

const class9Defaults: Class9RegistrationSettingsData & {
  notice?: string | null;
  reg_open?: boolean;
  class9_year?: number | null;
  ssc_year?: number | null;
  classmates?: string | null;
} = {
  reg_open: false,
  class9_year: new Date().getFullYear(),
};

export type Class6RegistrationSettings = typeof class6Defaults;
export type Class8RegistrationSettings = typeof class8Defaults;
export type JuniorScholarshipRegistrationSettings = typeof juniorScholarshipDefaults;
export type Class9RegistrationSettings = typeof class9Defaults;

const class6 = makeRegistrationQueries<Class6RegistrationSettings, Class6RegistrationRecord>(
  'class-6',
  class6Defaults,
);
const class8 = makeRegistrationQueries<Class8RegistrationSettings, Class8RegistrationRecord>(
  'class-8',
  class8Defaults,
);
const juniorScholarship = makeRegistrationQueries<
  JuniorScholarshipRegistrationSettings,
  JuniorScholarshipRegistrationRecord
>('junior-scholarship', juniorScholarshipDefaults);
const class9 = makeRegistrationQueries<Class9RegistrationSettings, Class9RegistrationRecord>(
  'class-9',
  class9Defaults,
);

export const getClass6RegistrationSettings = class6.getSettings;
export const getClass6RegistrationRecord = class6.getRecord;
export const getClass6RegistrationYears = class6.getYears;
export const getClass6RegistrationSettingsForYear = class6.getSettingsForYear;
export const getClass8RegistrationSettings = class8.getSettings;
export const getClass8RegistrationRecord = class8.getRecord;
export const getClass8RegistrationYears = class8.getYears;
export const getClass8RegistrationSettingsForYear = class8.getSettingsForYear;
export const getJuniorScholarshipRegistrationSettings = juniorScholarship.getSettings;
export const getJuniorScholarshipRegistrationRecord = juniorScholarship.getRecord;
export const getJuniorScholarshipRegistrationYears = juniorScholarship.getYears;
export const getJuniorScholarshipRegistrationSettingsForYear = juniorScholarship.getSettingsForYear;
export const getClass9RegistrationSettings = class9.getSettings;
export const getClass9RegistrationRecord = class9.getRecord;
export const getClass9RegistrationYears = class9.getYears;
export const getClass9RegistrationSettingsForYear = class9.getSettingsForYear;
