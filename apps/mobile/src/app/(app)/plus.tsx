import { router } from 'expo-router';
import { FlaskConical, Inbox, type LucideIcon, Settings } from 'lucide-react-native';
import { View } from 'react-native';
import { ListRow } from '@/ui/controls';
import { Screen } from '@/ui/layout';
import { Divider, Section, Text } from '@/ui/primitives';
import { useTheme } from '@/ui/ThemeProvider';
import { space } from '@/ui/theme';

const LINKS: {
  href: '/simulateur' | '/dpi' | '/reglages';
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  {
    href: '/simulateur',
    label: 'Simulateur',
    hint: 'Rejouer une journée fictive pour la démo',
    icon: FlaskConical,
  },
  { href: '/dpi', label: 'DPI simulé', hint: 'Ce qui a été exporté (FHIR)', icon: Inbox },
  {
    href: '/reglages',
    label: 'Réglages',
    hint: 'Serveur, IA, thème, changer de soignant',
    icon: Settings,
  },
];

export default function PlusScreen() {
  const { colors } = useTheme();
  return (
    <Screen title="Plus">
      <Section flush>
        {LINKS.map((l, i) => (
          <View key={l.href}>
            {i > 0 ? <Divider inset={space.lg} /> : null}
            <ListRow
              onPress={() => router.push(l.href)}
              leading={<l.icon size={22} color={colors.inkMuted} />}
            >
              <Text variant="bodyStrong">{l.label}</Text>
              <Text variant="caption" tone="subtle">
                {l.hint}
              </Text>
            </ListRow>
          </View>
        ))}
      </Section>
    </Screen>
  );
}
