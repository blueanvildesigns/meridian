// Hands the browser a file made on the page, as a download: a `blob:` URL on a link with
// `download`. Allowed by the same-origin CSP (M0-14), checked on every engine and on a preview
// channel (M8-13). Throws if the browser can't make the file; the caller shows the error (M9-8).

/** How long the blob URL lives: the download has started long before. */
const REVOKE_MS = 60_000;

export function saveFile(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, REVOKE_MS);
}
