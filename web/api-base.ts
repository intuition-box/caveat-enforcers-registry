const HOSTED_REGISTRY_API = "https://caveat-enforcers-registry.onrender.com";

export function resolveRegistryApiBase(
  configuredBase: string | undefined,
  development: boolean,
): string {
  const configured = (configuredBase ?? "").trim();
  if (configured) return configured.replace(/\/$/, "");
  return development ? "" : HOSTED_REGISTRY_API;
}
