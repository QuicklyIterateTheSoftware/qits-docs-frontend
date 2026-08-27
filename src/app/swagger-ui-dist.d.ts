/**
 * swagger-ui-dist ships no type declarations; this is the narrow surface this app calls. The
 * `any`-shaped return is honest — the UI object is never read back.
 */
declare module 'swagger-ui-dist/swagger-ui-es-bundle.js' {
  interface SwaggerUIOptions {
    url: string;
    domNode: HTMLElement;
    presets?: unknown[];
  }
  const SwaggerUIBundle: {
    (options: SwaggerUIOptions): unknown;
    presets: { apis: unknown };
  };
  export default SwaggerUIBundle;
}
