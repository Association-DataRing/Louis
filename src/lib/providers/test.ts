import { PROVIDER_CATALOG, type ProviderType } from "./catalog";

export type TestStatus = "ok" | "auth_error" | "network_error" | "skipped";

/**
 * Probe a provider's `/models` endpoint to confirm the API key works.
 *
 * Returns "skipped" when the provider has no generic test endpoint (e.g. OVH
 * AI Endpoints which are model-specific).
 */
export async function testProvider(
  type: ProviderType,
  apiKey: string,
  baseUrlOverride?: string | null
): Promise<TestStatus> {
  const meta = PROVIDER_CATALOG[type];
  const base = baseUrlOverride?.trim() || meta.testBaseUrl;
  if (!base) return "skipped";

  const headers: Record<string, string> =
    meta.authStyle === "x-api-key"
      ? { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }
      : { Authorization: `Bearer ${apiKey}` };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${base.replace(/\/$/, "")}/models`, {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.ok) return "ok";
    if (res.status === 401 || res.status === 403) return "auth_error";
    return "network_error";
  } catch {
    return "network_error";
  }
}
