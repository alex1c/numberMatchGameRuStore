/**
 * Production identity checks — package, display name, icon paths.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import appJson from '../../../app.json'
import { APP_IDENTITY } from '../identity'

const ROOT = path.resolve(__dirname, '../../..')

describe('app identity', () => {
	it('keeps Android package and scheme stable', () => {
		expect(APP_IDENTITY.packageId).toBe('com.calculatorplatform.numbermatch')
		expect(APP_IDENTITY.scheme).toBe('number-match')
		expect(appJson.expo.android?.package).toBe(
			'com.calculatorplatform.numbermatch',
		)
		expect(appJson.expo.scheme).toBe('number-match')
	})

	it('uses the final store display name in Expo config', () => {
		expect(appJson.expo.name).toBe('Пары чисел — Number Match')
	})

	it('points Expo icon at icon_gpt.png and adaptive foreground exists', () => {
		expect(appJson.expo.icon).toBe('./assets/icon_gpt.png')
		const iconPath = path.join(ROOT, 'assets', 'icon_gpt.png')
		expect(fs.existsSync(iconPath)).toBe(true)

		const foreground = appJson.expo.android?.adaptiveIcon?.foregroundImage
		expect(typeof foreground).toBe('string')
		expect(fs.existsSync(path.join(ROOT, foreground!.replace(/^\.\//, '')))).toBe(
			true,
		)
	})
})
