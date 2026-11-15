import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Nunito_500Medium } from '@expo-google-fonts/nunito/500Medium';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSession } from '@/features/session/store';
import { DoneProvider } from '@/ui/overlays';
import { COLUMN_MAX_WIDTH, colors } from '@/ui/theme';
import { ToastProvider } from '@/ui/toast';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_700Bold,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });
  const hydrated = useSession((s) => s.hydrated);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 2_000, retry: 1, refetchOnWindowFocus: true } },
      }),
  );
  const ready = (fontsLoaded || fontError !== null) && hydrated;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        {/* Une colonne de 440 px au plus, centrée : même app sur téléphone et sur ordinateur. */}
        <View style={styles.page}>
          <View style={styles.column}>
            <ToastProvider>
              <DoneProvider>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.white },
                  }}
                >
                  <Stack.Screen name="index" />
                  <Stack.Screen name="connexion" options={{ title: 'Qui es-tu ?' }} />
                  <Stack.Screen name="(app)" />
                  {/* Fiche plein écran : écran empilé qui monte du bas (les toasts restent visibles au-dessus). */}
                  <Stack.Screen
                    name="patient/[patientId]"
                    options={{
                      title: 'Nouveau compte rendu',
                      animation: 'slide_from_bottom',
                      gestureDirection: 'vertical',
                    }}
                  />
                  <Stack.Screen name="serveur" options={{ title: 'Serveur' }} />
                  <Stack.Screen name="simulateur" options={{ title: 'Simulateur' }} />
                </Stack>
              </DoneProvider>
            </ToastProvider>
          </View>
        </View>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.white, alignItems: 'center' },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: COLUMN_MAX_WIDTH,
    backgroundColor: colors.white,
    boxShadow: `0 0 0 1px ${colors.shellLine}`,
  },
});
