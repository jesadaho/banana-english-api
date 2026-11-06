import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import sharp from 'sharp';
import { optimizeEventImage } from './event-image';

describe('optimizeEventImage', () => {
  it('encodes banners as smaller webp under the max width', async () => {
    const input = await sharp({
      create: {
        width: 2172,
        height: 724,
        channels: 3,
        background: { r: 255, g: 180, b: 40 },
      },
    })
      .png()
      .toBuffer();
    const out = await optimizeEventImage(input, 'banner');
    assert.equal(out.mimetype, 'image/webp');
    assert.equal(out.ext, 'webp');
    const meta = await sharp(out.buffer).metadata();
    assert.equal(meta.format, 'webp');
    assert.ok((meta.width ?? 0) <= 1200);
    assert.ok(out.buffer.length < input.length);
  });

  it('keeps avatar edges within 512px', async () => {
    const input = await sharp({
      create: {
        width: 1024,
        height: 1024,
        channels: 3,
        background: { r: 80, g: 120, b: 200 },
      },
    })
      .png()
      .toBuffer();
    const out = await optimizeEventImage(input, 'avatar');
    const meta = await sharp(out.buffer).metadata();
    assert.equal(meta.format, 'webp');
    assert.ok((meta.width ?? 0) <= 512);
    assert.ok((meta.height ?? 0) <= 512);
  });
});
