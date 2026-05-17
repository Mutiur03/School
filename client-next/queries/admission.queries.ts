import { api } from "@/lib/backend"
import { AdmissionData } from "@/types"

const defaultAdmissionData: AdmissionData = {
    preview_url: "",
    download_url: "",
    admission_open: false,
    admission_year: new Date().getFullYear(),
};

export const getAdmissionData = async (): Promise<AdmissionData> => {
    try {
        const response = await api.get<AdmissionData>("/api/admission")
        return response.data ?? defaultAdmissionData
    } catch {
        return defaultAdmissionData
    }
}
