import { branchOf, distinctBranches } from './doc-kind';
import { navSections } from './nav-tree';
import { defaultVersion, versionLabel, versionsOnBranch } from './reader';
import type { Catalog, DocVersion } from './catalog';

/**
 * The pure pieces behind the sub-navigation and the reader's selects: section folding, branch
 * derivation, narrowing, defaults, labels. Component wiring stays untested here, the stance
 * `doc-url.spec` takes.
 */
describe('sub-navigation sections and version selection', () => {
  const version = (v: string, branch?: string): DocVersion => ({
    version: v,
    fileCount: 1,
    totalBytes: 1,
    publishedAt: '2026-08-27T00:00:00Z',
    ...(branch ? { metadata: { 'git.branch.name': branch } } : {}),
  });

  it('folds the catalog into the three entries, special scopes flattened', () => {
    const catalog: Catalog = {
      scopes: [
        {
          scope: '@qits',
          docs: [{ name: '@qits/ui-components', shortName: 'ui-components', versionCount: 2, latestVersion: '1' }],
        },
        {
          scope: '@userflows',
          docs: [{ name: '@userflows/qits-githost', shortName: 'qits-githost', versionCount: 1, latestVersion: 'a' }],
        },
      ],
    };
    const sections = navSections(catalog);
    expect(sections.map((section) => section.route)).toEqual([
      'storybook',
      'apidocs',
      'userflows',
    ]);
    expect(sections[0].docs.map((entry) => entry.name)).toEqual(['@qits/ui-components']);
    expect(sections[1].docs).toEqual([]);
    expect(sections[2].docs.map((entry) => entry.shortName)).toEqual(['qits-githost']);
  });

  it('derives distinct branches newest-first, skipping unbranched versions', () => {
    const versions = [
      version('c'.repeat(40), 'main'),
      version('b'.repeat(40), 'feature/x'),
      version('2026.801.30'),
      version('a'.repeat(40), 'main'),
    ];
    expect(distinctBranches(versions)).toEqual(['main', 'feature/x']);
    expect(branchOf(versions[2])).toBeUndefined();
  });

  it('narrows to a branch while keeping unbranched versions reachable', () => {
    const versions = [
      version('c'.repeat(40), 'main'),
      version('b'.repeat(40), 'feature/x'),
      version('2026.801.30'),
    ];
    expect(versionsOnBranch(versions, 'main').map((v) => v.version)).toEqual([
      'c'.repeat(40),
      '2026.801.30',
    ]);
    expect(versionsOnBranch(versions, undefined).length).toBe(3);
  });

  it('defaults a link without a version to the latest main, else the newest', () => {
    expect(
      defaultVersion([version('b'.repeat(40), 'feature/x'), version('a'.repeat(40), 'main')]),
    ).toBe('a'.repeat(40));
    expect(defaultVersion([version('2026.807.0'), version('2026.806.0')])).toBe('2026.807.0');
    expect(defaultVersion([])).toBeUndefined();
  });

  it('labels a sha short and everything else as itself', () => {
    expect(versionLabel('f'.repeat(40))).toBe('f'.repeat(12));
    expect(versionLabel('2026.807.0')).toBe('2026.807.0');
  });
});
