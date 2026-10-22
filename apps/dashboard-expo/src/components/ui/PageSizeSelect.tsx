/** "Rows per page" picker shared by the list pages (web TablePagination page-size control). */
import { Select } from './Select';

export function PageSizeSelect({
  value,
  onChange,
  sizes = [25, 50, 100],
}: {
  value: number;
  onChange: (n: number) => void;
  sizes?: readonly number[];
}) {
  return (
    <Select
      label="Rows per page"
      size="sm"
      value={value}
      options={sizes.map((n) => ({ value: n, label: `${n} / page` }))}
      onChange={onChange}
    />
  );
}
