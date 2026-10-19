/**
 * Minimal typings for react-test-renderer used by ownership integration tests.
 * Package ships without its own types in this Expo toolchain pin.
 */
declare module 'react-test-renderer' {
	import type { ReactElement, ComponentType } from 'react'

	export interface ReactTestInstance {
		readonly props: Record<string, unknown>
		readonly type: unknown
		findByProps(props: Record<string, unknown>): ReactTestInstance
		findAllByProps(props: Record<string, unknown>): ReactTestInstance[]
		findByType(type: ComponentType<unknown> | string): ReactTestInstance
		findAllByType(type: ComponentType<unknown> | string): ReactTestInstance[]
		findAll(
			predicate: (node: ReactTestInstance) => boolean,
		): ReactTestInstance[]
	}

	export interface ReactTestRenderer {
		readonly root: ReactTestInstance
		unmount(): void
		toJSON(): unknown
		update(element: ReactElement): void
	}

	export function create(element: ReactElement): ReactTestRenderer

	export function act<T>(callback: () => T | Promise<T>): Promise<T>

	const renderer: {
		create: typeof create
	}
	export default renderer
}
