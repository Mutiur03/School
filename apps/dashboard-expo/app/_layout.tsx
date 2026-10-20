import '../global.css';
// Web: registers the browser Back/Forward interceptor before the router's own listener.
import '@/navigation/web-back-guard';
import '@/theme/web-input-css';
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  useFonts,
} from '@expo-google-fonts/outfit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Slot } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Image, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BootScreen } from '@/components/layout/BootScreen';
import { ToastProvider } from '@/components/ui/Toast';
import { SchoolProvider, useSchool } from '@/school/SchoolProvider';
import { ApiProvider } from '@/session/ApiProvider';
import { getCurrentTenantResolution } from '@/tenant/current-resolution';
import { TenantProvider, useTenant } from '@/tenant/TenantProvider';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { lightColors } from '@/theme/tokens';

/** Fonts are bundled, but never let a stuck load hold startup: fall back to the system font. */
const FONT_TIMEOUT_MS = 4_000;

function TenantTheme({ children }: { children: ReactNode }) {
  const { branding } = useTenant();
  // Web tab: the school's own logo and name (no static favicon: multi-tenant). The logo is set
  // only once it has loaded, so a broken logo never shows as a broken icon.
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  useEffect(() => {
    setFaviconUrl(null);
    const url = branding.logoUrl;
    if (!url) return;
    let active = true;
    Image.prefetch(url).then(
      // react-native-web resolves with undefined on success; native resolves a boolean.
      (ok) => active && ok !== false && setFaviconUrl(url),
      () => {},
    );
    return () => {
      active = false;
    };
  }, [branding.logoUrl]);
  return (
    <ThemeProvider overrides={branding.theme}>
      <Head>
        <title>{branding.displayName}</title>
        {faviconUrl ? <link rel="icon" href={faviconUrl} /> : null}
      </Head>
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  );
}

/**
 * Tenant follows the confirmed school (or platform mode); everything below re-keys when it
 * changes, so a school session and the platform session never share a client, token or cache.
 */
function TenantRoot() {
  const { ready, selection, platform } = useSchool();
  const { resolution, connection } = useMemo(
    () => getCurrentTenantResolution(selection, platform),
    [selection, platform],
  );
  if (!ready) return <BootScreen label="Starting…" />;
  return (
    <ApiProvider tenant={resolution} connection={connection}>
      <TenantProvider resolution={resolution}>
        <TenantTheme>
          <Slot />
        </TenantTheme>
      </TenantProvider>
    </ApiProvider>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { refetchOnWindowFocus: false } },
      }),
  );
  // Outfit (Latin) + SolaimanLipi (Bangla), matching dashboard MixedFont. Boot until ready (or
  // failed / timed out, in which case the system font is used) so text never reflows.
  const [fontsLoaded, fontError] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro asset require
    SolaimanLipi: require('../assets/fonts/SolaimanLipi.ttf'),
  });
  const [fontTimedOut, setFontTimedOut] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setFontTimedOut(true), FONT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);
  const fontsReady = fontsLoaded || Boolean(fontError) || fontTimedOut;

  return (
    // The root always paints the light background. Android's window background follows the
    // phone's dark mode (the light-only userInterfaceStyle needs a native module this binary does
    // not have), so any transparent screen would otherwise show dark grey through it.
    <View style={{ flex: 1, backgroundColor: lightColors.background }}>
      <StatusBar style="dark" />
      <SafeAreaProvider>
        {fontsReady ? (
          <QueryClientProvider client={queryClient}>
            <SchoolProvider>
              <TenantRoot />
            </SchoolProvider>
          </QueryClientProvider>
        ) : (
          <BootScreen textReady={false} />
        )}
      </SafeAreaProvider>
    </View>
  );
}
