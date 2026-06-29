export interface Staff {
  id: number;
  name: string;
  email?: string | null;
  phone: string;
  address?: string | null;
  designation?: string | null;
  image?: string | null;
}

export interface StaffListResponse {
  data: Staff[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
