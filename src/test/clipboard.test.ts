import { describe, expect, it } from 'vitest';
import { clipboardImages, MAX_IMAGE_BYTES, validateClipboardImage } from '../services/clipboard';
describe('clipboard validation', () => {
  it('accepts supported formats and rejects oversize, empty and unsupported files', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp'])
      expect(validateClipboardImage({ type, size: 100 })).toBeNull();
    expect(validateClipboardImage({ type: 'image/png', size: MAX_IMAGE_BYTES })).toBeNull();
    expect(validateClipboardImage({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 })).toMatch(
      /15 MiB/,
    );
    expect(validateClipboardImage({ type: 'image/gif', size: 100 })).toMatch(/PNG/);
    expect(validateClipboardImage({ type: 'image/png', size: 0 })).not.toBeNull();
  });
  it('extracts multiple image files from HTML clipboard items without double counting', () => {
    const a = new File(['a'], 'a.png', { type: 'image/png' }),
      b = new File(['b'], 'b.jpg', { type: 'image/jpeg' });
    const data = {
      items: [
        { kind: 'string', type: 'text/html' },
        ...[a, b].map((f) => ({ kind: 'file', type: f.type, getAsFile: () => f })),
      ],
      files: [a, b],
    } as unknown as DataTransfer;
    expect(clipboardImages(data)).toEqual([a, b]);
    expect(clipboardImages({ items: [], files: [a] } as unknown as DataTransfer)).toEqual([a]);
    expect(
      clipboardImages({
        items: [{ kind: 'string', type: 'text/plain' }],
        files: [],
      } as unknown as DataTransfer),
    ).toEqual([]);
  });
});
