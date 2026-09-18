// A preview gateway can briefly fail before a request reaches Express.
// Retry reads only. Never replay payments, submissions, closing, or other writes.
export async function requestWithRetry(
  url: string,
  init: RequestInit = {},
  transport: typeof fetch = fetch,
  pause: (ms: number) => Promise<void> = (ms) => new Promise(resolve => setTimeout(resolve, ms)),
): Promise<Response> {
  const canRetry = (init.method ?? "GET").toUpperCase() === "GET";
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await transport(url, init);
      let transient = [502, 503, 504].includes(response.status);
      if (response.status === 400) {
        // Do not retry real application validation errors.
        const body = await response.clone().json().catch(() => null);
        transient = body?.detail === "Request failed";
      }
      if (!canRetry || !transient || attempt >= 2) return response;
    } catch (error) {
      if (!canRetry || attempt >= 2 || init.signal?.aborted ||
          (error instanceof Error && error.name === "AbortError")) throw error;
    }
    await pause(attempt === 0 ? 350 : 900);
  }
}

export async function responseError(response: Response): Promise<Error> {
  if (response.status === 401) return new Error("Your session has expired. Please sign out and sign in again.");
  const text = await response.text();
  let message: unknown;
  try {
    const body = JSON.parse(text);
    message = body.message ?? body.error ?? body.detail;
  } catch {
    // Do not expose proxy HTML or technical response bodies.
  }
  if (typeof message !== "string" || message === "Request failed" || response.status >= 500)
    message = "We couldn't connect to the service. Please try again in a moment.";
  return new Error(message as string);
}
