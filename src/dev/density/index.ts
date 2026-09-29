/**
 * Density Lab — DEV board-density calibration (PHASE 5A).
 * Not production content. Never reachable when __DEV__ === false.
 */

export type { DensityFixtureId, DensityFixtureMeta } from './types'
export { DENSITY_FIXTURES } from './fixtures'
export {
	getDensityFixtures,
	getDensityFixture,
	isDensityFixtureId,
	loadDensityFixture,
	formatDensityHeader,
} from './load'
export {
	computeViewportFill,
	DENSITY_REFERENCE_CONTENT_WIDTH,
	DENSITY_REFERENCE_VIEWPORT_HEIGHT,
} from './viewportFill'
export type { ViewportFillMetrics, ViewportFillInput } from './viewportFill'
export { createDensityCandidateBoard } from './experimentalCandidate'
