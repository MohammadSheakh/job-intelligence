module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.spec.ts'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }] },
  moduleNameMapper: {
    '^@app/database$': '<rootDir>/libs/database/src',
    '^@app/common$': '<rootDir>/libs/common/src',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  clearMocks: true,
};
