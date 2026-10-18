import '../global.css';
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  useFonts,
} from '@expo-google-fonts/outfit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState, type ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiProvider } from '@/session/ApiProvider';
import { getCurrentTenantResolution } from '@/tenant/current-resolution';
import { TenantProvider, useTenant } from '@/tenant/TenantProvider';
import { ThemeProvider } from '@/theme/ThemeProvider';

function TenantTheme({ children }: { children: ReactNode }) {
  const { branding } = useTenant();
  return <ThemeProvider overrides={branding.theme}>{children}</ThemeProvider>;
}

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { refetchOnWindowFocus: false } },
      }),
  );
  const [tenant] = useState(getCurrentTenantResolution);
  // The web dashboard's typeface (Outfit). Render nothing until it is ready (or failed, in which
  // case the system font is used) so text never reflows after first paint.
  const [fontsLoaded, fontError] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ApiProvider tenant={tenant}>
          <TenantProvider resolution={tenant}>
            <TenantTheme>
              <StatusBar style="dark" />
              <Slot />
            </TenantTheme>
          </TenantProvider>
        </ApiProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
