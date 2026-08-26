import { api } from '@/lib/backend';
import type {
  Class6RegistrationRecord,
  Class6RegistrationSettingsData,
  Class8RegistrationRecord,
  Class8RegistrationSettingsData,
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
export type Class9RegistrationSettings = typeof class9Defaults;

const class6 = makeRegistrationQueries<Class6RegistrationSettings, Class6RegistrationRecord>(
  'class-6',
  class6Defaults,
);
const class8 = makeRegistrationQueries<Class8RegistrationSettings, Class8RegistrationRecord>(
  'class-8',
  class8Defaults,
);
const class9 = makeRegistrationQueries<Class9RegistrationSettings, Class9RegistrationRecord>(
  'class-9',
  class9Defaults,
);

export const getClass6RegistrationSettings = class6.getSettings;
export const getClass6RegistrationRecord = class6.getRecord;
export const getClass8RegistrationSettings = class8.getSettings;
export const getClass8RegistrationRecord = class8.getRecord;
export const getClass9RegistrationSettings = class9.getSettings;
export const getClass9RegistrationRecord = class9.getRecord;
