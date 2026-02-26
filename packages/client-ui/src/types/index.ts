import type { ReactNode } from "react";

export type Syllabus = {
  id: number;
  class: number;
  year: number;
  pdf_url: string;
  download_url: string;
  public_id: string;
  created_at: string;
};

export type NoticeItem = {
  id: number;
  title: string;
  created_at: string;
  download_url: string;
  file?: string;
};

export type Head = {
  head_message: string;
  teacher: {
    name: string;
    image: string;
  };
};

type SubDropdownItem = {
  id: string;
  href: string;
  text: string;
};

type DropdownItem = {
  id: string;
  href: string;
  text: string;
  className?: string;
  hasChildren?: boolean;
  subDropdown?: SubDropdownItem[];
};

export type MenuItem = {
  id: string;
  className: string;
  href: string;
  text: string;
  icon?: string;
  isHome?: boolean;
  dropdown?: DropdownItem[];
};

export type SchoolAssets = {
  logo?: string;
  headerLogo?: string;
  governmentLogo?: string;
  banners?: string[];
};

export type SchoolMap = {
  embedUrl?: string;
};

export type SchoolName = {
  en: string;
  bn: string;
  shortEn: string;
};

export type SchoolContact = {
  website: string;
  email: string;
  phone: string;
  address: string;
  location: string;
  district: string;
  upazila: string;
};

export type SchoolIdentifiers = {
  eiin: string;
  centerCode: string;
};

export type SchoolHistory = {
  established: string;
  nationalized: string;
};

export type SchoolAcademic = {
  grades: string;
  ageRange: string;
  subjects: string;
  enrollment: string;
  studentTeacherRatio: string;
  medium: string;
  board: string;
  motto: string;
  headmaster: string;
  colors: string;
  campusArea: string;
  playgroundArea: string;
};

export type SchoolSidebarLink = {
  title: string;
  url: string;
};

export type SchoolHotline = {
  title: string;
  image: string;
};

export type SchoolSidebarLinks = {
  important: SchoolSidebarLink[];
  quick: SchoolSidebarLink[];
  useful: SchoolSidebarLink[];
  hotlines: SchoolHotline[];
};

export type SchoolDescriptions = {
  main: string;
  sub: string;
};

export type SchoolLinks = {
  results: string;
  teacherLogin: string;
  studentLogin: string;
};

export type SchoolConfig = {
  name: SchoolName;
  contact: SchoolContact;
  identifiers: SchoolIdentifiers;
  history: SchoolHistory;
  academic: SchoolAcademic;
  links: SchoolLinks;
  sidebarLinks: SchoolSidebarLinks;
  descriptions: SchoolDescriptions;
  assets: SchoolAssets;
  map: SchoolMap;
  backendBaseUrl?: string;
};

export type SchoolProviderProps = {
  config: SchoolConfig;
  children: ReactNode;
};
