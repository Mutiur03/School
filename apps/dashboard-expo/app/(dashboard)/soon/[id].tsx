/** Every admin menu entry without an Expo screen yet lands here (see src/navigation/nav-items.ts). */
import { useLocalSearchParams } from 'expo-router';
import { NotBuiltYet } from '@/components/layout/NotBuiltYet';
import { findNavLink } from '@/navigation/nav-items';

export default function SoonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = id ? findNavLink(id) : undefined;
  return <NotBuiltYet title={item?.label ?? 'Not found'} webPath={item?.webPath ?? null} />;
}
