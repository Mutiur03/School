// First: holds the native splash from module load until the first real screen renders.
import '@/boot/splash';
import '../global.css';
// Web: registers the browser Back/Forward interceptor before the router's own listener.
import '@/navigation/web-back-guard';
import '@/theme/web-input-css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Slot } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Image, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BootScreen } from '@/components/layout/BootScreen';
import { ToastProvider } from '@/components/ui/Toast';
import { DeploymentGuard } from '@/navigation/DeploymentGuard';
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
function TenantRoot({ fontsReady }: { fontsReady: boolean }) {
  const { ready, selection, platform } = useSchool();
  const { resolution, connection } = useMemo(
    () => getCurrentTenantResolution(selection, platform),
    [selection, platform],
  );
  if (!ready) return <BootScreen label="Starting…" textReady={fontsReady} />;
  // The session restore (SecureStore read + refresh) and the branding cache start here, while the
  // fonts may still be loading; only the screens wait for the fonts.
  return (
    <ApiProvider tenant={resolution} connection={connection}>
      <TenantProvider resolution={resolution}>
        <TenantTheme>
          {fontsReady ? (
            <DeploymentGuard>
              <Slot />
            </DeploymentGuard>
          ) : (
            <BootScreen textReady={false} />
          )}
        </TenantTheme>
      </TenantProvider>
    </ApiProvider>
  );
}

/**
 * Android: the fonts are embedded at build time (expo-font plugin, app.config.ts) under their file
 * names (Outfit_400Regular, ..., SolaimanLipi), exactly the families the theme uses, so screens
 * never wait for a runtime font load. iOS registers embedded fonts under their internal names
 * ("Outfit", "Outfit-Medium", ...), not the file names, and web has no embedding: both still load
 * them at runtime with useFonts.
 */
const FONTS_EMBEDDED = Platform.OS === 'android';

function useRuntimeFonts(): boolean {
  // Outfit (Latin) + SolaimanLipi (Bangla), matching dashboard MixedFont. Screens wait until ready
  // (or failed / timed out, in which case the system font is used) so text never reflows.
  const [fontsLoaded, fontError] = useFonts({
    // Local copies, not @expo-google-fonts: its export path has a node_modules segment, which
    // `wrangler pages deploy` never uploads, so the fonts 404 on Cloudflare Pages.
    /* eslint-disable @typescript-eslint/no-require-imports -- Metro asset requires */
    Outfit_400Regular: require('../assets/fonts/Outfit_400Regular.ttf'),
    Outfit_500Medium: require('../assets/fonts/Outfit_500Medium.ttf'),
    Outfit_600SemiBold: require('../assets/fonts/Outfit_600SemiBold.ttf'),
    Outfit_700Bold: require('../assets/fonts/Outfit_700Bold.ttf'),
    SolaimanLipi: require('../assets/fonts/SolaimanLipi.ttf'),
    /* eslint-enable @typescript-eslint/no-require-imports */
  });
  const [fontTimedOut, setFontTimedOut] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setFontTimedOut(true), FONT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);
  return fontsLoaded || Boolean(fontError) || fontTimedOut;
}

const useAppFonts: () => boolean = FONTS_EMBEDDED ? () => true : useRuntimeFonts;

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { refetchOnWindowFocus: false } },
      }),
  );
  const fontsReady = useAppFonts();

  return (
    // The root always paints the light background. Android's window background follows the
    // phone's dark mode (the light-only userInterfaceStyle needs a native module this binary does
    // not have), so any transparent screen would otherwise show dark grey through it.
    <View style={{ flex: 1, backgroundColor: lightColors.background }}>
      <StatusBar style="dark" />
      <SafeAreaProvider>
        {/* Saved school, session and fonts load in parallel; text waits for the fonts. */}
        <QueryClientProvider client={queryClient}>
          <SchoolProvider>
            <TenantRoot fontsReady={fontsReady} />
          </SchoolProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </View>
  );
}
