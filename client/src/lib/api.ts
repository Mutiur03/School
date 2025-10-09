import axios from "axios";

export interface SSCRegData {
  id: number;
  a_sec_roll: string | null;
  b_sec_roll: string | null;
  ssc_year: number | null;
  notice: string | null;
  createdAt: string;
  updatedAt: string;
}

export const fetchSSCRegData = async (): Promise<SSCRegData | null> => {
  try {
    const response = await axios.get("/api/reg/ssc");
    return response.data.success ? response.data.data : null;
  } catch (error) {
    console.error("Failed to fetch SSC registration data:", error);
    return null;
  }
};
