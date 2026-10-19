/**
 * Class → section → search → student (web Fees/shared.tsx StudentPicker). Loads the class once
 * (GET /api/students, limit 200, this school only) and filters it on the device.
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Input } from '@/components/ui/Input';
import { ClassSelect, FilterField, LabeledSelect } from '@/features/finance/ui';
import { filterPicker, sectionsOf, type PickerStudent } from '@/features/fees/model';
import { useApi } from '@/session/ApiProvider';
import { useFinanceKey } from '@/features/finance/queries';

export function StudentPicker({
  year,
  value,
  onChange,
}: {
  year: number;
  value: number | null;
  onChange: (s: PickerStudent | null) => void;
}) {
  const { students } = useApi();
  const key = useFinanceKey();
  const [cls, setCls] = useState(0);
  const [section, setSection] = useState('');
  const [search, setSearch] = useState('');
  const q = useQuery({
    queryKey: key('fee-picker', year, cls),
    queryFn: ({ signal }) => students.list({ year, page: 1, limit: 200, levels: [cls] }, signal),
    enabled: cls > 0,
    staleTime: 60_000,
  });
  const list = useMemo<PickerStudent[]>(
    () =>
      (q.data?.rows ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        roll: s.roll,
        section: s.section,
        class: s.class,
      })),
    [q.data],
  );
  const shown = filterPicker(list, section, search);
  return (
    <View className="flex-row flex-wrap items-end gap-3">
      <ClassSelect
        value={cls}
        onChange={(c) => {
          setCls(c);
          setSection('');
          onChange(null);
        }}
        testID="picker-class"
      />
      <LabeledSelect
        label="Section"
        value={section}
        onChange={(s) => {
          setSection(s);
          onChange(null);
        }}
        className="w-28"
        options={[
          { value: '', label: 'All' },
          ...sectionsOf(list).map((s) => ({ value: s, label: s })),
        ]}
      />
      <FilterField label="Find by name / roll" className="w-44">
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Search"
          editable={cls > 0}
          accessibilityLabel="Find by name or roll"
        />
      </FilterField>
      <LabeledSelect
        label="Student"
        value={value ?? 0}
        className="w-72 max-w-full"
        onChange={(id) => {
          const s = list.find((x) => x.id === id);
          onChange(s ?? null);
        }}
        options={[
          {
            value: 0,
            label: !cls ? 'Pick a class first' : q.isPending ? 'Loading…' : 'Select student',
          },
          ...shown.map((s) => ({ value: s.id, label: `${s.section}-${s.roll} · ${s.name}` })),
        ]}
        testID="picker-student"
      />
    </View>
  );
}
