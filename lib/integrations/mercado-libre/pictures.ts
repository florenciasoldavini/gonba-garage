/** Use Mercado Libre's full-size (F) variant instead of its 500px (O) variant. */
export function fullSizeMercadoLibreImageUrl(value?: string): string | null {
  if (!value) return null;
  const secure = value.replace(/^http:\/\//, 'https://');

  try {
    const url = new URL(secure);
    // Leave placeholders, thumbnails and URLs from other hosts unchanged.
    if (url.hostname === 'http2.mlstatic.com' && /^\/D_(?:NQ_NP_)?[\w-]+-O\.(?:jpe?g|webp|png)$/i.test(url.pathname)) {
      url.pathname = url.pathname.replace(/-O\./i, '-F.');
      return url.toString();
    }
  } catch {
    // Local fallback images are relative paths.
  }

  return secure;
}

/**
 * Mercado Libre's own WebP of a full-size (F) photo: the same pixels as its JPEG at about a third of
 * the size. Null for any other URL, which is shown as is.
 */
export function mercadoLibreWebpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.hostname === 'http2.mlstatic.com' && /^\/D_(?:NQ_NP_)?[\w-]+-F\.(?:jpe?g|png)$/i.test(url.pathname)) {
      url.pathname = url.pathname.replace(/\.(?:jpe?g|png)$/i, '.webp');
      return url.toString();
    }
  } catch {
    // Local fallback images are relative paths.
  }
  return null;
}
