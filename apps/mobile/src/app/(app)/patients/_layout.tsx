import { Stack } from 'expo-router';
import { useTheme } from '@/ui/ThemeProvider';

export default function PatientsLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
  );
}
