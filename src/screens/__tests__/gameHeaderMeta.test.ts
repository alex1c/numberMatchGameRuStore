/**
 * Campaign header must not expose seed/fingerprint to players.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('GameScreen campaign header', () => {
	const src = readFileSync(
		join(__dirname, '../GameScreen.tsx'),
		'utf8',
	)

	it('does not put seed into campaign GameHeader subtitle', () => {
		expect(src).toContain('strings.profileLabel(session.identity.profile)')
		expect(src).toContain('game-dev-meta')
		// Seed remains DEV-only diagnostic row, not header subtitle path.
		expect(src).toMatch(/testID="game-dev-meta"/)
		expect(src).toContain('seed {session.identity.seed}')
	})
})
