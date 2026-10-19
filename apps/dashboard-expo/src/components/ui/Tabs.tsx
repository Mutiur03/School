/**
 * The web TabNav: underlined tabs with an icon (`border-b-2 border-primary` when active). One
 * row that scrolls sideways on narrow screens instead of wrapping.
 */
import { Pressable, View } from 'react-native';
import { cn } from '@/lib/utils';
import { Icon } from './Icon';
import { ScrollView } from './ScrollView';
import type { LucideIcon } from './icons';
import { Text } from './Text';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon: LucideIcon;
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  testID,
}: {
  tabs: readonly TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  testID?: string;
}) {
  return (
    <View className="border-border border-b">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        role="tablist"
        contentContainerClassName="gap-1"
      >
        {tabs.map((t) => {
          const on = t.id === value;
          return (
            <Pressable
              key={t.id}
              role="tab"
              aria-selected={on}
              accessibilityState={{ selected: on }}
              onPress={() => onChange(t.id)}
              className={cn(
                'flex-row items-center gap-2 border-b-2 px-3 py-2.5 sm:px-4',
                on ? 'border-primary' : 'border-transparent',
              )}
              testID={testID ? `${testID}-${t.id}` : undefined}
            >
              <Icon icon={t.icon} size={16} color={on ? 'primary' : 'mutedForeground'} />
              <Text
                size="sm"
                weight={on ? 'semibold' : 'medium'}
                color={on ? undefined : 'mutedForeground'}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
