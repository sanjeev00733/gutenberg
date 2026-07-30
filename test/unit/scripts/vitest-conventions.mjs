export function hasTestEnvironmentOverride( source ) {
	return /@vitest-environment(?:\s|$)/m.test( source );
}
