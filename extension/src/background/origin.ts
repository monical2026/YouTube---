export function matchesExtensionPage(
  url: string | undefined,
  extensionId: string,
  path: string,
): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'chrome-extension:' &&
      parsed.hostname === extensionId &&
      parsed.pathname === `/${path}`
    );
  } catch {
    return false;
  }
}
