import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { mercadoLibreJpegUrl, mercadoLibreWebpUrl } from '@/lib/integrations/mercado-libre/pictures';

describe('mercadoLibreWebpUrl', () => {
  it("points a full-size JPEG or PNG photo at Mercado Libre's own WebP", () => {
    assert.equal(
      mercadoLibreWebpUrl('https://http2.mlstatic.com/D_985717-MLA111679209460_062026-F.jpg'),
      'https://http2.mlstatic.com/D_985717-MLA111679209460_062026-F.webp',
    );
    assert.equal(
      mercadoLibreWebpUrl('https://http2.mlstatic.com/D_NQ_NP_985717-MLA111679209460_062026-F.png'),
      'https://http2.mlstatic.com/D_NQ_NP_985717-MLA111679209460_062026-F.webp',
    );
  });

  it('leaves photos that are already WebP, smaller variants, other hosts and local files alone', () => {
    assert.equal(mercadoLibreWebpUrl('https://http2.mlstatic.com/D_985717-MLA111679209460_062026-F.webp'), null);
    assert.equal(mercadoLibreWebpUrl('https://http2.mlstatic.com/D_985717-MLA111679209460_062026-O.jpg'), null);
    assert.equal(mercadoLibreWebpUrl('https://example.com/D_985717-MLA111679209460_062026-F.jpg'), null);
    assert.equal(mercadoLibreWebpUrl('/vehicle-photo-placeholder.jpg'), null);
  });
});

describe('mercadoLibreJpegUrl', () => {
  it("points a full-size WebP photo at Mercado Libre's own JPEG", () => {
    assert.equal(
      mercadoLibreJpegUrl('https://http2.mlstatic.com/D_985717-MLA111679209460_062026-F.webp'),
      'https://http2.mlstatic.com/D_985717-MLA111679209460_062026-F.jpg',
    );
  });

  it('leaves photos that are already JPEG, smaller variants, other hosts and local files alone', () => {
    assert.equal(mercadoLibreJpegUrl('https://http2.mlstatic.com/D_985717-MLA111679209460_062026-F.jpg'), null);
    assert.equal(mercadoLibreJpegUrl('https://http2.mlstatic.com/D_985717-MLA111679209460_062026-O.webp'), null);
    assert.equal(mercadoLibreJpegUrl('https://example.com/D_985717-MLA111679209460_062026-F.webp'), null);
    assert.equal(mercadoLibreJpegUrl('/vehicle-photo-placeholder.jpg'), null);
  });
});
