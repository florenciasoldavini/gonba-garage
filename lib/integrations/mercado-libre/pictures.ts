/** Use Mercado Libre's full-size (F) variant instead of its 500px (O) variant. */
export function fullSizeMercadoLibreImageUrl(value?: string): string | null {
  if (!value) return null;
  const secure = value.replace(/^http:\/\//, 'https://');

  try {
    const url = new URL(secure);
    // Leave placeholders, thumbnails and URLs from other hosts unchanged.
    if (url.hostname === 'http2.mlstatic.com'
      && /^\/D_(?:NQ_NP_)?[\w-]+-O\.(?:jpe?g|webp|png)$/i.test(url.pathname)) {
      url.pathname = url.pathname.replace(/-O\./i, '-F.');
      return url.toString();
    }
  } catch {
    // Local fallback images are relative paths.
  }

  return secure;
}
