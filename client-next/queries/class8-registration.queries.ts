import { api } from "@/lib/backend";
import type { Class8RegistrationRecord, Class8RegistrationSettingsData } from "@school/shared-schemas";

const defaultSettings: Class8RegistrationSettingsData & {
    notice?: string | null;
    reg_open?: boolean;
    resolvedClassmates?: string | null;
} = {
    reg_open: false,
    class8_year: new Date().getFullYear(),
};

export type Class8RegistrationSettings = typeof defaultSettings;

export const getClass8RegistrationSettings =
    async (): Promise<Class8RegistrationSettings> => {
        try {
            const response = await api.get<Class8RegistrationSettings>(
                "/api/reg/class-8",
            );
            return response.data ?? defaultSettings;
        } catch {
            return defaultSettings;
        }
    };

export const getClass8RegistrationRecord = async (
    id: string,
): Promise<Class8RegistrationRecord | null> => {
    try {
        const response = await api.get<Class8RegistrationRecord>(
            `/api/reg/class-8/form/${id}`,
            { cache: "no-store" },
        );
        return response.data ?? null;
    } catch {
        return null;
    }
};
