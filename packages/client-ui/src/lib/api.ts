import axios from "axios";

export interface Class9RegData {
  id: number;
  a_sec_roll: string | null;
  b_sec_roll: string | null;
  class9_year: number | null;
  ssc_year: number | null;
  ssc_batch: string | null;
  notice: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedClassmates: string | null;
}

export const fetchClass9RegData = async (): Promise<Class9RegData | null> => {
  try {
    const response = await axios.get("/api/reg/class-9");
    return response.data.success ? response.data.data : null;
  } catch (error) {
    console.error("Failed to fetch Class 9 registration data:", error);
    return null;
  }
};
