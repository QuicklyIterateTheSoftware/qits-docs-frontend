import { categoriesOf, pageBaseUrl, pagesInCategory, storyPages } from './bundle-files';
import { storyTitle } from './markdown-bundle';
import { openapiPathOf } from './swagger-bundle';

describe('bundle readers, the pure pieces', () => {
  it('reads the story hierarchy off the paths — category directory, story directory, page', () => {
    const pages = storyPages([
      'authentication/on-start-the-git-host-fetches-the-platform-s-signing-keys/user-story.md',
      'authentication/on-start-the-git-host-fetches-the-platform-s-signing-keys/userflow.json',
      'authentication/a-stranger-s-token-never-opens-the-git-host/user-story.md',
      'uncategorized-story/user-story.md',
      'README.md',
    ]);
    expect(pages).toEqual([
      {
        path: 'authentication/on-start-the-git-host-fetches-the-platform-s-signing-keys/user-story.md',
        category: 'authentication',
        story: 'on-start-the-git-host-fetches-the-platform-s-signing-keys',
      },
      {
        path: 'authentication/a-stranger-s-token-never-opens-the-git-host/user-story.md',
        category: 'authentication',
        story: 'a-stranger-s-token-never-opens-the-git-host',
      },
      { path: 'uncategorized-story/user-story.md', category: '', story: 'uncategorized-story' },
      { path: 'README.md', category: '', story: 'README' },
    ]);
  });

  it('derives categories in path order and narrows pages to one', () => {
    const pages = storyPages([
      'authentication/a/user-story.md',
      'browsing/b/user-story.md',
      'flat/user-story.md',
    ]);
    expect(categoriesOf(pages)).toEqual(['authentication', 'browsing']);
    expect(pagesInCategory(pages, 'browsing').map((page) => page.story)).toEqual(['b']);
    // The empty selection is the uncategorized set — what a flat (pre-category) bundle shows.
    expect(pagesInCategory(pages, '').map((page) => page.story)).toEqual(['flat']);
  });

  it('resolves a page`s relative references into its own served directory', () => {
    expect(
      pageBaseUrl('@userflows/qits-githost', 'a'.repeat(40), 'authentication/some-story/user-story.md'),
    ).toBe(`/docs/@userflows/qits-githost/-/${'a'.repeat(40)}/authentication/some-story/`);
    expect(pageBaseUrl('site', '1.0.0', 'README.md')).toBe('/docs/site/-/1.0.0/');
  });

  it('labels a legend entry with the story`s own h1, falling back to the slug', () => {
    expect(storyTitle("# A stranger's token never opens the git host\n\nbody", 'slug')).toBe(
      "A stranger's token never opens the git host",
    );
    // No h1 (or only deeper headings): the slug stands in.
    expect(storyTitle('## steps\n\nbody', 'a-story-slug')).toBe('a-story-slug');
    expect(storyTitle('', 'a-story-slug')).toBe('a-story-slug');
  });

  it('finds the OpenAPI document by name, falling back to the first spec-shaped file', () => {
    expect(openapiPathOf(['index.md', 'openapi.yml'])).toBe('openapi.yml');
    expect(openapiPathOf(['docs/openapi.yaml', 'other.json'])).toBe('docs/openapi.yaml');
    expect(openapiPathOf(['spec.json'])).toBe('spec.json');
    expect(openapiPathOf(['readme.md'])).toBeUndefined();
  });
});
