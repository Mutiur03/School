import { useRouter } from 'expo-router';
import { Compass } from '@/components/ui/icons';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/states';
import { useTheme } from '@/theme/ThemeProvider';

export default function NotFound() {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <EmptyState
        icon={Compass}
        title="Page not found"
        message="This page does not exist."
        action={<Button label="Go to dashboard" onPress={() => router.replace('/')} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
