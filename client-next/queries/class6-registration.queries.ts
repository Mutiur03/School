import { api } from "@/lib/backend";
import type {
    Class6RegistrationRecord,
    Class6RegistrationSettingsData,
} from "@school/shared-schemas";

const defaultSettings: Class6RegistrationSettingsData & {
    notice?: string | null;
    reg_open?: boolean;
    resolvedClassmates?: string | null;
} = {
    reg_open: false,
    class6_year: new Date().getFullYear(),
};

export type Class6RegistrationSettings = typeof defaultSettings;

export const getClass6RegistrationSettings =
    async (): Promise<Class6RegistrationSettings> => {
        try {
            const response = await api.get<Class6RegistrationSettings>(
                "/api/reg/class-6",
            );
            return response.data ?? defaultSettings;
        } catch {
            return defaultSettings;
        }
    };

export const getClass6RegistrationRecord = async (
    id: string,
): Promise<Class6RegistrationRecord | null> => {
    try {
        const response = await api.get<Class6RegistrationRecord>(
            `/api/reg/class-6/form/${id}`,
            { cache: "no-store" },
        );
        return response.data ?? null;
    } catch {
        return null;
    }
};
