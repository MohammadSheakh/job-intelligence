module.exports = {
  ...require('./jest.config.cjs'),
  testMatch: ['**/database/*.database-spec.ts'],
  testTimeout: 30000,
};
