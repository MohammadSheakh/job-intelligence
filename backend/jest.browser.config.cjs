module.exports = {
  ...require('./jest.config.cjs'),
  testMatch: ['**/browser/*.browser-spec.ts'],
  testTimeout: 120000,
};
