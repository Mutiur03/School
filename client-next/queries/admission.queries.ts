import { api } from "@/lib/backend"
import { AdmissionData } from "@/types"
import { cache } from "react"

export const getAdmissionData = cache(async (): Promise<AdmissionData> => {
    try {
        const response = await api.get<AdmissionData>("/api/admission")        
        return response.data
    } catch {
        throw new Error("Failed to fetch admission data")
    }
})