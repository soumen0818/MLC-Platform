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
): Promise<{ response: Response; data: T }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    const data = (await response.json()) as T;
    return { response, data };
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
