import { ALL_BRANCHES, branchOf, distinctBranches, versionOptions } from './nav-tree';
import type { DocVersion } from './catalog';

/**
 * The pure pieces of the branch filter — derivation, narrowing, labels. Component wiring
 * (signals, the picker, the reset-on-site-change effect) stays untested here, the same stance
 * `doc-url.spec` takes: the grammar is what must not drift, and it is testable without a TestBed.
 */
describe('nav-tree branch filtering', () => {
  const version = (v: string, branch?: string): DocVersion => ({
    version: v,
    fileCount: 1,
    totalBytes: 1,
    publishedAt: '2026-08-27T00:00:00Z',
    ...(branch ? { metadata: { 'git.branch.name': branch } } : {}),
  });

  it('derives distinct branches in newest-first list order, skipping unbranched versions', () => {
    const versions = [
      version('c'.repeat(40), 'main'),
      version('b'.repeat(40), 'feature/x'),
      version('2026.801.30'),
      version('a'.repeat(40), 'main'),
    ];
    expect(distinctBranches(versions)).toEqual(['main', 'feature/x']);
    expect(branchOf(versions[2])).toBeUndefined();
  });

  it('narrows the options to one branch and moves the (latest) marker with the narrowing', () => {
    const versions = [
      version('c'.repeat(40), 'main'),
      version('b'.repeat(40), 'feature/x'),
      version('a'.repeat(40), 'main'),
    ];
    const narrowed = versionOptions(versions, 'feature/x');
    expect(narrowed.length).toBe(1);
    expect(narrowed[0].value).toBe('b'.repeat(40));
    expect(narrowed[0].label).toBe(`${'b'.repeat(40)} — feature/x  (latest)`);
  });

  it('shows every version under the all-branches sentinel, branch beside version where known', () => {
    const versions = [version('2026.801.30'), version('a'.repeat(40), 'main')];
    const all = versionOptions(versions, ALL_BRANCHES);
    expect(all.map((option) => option.value)).toEqual(['2026.801.30', 'a'.repeat(40)]);
    expect(all[0].label).toBe('2026.801.30  (latest)');
    expect(all[1].label).toBe(`${'a'.repeat(40)} — main`);
  });

  it('an empty narrowing is an empty list, not a fallback to everything', () => {
    expect(versionOptions([version('a'.repeat(40), 'main')], 'gone')).toEqual([]);
  });
});
