import { defineConfig } from 'vitest/config';

// Tests unitaires de la logique pure du mobile (src/lib) : sans React Native.
export default defineConfig({
  test: {
    include: ['src/lib/**/*.test.ts'],
    environment: 'node',
  },
});
