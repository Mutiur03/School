import { api } from "@/lib/backend";
import { cache } from "react";
import { getAdmissionData } from "./admission.queries";

export interface AdmissionResult {
    id: number;
    class_name: string;
    admission_year: number;
    merit_list: string | null;
    waiting_list_1: string | null;
    waiting_list_2: string | null;
    created_at: string;
}


export const getAvailableAdmissionYears = (baseYear: number) => {
    return [baseYear, baseYear - 1, baseYear - 2];
};

export const getSelectedAdmissionYear = (
    year: string | undefined,
    currentAdmissionYear: number,
) => {
    const parsedYear = Number(year);
    return Number.isInteger(parsedYear) ? parsedYear : currentAdmissionYear;
};

export const getCurrentAdmissionYear = cache(async () => {
    const {admission_year} = await getAdmissionData();
    return admission_year ?? new Date().getFullYear();
});

export const getAdmissionResults = cache(async () => {
    const response = await api.get<AdmissionResult[]>("/api/admission-result");
    return Array.isArray(response.data) ? response.data : [];
});
