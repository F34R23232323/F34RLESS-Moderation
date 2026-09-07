import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['tests/antinuke/**/*.test.ts'], testTimeout: 10_000,
    coverage: { provider: 'v8', include: ['bot/src/antinuke/policies/**', 'bot/src/antinuke/services/{AuditAttributionService,AuthorizationService,ThresholdService,ExternalAppSecurityService,EnforcementService}.ts'],
      thresholds: { branches: 95, functions: 95, lines: 95, statements: 95 } } },
});
