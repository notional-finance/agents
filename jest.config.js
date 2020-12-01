const { pathsToModuleNameMapper } = require('ts-jest/utils');
const { compilerOptions } = require('./tsconfig');

module.exports = {
  projects: [
    {
      displayName: "unit",
      transform: {
        '^.+\\.tsx?$': 'ts-jest',
      },
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ["<rootDir>/src/**/*.spec.ts"],
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
      moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/src/' } ),
    },
    {
      displayName: "integration",
      testMatch: ["<rootDir>/test/**/*.test.ts"],
      transform: {
        '^.+\\.tsx?$': 'ts-jest',
      },
      preset: 'ts-jest',
      testEnvironment: 'node',
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
      moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/src/' } ),
    }
  ]
}
