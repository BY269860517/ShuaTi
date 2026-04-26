import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.spec.{js,ts}'],
    passWithNoTests: true,
    coverage: {
      reporter: ['text', 'html'],
    },
  },
})
