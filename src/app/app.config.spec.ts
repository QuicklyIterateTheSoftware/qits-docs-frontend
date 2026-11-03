import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { QitsSession, QitsTokens } from '@qits/angular';
import { appConfig } from './app.config';

/**
 * epic qits-543: the app must sign in with a bearer rather than ride the `qits-session` cookie
 * past the edge. These two are cheap proxies for "the provider and the interceptor are wired":
 * `QitsTokens`/`QitsSession` only resolve if `provideQitsBearerSignIn` is in the providers list,
 * and the `HttpClient` must still construct with the bearer interceptor added.
 */
describe('appConfig', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [...appConfig.providers] });
  });

  it('provides the bearer sign-in', () => {
    expect(TestBed.inject(QitsTokens)).toBeTruthy();
    expect(TestBed.inject(QitsSession)).toBeTruthy();
  });

  it('provides an HttpClient with the bearer interceptor wired', () => {
    expect(TestBed.inject(HttpClient)).toBeTruthy();
  });
});
