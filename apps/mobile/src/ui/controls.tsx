import { Check, ChevronDown } from 'lucide-react-native';
import { type ComponentRef, type Ref, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  Text as RNText,
  StyleSheet,
  TextInput,
  type TextInputProps,
  useWindowDimensions,
  View,
} from 'react-native';
import { pressedA11y } from './a11y';
import { Button } from './primitives';
import { colors, MIN_TOUCH, radius, space, type } from './theme';

interface Option<T extends string> {
  value: T;
  label: string;
}

/** Contrôle segmenté bordé magenta (« Mes CR » | « Tous »). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  testIDPrefix,
}: {
  value: T;
  options: readonly Option<T>[];
  onChange: (v: T) => void;
  label: string;
  testIDPrefix?: string;
}) {
  return (
    <View style={styles.seg} role="group" accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            {...pressedA11y(on)}
            onPress={() => onChange(o.value)}
            testID={testIDPrefix ? `${testIDPrefix}-${o.value}` : undefined}
            style={[styles.segItem, on && { backgroundColor: colors.magenta }]}
          >
            <RNText style={[type.button, { color: on ? colors.white : colors.magentaPress }]}>
              {o.label}
            </RNText>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Menu « Trier : X ▾ » : un popover sous le bouton, une option par ligne, coche sur l'option
 * courante. Rendu dans une Modal transparente : toucher à côté le ferme (Échap aussi sur le web).
 */
export function SortMenu<T extends string>({
  value,
  options,
  onChange,
  align = 'right',
  testID,
}: {
  value: T;
  options: readonly Option<T>[];
  onChange: (v: T) => void;
  /** Bord du bouton sur lequel s'aligne le menu. */
  align?: 'left' | 'right';
  testID?: string;
}) {
  const anchor = useRef<ComponentRef<typeof View>>(null);
  const window = useWindowDimensions();
  const [pos, setPos] = useState<{ top: number; left: number; right: number } | null>(null);
  const current = options.find((o) => o.value === value)?.label ?? '';

  const open = () => {
    anchor.current?.measureInWindow((x, y, w, h) => {
      setPos({ top: y + h + 6, left: x, right: window.width - (x + w) });
    });
  };
  const close = () => setPos(null);

  return (
    <View ref={anchor} collapsable={false}>
      <Button
        label={`Trier : ${current}`}
        kind="secondary"
        size="sm"
        onPress={open}
        accessibilityState={{ expanded: pos !== null }}
        testID={testID}
        trailing={
          <ChevronDown
            size={16}
            color={colors.navy}
            strokeWidth={2}
            style={pos ? styles.flipped : undefined}
          />
        }
      />
      <Modal transparent visible={pos !== null} animationType="none" onRequestClose={close}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Fermer" />
        {pos ? (
          <View
            style={[
              styles.pop,
              { top: pos.top },
              align === 'right' ? { right: pos.right } : { left: pos.left },
            ]}
            accessibilityRole="menu"
          >
            {options.map((o) => (
              <Pressable
                key={o.value}
                accessibilityRole="button"
                {...pressedA11y(o.value === value)}
                onPress={() => {
                  onChange(o.value);
                  close();
                }}
                style={({ pressed }) => [
                  styles.option,
                  pressed && { backgroundColor: colors.pressed },
                ]}
              >
                <RNText style={[type.bodyStrong, { color: colors.navy }]}>{o.label}</RNText>
                {o.value === value ? <Check size={18} color={colors.navy} strokeWidth={2} /> : null}
              </Pressable>
            ))}
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

/** Champ de saisie avec libellé (contour bleu clair au focus). */
export function Field({
  label,
  style,
  ref,
  ...rest
}: TextInputProps & { label: string; ref?: Ref<ComponentRef<typeof TextInput>> }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <RNText style={[type.label, { color: colors.sec }]}>{label}</RNText>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={colors.sec}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[type.field, styles.input, focused && styles.focused, style]}
      />
    </View>
  );
}

/** Choix entre deux valeurs (oxygène, conscience) : remplace la liste déroulante du web. */
export function ChoiceField<T extends string>({
  label,
  value,
  options,
  onChange,
  testIDPrefix,
}: {
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (v: T) => void;
  testIDPrefix?: string;
}) {
  return (
    <View style={styles.field}>
      <RNText style={[type.label, { color: colors.sec }]}>{label}</RNText>
      <View style={styles.choice} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => onChange(o.value)}
              testID={testIDPrefix ? `${testIDPrefix}-${o.value}` : undefined}
              style={[styles.choiceItem, on && styles.choiceOn]}
            >
              <RNText style={[type.buttonSm, { color: on ? colors.white : colors.navy }]}>
                {o.label}
              </RNText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  seg: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: colors.magenta,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.white,
    marginVertical: space[3],
  },
  segItem: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' },
  flipped: { transform: [{ rotate: '180deg' }] },
  pop: {
    position: 'absolute',
    minWidth: 200,
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 6,
    boxShadow: '0 10px 30px rgba(0,34,68,0.18)',
  },
  option: {
    minHeight: 48,
    padding: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  field: { gap: 6, flex: 1 },
  input: {
    minHeight: MIN_TOUCH,
    borderWidth: 1,
    borderColor: colors.fieldBorder,
    borderRadius: 10,
    paddingVertical: space[2],
    paddingHorizontal: 10,
    color: colors.navy,
    backgroundColor: colors.white,
  },
  focused: {
    outlineWidth: 3,
    outlineStyle: 'solid',
    outlineColor: colors.focus,
    outlineOffset: 1,
  },
  choice: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.fieldBorder,
    borderRadius: 10,
    overflow: 'hidden',
  },
  choiceItem: {
    flex: 1,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[2],
    backgroundColor: colors.white,
  },
  choiceOn: { backgroundColor: colors.navy },
});
