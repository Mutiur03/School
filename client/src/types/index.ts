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

interface SubDropdownItem {
  id: string;
  href: string;
  text: string;
}

interface DropdownItem {
  id: string;
  href: string;
  text: string;
  className?: string;
  hasChildren?: boolean;
  subDropdown?: SubDropdownItem[];
}

export interface MenuItem {
  id: string;
  className: string;
  href: string;
  text: string;
  icon?: string;
  isHome?: boolean;
  dropdown?: DropdownItem[];
}

export interface Head {
  head_message: string;
  teacher: {
    name: string;
    image: string;
  };
}