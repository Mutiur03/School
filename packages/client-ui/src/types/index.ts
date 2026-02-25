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
