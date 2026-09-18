export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const supported = new Set(['image/png', 'image/jpeg', 'image/webp']);
export function validateClipboardImage(file: Pick<File, 'size' | 'type'>): string | null {
  if (!supported.has(file.type)) return 'Use PNG, JPEG, or WebP images.';
  if (!file.size || file.size > MAX_IMAGE_BYTES) return 'Images must be between 1 byte and 15 MiB.';
  return null;
}
export function clipboardImages(data: DataTransfer): File[] {
  const items = Array.from(data.items ?? [])
    .filter((i) => i.kind === 'file' && i.type.startsWith('image/'))
    .map((i) => i.getAsFile())
    .filter((f): f is File => f !== null);
  return items.length
    ? items
    : Array.from(data.files ?? []).filter((f) => f.type.startsWith('image/'));
}
