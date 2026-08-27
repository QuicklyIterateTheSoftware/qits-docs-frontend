import { DOC_SECTIONS, kindOf } from './doc-kind';

describe('doc kinds and the sub-navigation', () => {
  it('classifies a site by its scope, storybook being everything unclaimed', () => {
    expect(kindOf('@userflows/qits-githost')).toBe('userflows');
    expect(kindOf('@apidocs/qits-ci')).toBe('apidocs');
    expect(kindOf('@qits/ui-components')).toBe('storybook');
    expect(kindOf('plain-site')).toBe('storybook');
    // The scope itself, without a site under it, is nobody's special kind.
    expect(kindOf('@userflows')).toBe('storybook');
  });

});
