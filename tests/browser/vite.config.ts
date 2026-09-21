import { defineConfig } from 'vite';
import { createRequire } from 'node:module';
const require = createRequire(
  new URL('../../extension/package.json', import.meta.url),
);
export default defineConfig({
  resolve: {
    alias: {
      'react-dom/client': require.resolve('react-dom/client'),
      'react/jsx-runtime': require.resolve('react/jsx-runtime'),
      'react/jsx-dev-runtime': require.resolve('react/jsx-dev-runtime'),
      react: require.resolve('react'),
    },
  },
  esbuild: { jsx: 'automatic' },
});
