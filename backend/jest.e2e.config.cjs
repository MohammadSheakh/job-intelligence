module.exports = {
  ...require('./jest.config.cjs'),
  testMatch: ['<rootDir>/test/e2e/**/*.e2e-spec.ts'],
  testTimeout: 30000,
};
