// Flat ESLint config for Expo SDK 57 + TypeScript strict.
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

module.exports = defineConfig([
	...expoConfig,
	{
		ignores: [
			'node_modules/**',
			'android/**',
			'ios/**',
			'dist/**',
			'.expo/**',
			'coverage/**',
			'scripts/**',
		],
	},
	{
		rules: {
			// Path aliases are resolved by Metro/TS; keep lint practical for RN/Expo.
			'import/no-unresolved': 'off',
		},
	},
])
