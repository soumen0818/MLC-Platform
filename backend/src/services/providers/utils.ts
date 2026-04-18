export function normalizeLookupKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function fetchJson<T>(
  input: string | URL,
  init: RequestInit = {},
  timeoutMs: number = 10000
): Promise<{ response: Response; data: T; rawText: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    const rawText = await response.text();
    const trimmed = rawText.trim();

    let data = {} as T;

    if (trimmed) {
      const contentType = response.headers.get('content-type') || '';
      const looksLikeJson =
        /json/i.test(contentType) ||
        trimmed.startsWith('{') ||
        trimmed.startsWith('[');

      if (looksLikeJson) {
        try {
          data = JSON.parse(trimmed) as T;
        } catch {
          data = {} as T;
        }
      }
    }

    return { response, data, rawText };
  } finally {
    clearTimeout(timeout);
  }
}

export function getHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string
): string | undefined {
  const normalized = name.toLowerCase();

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== normalized) {
      continue;
    }

    if (Array.isArray(value)) {
      return value[0];
    }

    return value;
  }

  return undefined;
}
