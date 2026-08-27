/**
 * Readings over a markdown bundle's FILE PATHS — the directory layout is the contract the
 * userflows framework emits: `<category-slug>/<story-slug>/user-story.md` for a categorized
 * story, `<story-slug>/user-story.md` for an uncategorized one. Pure functions, shared by the
 * reader (page selection) and the sidebar (category rows), so the two derive one hierarchy.
 */

export interface StoryPage {
  readonly path: string;
  /** The category directory, `''` for an uncategorized story. */
  readonly category: string;
  /** The story's own label: its directory name, or the file name for a root-level page. */
  readonly story: string;
}

export function storyPages(files: readonly string[]): StoryPage[] {
  return files
    .filter((file) => file.endsWith('.md'))
    .map((path) => {
      const segments = path.split('/');
      if (segments.length >= 3) {
        return { path, category: segments[0], story: segments[segments.length - 2] };
      }
      if (segments.length === 2) {
        return { path, category: '', story: segments[0] };
      }
      return { path, category: '', story: path.replace(/\.md$/, '') };
    });
}

/** The distinct categories of a bundle, in path order — empty for a flat (pre-category) bundle. */
export function categoriesOf(pages: readonly StoryPage[]): string[] {
  const seen: string[] = [];
  for (const page of pages) {
    if (page.category && !seen.includes(page.category)) {
      seen.push(page.category);
    }
  }
  return seen;
}

/** The pages a category narrows to; the empty selection means the uncategorized ones. */
export function pagesInCategory(
  pages: readonly StoryPage[],
  category: string,
): StoryPage[] {
  return pages.filter((page) => page.category === category);
}

/**
 * Where a page's RELATIVE references resolve — the served bundle directory the page sits in, with
 * the trailing slash that keeps `screenshot.png` beside the page rather than a level up.
 */
export function pageBaseUrl(site: string, version: string, page: string): string {
  const directory = page.includes('/') ? page.slice(0, page.lastIndexOf('/') + 1) : '';
  return `/docs/${site}/-/${version}/${directory}`;
}
