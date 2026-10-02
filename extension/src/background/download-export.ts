const marker = ';youtube-note-filename=';
export function exportDownloadUrl(dataUrl: string, filename: string) {
  return dataUrl.replace(
    ';base64,',
    `${marker}${encodeURIComponent(filename)};base64,`,
  );
}
// Use our original title, never Chrome's provisional name (which can be "download").
export function exportDownloadFilename(
  item: Pick<chrome.downloads.DownloadItem, 'byExtensionId' | 'url'>,
  extensionId: string,
): string | undefined {
  if (item.byExtensionId !== extensionId || !item.url.startsWith('data:'))
    return;
  const at = item.url.lastIndexOf(marker);
  if (at < 0) return;
  try {
    const end = item.url.indexOf(';base64,', at);
    if (end < 0) return;
    const name = decodeURIComponent(item.url.slice(at + marker.length, end));
    if (
      !/^[^/\\]{1,200}\.(md|txt|docx)$/.test(name) ||
      [...name].some((char) => char.charCodeAt(0) < 32)
    )
      return;
    return name;
  } catch {
    return;
  }
}
