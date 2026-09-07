import { DOC_SECTIONS, kindOf, rendererFor } from './doc-kind';

describe('doc kinds and the sub-navigation', () => {
  it('classifies a site by its scope, storybook being everything unclaimed', () => {
    expect(kindOf('@userflows/qits-githost')).toBe('userflows');
    expect(kindOf('@apidocs/qits-ci')).toBe('apidocs');
    expect(kindOf('@guides/qits-platform')).toBe('guides');
    expect(kindOf('@qits/ui-components')).toBe('storybook');
    expect(kindOf('plain-site')).toBe('storybook');
    // The scope itself, without a site under it, is nobody's special kind.
    expect(kindOf('@userflows')).toBe('storybook');
    expect(kindOf('@guides')).toBe('storybook');
  });

  /**
   * The sections are the single register of which scope means which kind, so the failures worth
   * catching are register failures: two sections claiming one scope (whichever `kindOf` found
   * first would win, silently), and a section whose declared scope does not actually classify to
   * its own kind (a typo in one field, and its sites would list under one entry while the reader
   * drew them as another).
   */
  it('declares one distinct scope per scoped section, each round-tripping through kindOf', () => {
    const scopes = DOC_SECTIONS.map((section) => section.scope).filter(Boolean);
    expect(new Set(scopes).size).toBe(scopes.length);
    for (const section of DOC_SECTIONS) {
      if (section.scope) {
        expect(kindOf(`${section.scope}/some-site`)).toBe(section.kind);
      }
    }
    // Exactly one section owns the leftovers, and it is the one the fold hands them to.
    expect(DOC_SECTIONS.filter((section) => !section.scope).map((section) => section.kind)).toEqual(
      ['storybook'],
    );
  });

  /**
   * Kinds outnumber renderers, and this pins the sharing rather than leaving it to be rediscovered:
   * a guides bundle drawn by anything but the markdown renderer would be an iframe over a directory
   * with no `index.html` — a blank page, not an error.
   */
  it('draws userflows and guides with the one markdown renderer', () => {
    expect(rendererFor('userflows')).toBe('markdown');
    expect(rendererFor('guides')).toBe('markdown');
    expect(rendererFor('apidocs')).toBe('swagger');
    expect(rendererFor('storybook')).toBe('frame');
  });
});
