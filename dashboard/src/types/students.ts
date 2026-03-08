export interface Student {
  id: number;
  login_id: number;
  name: string;
  father_name: string;
  mother_name: string;
  father_phone?: string;
  mother_phone?: string;
  village?: string;
  post_office?: string;
  upazila?: string;
  district?: string;
  roll: number;
  section: string;
  dob: string;
  class: number;
  department: string;
  has_stipend: boolean;
  available: boolean;
  image?: string;
  enrollment_id: number;
}


