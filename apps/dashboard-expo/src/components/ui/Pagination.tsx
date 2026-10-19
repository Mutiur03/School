import { View } from 'react-native';
import { Button } from './Button';
import { ChevronLeft, ChevronRight } from './icons';
import { Text } from './Text';

export function Pagination({
  page,
  totalPages,
  onPage,
  busy,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
  busy?: boolean;
}) {
  if (totalPages <= 1) return null;
  return (
    <View className="flex-row items-center justify-end gap-2">
      <Text size="sm" color="mutedForeground" tabular>
        Page {page} of {totalPages}
      </Text>
      <Button
        variant="outline"
        size="icon-sm"
        icon={ChevronLeft}
        accessibilityLabel="Previous page"
        disabled={page <= 1 || busy}
        onPress={() => onPage(Math.max(1, page - 1))}
      />
      <Button
        variant="outline"
        size="icon-sm"
        icon={ChevronRight}
        accessibilityLabel="Next page"
        disabled={page >= totalPages || busy}
        onPress={() => onPage(Math.min(totalPages, page + 1))}
      />
    </View>
  );
}
