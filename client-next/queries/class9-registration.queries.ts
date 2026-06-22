import { api } from "@/lib/backend";
import type {
    Class9RegistrationRecord,
    Class9RegistrationSettingsData,
} from "@school/shared-schemas";

const defaultSettings: Class9RegistrationSettingsData & {
    notice?: string | null;
    reg_open?: boolean;
    class9_year?: number | null;
    ssc_year?: number | null;
    classmates?: string | null;
} = {
    reg_open: false,
    class9_year: new Date().getFullYear(),
};

export type Class9RegistrationSettings = typeof defaultSettings;

export const getClass9RegistrationSettings =
    async (): Promise<Class9RegistrationSettings> => {
        try {
            const response = await api.get<Class9RegistrationSettings>(
                "/api/reg/class-9",
            );
            return response.data ?? defaultSettings;
        } catch {
            return defaultSettings;
        }
    };

export const getClass9RegistrationRecord = async (
    id: string,
): Promise<Class9RegistrationRecord | null> => {
    try {
        const response = await api.get<Class9RegistrationRecord>(
            `/api/reg/class-9/form/${id}`,
            { cache: "no-store" },
        );
        return response.data ?? null;
    } catch {
        return null;
    }
};
