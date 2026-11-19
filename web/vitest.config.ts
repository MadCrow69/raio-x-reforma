import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
    // Testes ao vivo (exigem os motores no ar): npm run test:live
    exclude: [...configDefaults.exclude, 'src/**/*.live.test.ts'],
  },
})
