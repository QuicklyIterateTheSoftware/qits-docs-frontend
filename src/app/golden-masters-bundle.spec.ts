import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  GoldenMastersBundle,
  dependsOnSummary,
  frozenSummary,
  prettyJson,
} from './golden-masters-bundle';

const SITE = '@contracts/qits-projects';
const VERSION = '2026.930.0';
const INDEX_URL = `/docs/${SITE}/-/${VERSION}/golden-masters/index.json`;
const DETAIL_URL = '/docs/api/version';

describe('golden masters, the pure pieces', () => {
  it('reads frozen fields compactly, tolerating extra unknown keys', () => {
    expect(
      frozenSummary({
        ids: ['$.id'],
        instants: [],
        listFilteredTo: null,
        somethingElse: 'ignored',
      }),
    ).toBe('frozen ids: $.id');
    expect(frozenSummary({ ids: [], instants: ['$.createdAt'], listFilteredTo: 'contains:$.items' })).toBe(
      'frozen instants: $.createdAt · matched as contains: contains:$.items',
    );
    expect(frozenSummary(undefined)).toBe('');
    expect(frozenSummary({})).toBe('');
  });

  it('reads a state`s dependencies compactly, empty when there are none', () => {
    expect(dependsOnSummary([{ provider: 'qits-projects', state: 'a project exists' }])).toBe(
      'qits-projects: a project exists',
    );
    expect(dependsOnSummary([])).toBe('');
    expect(dependsOnSummary(undefined)).toBe('');
  });

  it('pretty-prints recorded JSON, falling back to the raw text when it does not parse', () => {
    expect(prettyJson('{"a":1}')).toBe('{\n  "a": 1\n}');
    expect(prettyJson('not json')).toBe('not json');
  });
});

describe('GoldenMastersBundle', () => {
  async function render() {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    await TestBed.compileComponents();
    const fixture = TestBed.createComponent(GoldenMastersBundle);
    fixture.componentRef.setInput('site', SITE);
    fixture.componentRef.setInput('version', VERSION);
    fixture.detectChanges();
    return { fixture, http: TestBed.inject(HttpTestingController) };
  }

  function answerDetail(http: HttpTestingController, files: string[] = []): void {
    http
      .expectOne((request) => request.url === DETAIL_URL)
      .flush({
        version: VERSION,
        fileCount: files.length,
        totalBytes: 0,
        publishedAt: '2026-09-30T00:00:00Z',
        files,
      });
  }

  const TWO_STATE_INDEX = {
    formatVersion: 1,
    provider: 'qits-projects',
    states: [
      {
        name: 'a project exists',
        slug: 'a-project-exists',
        params: { projectId: '00000000-0000-4000-8000-000000000001' },
        dependsOn: [],
        operations: [
          {
            operationId: 'getProject',
            method: 'GET',
            path: '/projects/api/projects/{projectId}',
            status: 200,
            file: 'a-project-exists/getProject.json',
            frozen: { ids: ['$.id'], instants: [], listFilteredTo: null },
          },
        ],
      },
      {
        name: 'no projects exist',
        slug: 'no-projects-exist',
        params: {},
        operations: [
          {
            operationId: 'listProjects',
            method: 'GET',
            path: '/projects/api/projects',
            status: 200,
            file: 'no-projects-exist/listProjects.json',
            frozen: { ids: [], instants: [], listFilteredTo: null },
          },
        ],
      },
    ],
  };

  it('lists the states and operations off a fixture index', async () => {
    const { fixture, http } = await render();
    http.expectOne((request) => request.url === INDEX_URL).flush(TWO_STATE_INDEX);
    answerDetail(http);
    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('a project exists');
    expect(text).toContain('no projects exist');
    expect(text).toContain('GET');
    expect(text).toContain('/projects/api/projects/{projectId}');
    expect(text).toContain('200');
    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.state').length,
    ).toBe(2);
  });

  it('fetches and pretty-prints a recorded file only once its operation is expanded', async () => {
    const { fixture, http } = await render();
    http.expectOne((request) => request.url === INDEX_URL).flush(TWO_STATE_INDEX);
    answerDetail(http);
    await fixture.whenStable();

    http.expectNone(
      `/docs/${SITE}/-/${VERSION}/golden-masters/a-project-exists/getProject.json`,
    );

    const details = (fixture.nativeElement as HTMLElement).querySelector(
      'details.operation',
    ) as HTMLDetailsElement;
    details.open = true;
    details.dispatchEvent(new Event('toggle'));
    await fixture.whenStable();

    http
      .expectOne(`/docs/${SITE}/-/${VERSION}/golden-masters/a-project-exists/getProject.json`)
      .flush('{"id":"00000000-0000-4000-8000-000000000001"}');
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('pre.recorded')?.textContent).toContain(
      '"id"',
    );
  });

  /** An unknown formatVersion must never render a blank page — a notice plus the file list instead. */
  it('shows a notice and the raw file list on an unrecognized formatVersion', async () => {
    const { fixture, http } = await render();
    http
      .expectOne((request) => request.url === INDEX_URL)
      .flush({ formatVersion: 2, provider: 'qits-projects', states: [] });
    answerDetail(http, ['golden-masters/index.json', 'golden-masters/a/getProject.json']);
    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('format version 2');
    expect(text).toContain('golden-masters/a/getProject.json');
  });

  /** A missing index.json is the same shape of failure: notice + file list, never a blank page. */
  it('shows a notice and the raw file list when index.json is missing', async () => {
    const { fixture, http } = await render();
    http
      .expectOne((request) => request.url === INDEX_URL)
      .flush('not found', { status: 404, statusText: 'Not Found' });
    answerDetail(http, ['openapi.yml']);
    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No golden-masters index found');
    expect(text).toContain('openapi.yml');
  });
});
