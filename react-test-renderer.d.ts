/**
 * Minimal typings for react-test-renderer used by ownership integration tests.
 * Package ships without its own types in this Expo toolchain pin.
 */
declare module 'react-test-renderer' {
	import type { ReactElement } from 'react'

	export interface ReactTestRenderer {
		readonly root: unknown
		unmount(): void
		toJSON(): unknown
	}

	export function create(element: ReactElement): ReactTestRenderer

	export function act<T>(callback: () => T | Promise<T>): Promise<T>

	const renderer: {
		create: typeof create
	}
	export default renderer
}
