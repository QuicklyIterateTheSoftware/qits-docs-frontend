import { pageBaseUrl, storyPages } from './markdown-bundle';
import { openapiPathOf } from './swagger-bundle';

describe('bundle readers, the pure pieces', () => {
  it('lists the markdown pages labelled by their story directory', () => {
    const pages = storyPages([
      'on-start-the-git-host-fetches-the-platform-s-signing-keys/user-story.md',
      'on-start-the-git-host-fetches-the-platform-s-signing-keys/userflow.json',
      'another-story/user-story.md',
      'another-story/shot.png',
    ]);
    expect(pages).toEqual([
      {
        path: 'on-start-the-git-host-fetches-the-platform-s-signing-keys/user-story.md',
        label: 'on-start-the-git-host-fetches-the-platform-s-signing-keys',
      },
      { path: 'another-story/user-story.md', label: 'another-story' },
    ]);
    // A root-level page is labelled by its own name.
    expect(storyPages(['README.md'])[0].label).toBe('README');
  });

  it('resolves a page`s relative references into its own served directory', () => {
    expect(
      pageBaseUrl('@userflows/qits-githost', 'a'.repeat(40), 'some-story/user-story.md'),
    ).toBe(`/docs/@userflows/qits-githost/-/${'a'.repeat(40)}/some-story/`);
    expect(pageBaseUrl('site', '1.0.0', 'README.md')).toBe('/docs/site/-/1.0.0/');
  });

  it('finds the OpenAPI document by name, falling back to the first spec-shaped file', () => {
    expect(openapiPathOf(['index.md', 'openapi.yml'])).toBe('openapi.yml');
    expect(openapiPathOf(['docs/openapi.yaml', 'other.json'])).toBe('docs/openapi.yaml');
    expect(openapiPathOf(['spec.json'])).toBe('spec.json');
    expect(openapiPathOf(['readme.md'])).toBeUndefined();
  });
});
