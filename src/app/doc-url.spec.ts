import { parseReadPath, readCommands, scopeOf, shortNameOf } from './doc-url';

describe('parseReadPath', () => {
  it('takes a scoped name whole, across its segments', () => {
    expect(parseReadPath(['@qits', 'ui-components'])).toEqual({ site: '@qits/ui-components' });
  });

  it('splits the version off at the platform separator', () => {
    expect(parseReadPath(['@qits', 'ui-components', '-', '2026.807.0'])).toEqual({
      site: '@qits/ui-components',
      version: '2026.807.0',
    });
  });

  /** The route's own segment. Left in, it made the reader's iframe point back at the reader. */
  it('drops the route prefix', () => {
    expect(parseReadPath(['read', '@qits', 'ui-components']).site).toBe('@qits/ui-components');
  });

  it('leaves a site actually named read alone', () => {
    expect(parseReadPath(['read', 'read', 'docs']).site).toBe('read/docs');
  });

  it('reads an unscoped name', () => {
    expect(parseReadPath(['read', 'qits-cli'])).toEqual({ site: 'qits-cli' });
  });
});

describe('readCommands', () => {
  /** One element is one segment: passed whole, the scope separator comes out as %2F. */
  it('splits the name so routerLink does not escape its slash', () => {
    expect(readCommands('@qits/ui-components')).toEqual(['/', 'read', '@qits', 'ui-components']);
  });

  it('appends the version behind the separator', () => {
    expect(readCommands('@qits/ui-components', '2026.807.0')).toEqual([
      '/',
      'read',
      '@qits',
      'ui-components',
      '-',
      '2026.807.0',
    ]);
  });

  /** The scoped spelling: the prefix is the platform's, `read` is still a segment of its own. */
  it('writes the link inside the scope it was given', () => {
    expect(
      readCommands('@qits/ui-components', undefined, [
        '/',
        'qits',
        'libs',
        'qits-spa-ui-components',
      ]),
    ).toEqual(['/', 'qits', 'libs', 'qits-spa-ui-components', 'read', '@qits', 'ui-components']);
  });

  it('round-trips whatever it produced', () => {
    const commands = readCommands('@qits/ui-components', '2026.807.0');
    expect(parseReadPath(commands.slice(1))).toEqual({
      site: '@qits/ui-components',
      version: '2026.807.0',
    });
  });
});

describe('names', () => {
  it('splits a scoped name', () => {
    expect(scopeOf('@qits/ui-components')).toBe('@qits');
    expect(shortNameOf('@qits/ui-components')).toBe('ui-components');
  });

  it('gives an unscoped name no scope and keeps it whole', () => {
    expect(scopeOf('qits-cli')).toBe('');
    expect(shortNameOf('qits-cli')).toBe('qits-cli');
  });
});
