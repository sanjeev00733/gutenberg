/**
 * Node dependencies
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * External dependencies
 */
import { describe, expect, test } from 'vitest';

/**
 * Internal dependencies
 */
import {
	assertVitestProjectNames,
	canonicalizeRenamedTestFiles,
	findOverlappingVitestProjectTests,
	getVitestTestsForProject,
} from '../discover-test-files.mjs';
import { hasTestEnvironmentOverride } from '../vitest-conventions.mjs';

describe( 'Vitest project routing', () => {
	test( 'accepts the browser, jsdom, and node projects', () => {
		expect( () =>
			assertVitestProjectNames( 'vitest.projects', {
				browser: {},
				jsdom: {},
				node: {},
			} )
		).not.toThrow();
	} );

	test( 'rejects a missing Vitest project', () => {
		expect( () =>
			assertVitestProjectNames( 'vitest.projects', {
				jsdom: {},
				node: {},
			} )
		).toThrow(
			'vitest.projects must define exactly these projects: browser, jsdom, node.'
		);
	} );

	test( 'rejects an unknown Vitest project', () => {
		expect( () =>
			assertVitestProjectNames( 'vitest.projects', {
				browser: {},
				jsdom: {},
				node: {},
				worker: {},
			} )
		).toThrow(
			'vitest.projects must define exactly these projects: browser, jsdom, node.'
		);
	} );

	test( 'reports tests owned by multiple projects', () => {
		expect(
			findOverlappingVitestProjectTests( {
				browser: [ 'packages/components/src/test/index.js' ],
				jsdom: [ 'packages/components/src/test/index.js' ],
				node: [ 'tools/example/test/index.js' ],
			} )
		).toEqual( [
			'packages/components/src/test/index.js: browser, jsdom',
		] );
	} );

	test( 'preserves baseline identities for renamed tests', () => {
		expect(
			canonicalizeRenamedTestFiles(
				[
					'packages/example/src/test/unchanged.js',
					'packages/example/src/test/renamed.jsx',
				],
				{
					'packages/example/src/test/renamed.js':
						'packages/example/src/test/renamed.jsx',
				}
			)
		).toEqual( [
			'packages/example/src/test/renamed.js',
			'packages/example/src/test/unchanged.js',
		] );
	} );

	test( 'excludes directory tests routed to another project', () => {
		const rootDir = mkdtempSync(
			path.join( tmpdir(), 'gutenberg-vitest-routing-' )
		);
		const testDirectory = path.join( rootDir, 'packages/example/src/test' );

		try {
			mkdirSync( testDirectory, { recursive: true } );
			writeFileSync( path.join( testDirectory, 'browser.test.js' ), '' );
			writeFileSync( path.join( testDirectory, 'jsdom.test.js' ), '' );

			expect(
				getVitestTestsForProject(
					rootDir,
					{
						vitest: {
							projects: {
								jsdom: {
									files: [],
									directories: [ 'packages/example' ],
									excludedFiles: [
										'packages/example/src/test/browser.test.js',
									],
								},
							},
						},
						added: { vitest: { jsdom: [] } },
					},
					'jsdom'
				)
			).toEqual( [ 'packages/example/src/test/jsdom.test.js' ] );
		} finally {
			rmSync( rootDir, { recursive: true } );
		}
	} );

	test( 'detects per-file Vitest and Jest environment overrides', () => {
		const vitestEnvironment = [ '@vitest', '-environment' ].join( '' );
		const jestEnvironment = [ '@jest', '-environment' ].join( '' );

		expect(
			hasTestEnvironmentOverride( `// ${ vitestEnvironment } node` )
		).toBe( true );
		expect(
			hasTestEnvironmentOverride( `/** ${ jestEnvironment } jsdom */` )
		).toBe( true );
	} );

	test( 'allows per-file environment options', () => {
		const vitestEnvironmentOptions = [
			'@vitest',
			'-environment-options',
		].join( '' );

		expect(
			hasTestEnvironmentOverride(
				`// ${ vitestEnvironmentOptions } { "url": "https://example.com" }`
			)
		).toBe( false );
	} );
} );
