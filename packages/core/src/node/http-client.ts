import type { HttpAnswer, HttpClient } from '../seams/seams.js';

/**
 * The Node `fetch` behind HTTP-mode reads (ADR-015): exactly the headers given,
 * no cookie jar, no browser headers added by `cta`, one attempt.
 */
export class FetchHttpClient implements HttpClient {
  constructor(private readonly timeoutMs = 30_000) {}

  async post(
    url: string,
    headers: Readonly<Record<string, string>>,
    body: string,
  ): Promise<HttpAnswer> {
    const r = await fetch(url, {
      method: 'POST',
      headers: { ...headers },
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    return {
      status: r.status,
      contentType: r.headers.get('content-type') ?? '',
      body: await r.text(),
    };
  }
}
