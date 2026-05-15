import { api } from "@/lib/backend";
import { cache } from "react";

export interface StaffMember {
    id: number;
    name?: string;
    fullname?: string;
    designation?: string;
    image?: string;
    email?: string;
    phone?: string;
    address?: string;
    contact?: {
        email?: string;
        phone?: string;
    };
    homeTown?: string;
    location?: string;
}

export const fetchStaffs = cache(async (): Promise<StaffMember[]> => {
    try {
        const response = await api.get<StaffMember[]>("/api/staffs", {
            revalidate: 60,
        });
        return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
        console.error("Error fetching staffs:", error);
        return [];
    }
});
