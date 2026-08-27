import { DOC_SECTIONS, kindOf } from './doc-kind';
import { navSections } from './nav-tree';
import type { Catalog } from './catalog';

describe('doc kinds and the sub-navigation', () => {
  it('classifies a site by its scope, storybook being everything unclaimed', () => {
    expect(kindOf('@userflows/qits-githost')).toBe('userflows');
    expect(kindOf('@apidocs/qits-ci')).toBe('apidocs');
    expect(kindOf('@qits/ui-components')).toBe('storybook');
    expect(kindOf('plain-site')).toBe('storybook');
    // The scope itself, without a site under it, is nobody's special kind.
    expect(kindOf('@userflows')).toBe('storybook');
  });

  it('folds the catalog into three always-present sections', () => {
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
    expect(sections.map((section) => section.label)).toEqual(
      DOC_SECTIONS.map((section) => section.label),
    );
    // Storybook keeps its scope grouping; the special scopes render flat (scope label null) —
    // repeating @userflows under a header that says Userflows would be saying it twice.
    expect(sections[0].groups[0].scope).toBe('@qits');
    expect(sections[1].groups).toEqual([]); // apidocs: nothing published yet
    expect(sections[2].groups[0].scope).toBeNull();
    expect(sections[2].groups[0].docs[0].shortName).toBe('qits-githost');
  });
});
