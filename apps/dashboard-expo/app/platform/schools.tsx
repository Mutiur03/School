/**
 * School Management (super admin), ported from dashboard/src/pages/SuperAdmin/SchoolManagement.tsx
 * (web /settings/school): searchable school list + editor. Wide screens show both (4/12 + 8/12
 * like the web's lg grid); phones show the list, then the editor with a back link. The selected
 * school and tab live in the URL (`?school=<id|new>&tab=<tab>`) so the SMS page can deep-link a
 * school's SMS tab. Switching away from unsaved edits asks first.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ChevronLeft, Plus, RefreshCw, School } from '@/components/ui/icons';
import { SearchInput } from '@/components/ui/SearchInput';
import { SectionCard } from '@/components/ui/SectionCard';
import { ErrorState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useMinWidth } from '@/hooks/useBreakpoint';
import { SchoolEditor } from '@/features/platform/SchoolEditor';
import {
  CREATE_TABS,
  filterByName,
  parseEditorTab,
  parseSchoolParam,
  type EditorTab,
  type SelectedSchool,
} from '@/features/platform/model';
import { SchoolLogo, useConfirmGate, usePlatformSchools } from '@/features/platform/ui';
import type { PlatformSchool } from '@/lib/api';
import { cn } from '@/lib/utils';

const domainLabel = (s: PlatformSchool) =>
  s.customDomain || (s.subdomain ? `${s.subdomain} (subdomain)` : 'No domain');

export default function PlatformSchoolsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ school?: string; tab?: string }>();
  const wide = useMinWidth('lg');
  const q = usePlatformSchools();
  const confirm = useConfirmGate();
  const [search, setSearch] = useState('');
  const dirty = useRef(false);
  const onDirtyChange = useCallback((d: boolean) => {
    dirty.current = d;
  }, []);

  const schools = useMemo(() => q.data ?? [], [q.data]);
  const rows = useMemo(
    () =>
      filterByName(schools, search, (s) => [
        s.name,
        s.shortName ?? '',
        s.subdomain ?? '',
        s.customDomain ?? '',
      ]),
    [schools, search],
  );
  const selected: SelectedSchool = parseSchoolParam(params.school);
  const tab: EditorTab = parseEditorTab(params.tab);
  const school =
    typeof selected === 'number' ? (schools.find((s) => s.id === selected) ?? null) : null;

  const go = useCallback(
    (next: SelectedSchool, nextTab: EditorTab) =>
      router.setParams({ school: next === null ? '' : String(next), tab: nextTab }),
    [router],
  );

  // Wide layout always shows an editor: pick the first school (the web does the same).
  useEffect(() => {
    if (wide && selected === null && schools[0]) go(schools[0].id, 'identity');
  }, [wide, selected, schools, go]);

  const select = (next: SelectedSchool) => {
    if (next === selected) return;
    const nextTab: EditorTab = next === 'new' ? (CREATE_TABS.has(tab) ? tab : 'identity') : tab;
    if (!dirty.current) {
      go(next, nextTab);
      return;
    }
    confirm.ask(
      {
        title: 'Discard unsaved changes?',
        message: 'You have unsaved changes to this school. Leave without saving?',
        confirmLabel: 'Discard',
        tone: 'destructive',
      },
      async () => {
        dirty.current = false;
        go(next, nextTab);
      },
    );
  };

  const showList = wide || selected === null;
  const showEditor = selected !== null && (selected === 'new' || school !== null);
  const missing = typeof selected === 'number' && !q.isLoading && !school;

  const list = (
    <SectionCard
      title="Schools"
      description={`${schools.length} ${schools.length === 1 ? 'school' : 'schools'}`}
      headerAction={
        <Button
          testID="school-new"
          size="sm"
          icon={Plus}
          label="New"
          disabled={confirm.gate.busy}
          onPress={() => select('new')}
        />
      }
    >
      <View className="gap-3">
        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search schools…"
          label="Search schools"
        />
        {q.isLoading ? (
          <Text size="sm" color="mutedForeground">
            Loading schools…
          </Text>
        ) : rows.length === 0 ? (
          <View className="items-center gap-2 py-8">
            <Icon icon={School} size={24} color="mutedForeground" />
            <Text size="sm" color="mutedForeground">
              {search ? 'No schools match your search' : 'No schools yet'}
            </Text>
          </View>
        ) : (
          <View className="gap-1" testID="school-list">
            {rows.map((s) => {
              const active = s.id === selected;
              return (
                <Pressable
                  key={s.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  testID={`school-row-${s.id}`}
                  onPress={() => select(s.id)}
                  className={cn(
                    'flex-row items-center gap-3 rounded-lg border px-3 py-2.5',
                    active ? 'border-primary bg-primary/5' : 'hover:bg-muted/50 border-transparent',
                  )}
                >
                  <SchoolLogo logo={s.logo} size={36} />
                  <View className="min-w-0 flex-1">
                    <Text size="sm" weight="medium" numberOfLines={1}>
                      {s.name}
                    </Text>
                    <Text size="xs" color="mutedForeground" numberOfLines={1}>
                      {domainLabel(s)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </SectionCard>
  );

  const editor = showEditor ? (
    <SectionCard
      title={selected === 'new' ? 'New school' : (school?.name ?? '')}
      description={
        selected === 'new'
          ? 'Create a tenant with its initial admin and free trial'
          : domainLabel(school!)
      }
    >
      <SchoolEditor
        key={String(selected)}
        school={selected === 'new' ? null : school}
        tab={selected === 'new' && !CREATE_TABS.has(tab) ? 'identity' : tab}
        onTab={(t) => go(selected, t)}
        confirm={confirm}
        onCreated={(id) => {
          dirty.current = false;
          go(id, 'billing');
        }}
        onDirtyChange={onDirtyChange}
      />
    </SectionCard>
  ) : missing ? (
    <SectionCard title="School not found">
      <Text size="sm" color="mutedForeground">
        This school no longer exists or you can't open it.
      </Text>
    </SectionCard>
  ) : null;

  return (
    <PageLayout
      title="School Management"
      description="Create schools, edit their profile and domains, and manage admins, billing and SMS."
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
      actions={
        <Button
          variant="outline"
          size="sm"
          icon={RefreshCw}
          label="Refresh"
          onPress={() => void q.refetch()}
        />
      }
    >
      {q.isError ? (
        <ErrorState message="Couldn't load schools." onRetry={() => void q.refetch()} />
      ) : wide ? (
        <View className="flex-row items-start gap-6">
          <View style={{ width: '33.333%' }}>{list}</View>
          <View className="min-w-0 flex-1">{editor}</View>
        </View>
      ) : showList ? (
        list
      ) : (
        <View className="gap-3">
          <Pressable
            accessibilityRole="link"
            onPress={() => select(null)}
            className="flex-row items-center gap-1 self-start py-1"
            testID="school-back"
          >
            <Icon icon={ChevronLeft} size={16} color="mutedForeground" />
            <Text size="sm" color="mutedForeground">
              All schools
            </Text>
          </Pressable>
          {editor}
        </View>
      )}
      {confirm.dialog}
    </PageLayout>
  );
}
