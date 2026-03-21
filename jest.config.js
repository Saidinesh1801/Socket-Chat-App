/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./tests/setup.ts'],
  testTimeout: 60000,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'middleware/**/*.ts',
    'routes/**/*.ts',
    'socket/**/*.ts',
    'utils/**/*.ts',
    'config/**/*.ts',
    '!/**/*.d.ts'
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        esModuleInterop: true
      }
    }]
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testMatch: ['**/tests/**/*.test.ts']
};
