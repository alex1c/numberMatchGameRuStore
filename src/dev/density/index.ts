/**
 * Density Lab — DEV board-density calibration (PHASE 5A).
 * Not production content. Never reachable when __DEV__ === false.
 */

export { DENSITY_FIXTURES, DENSITY_V2_VERTICAL_IDS, getDensityV2VerticalFixtures } from './fixtures'
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
export type { DensityFixtureId, DensityFixtureMeta } from './types'
