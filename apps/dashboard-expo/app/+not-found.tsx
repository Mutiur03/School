import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Compass } from '@/components/ui/icons';
import { EmptyState } from '@/components/ui/states';

export default function NotFound() {
  const router = useRouter();
  return (
    <View className="bg-background flex-1 items-center justify-center">
      <EmptyState
        icon={Compass}
        title="Page not found"
        message="This page does not exist."
        action={<Button label="Go to dashboard" onPress={() => router.replace('/')} />}
      />
    </View>
  );
}
