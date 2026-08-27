const fallbackSiteUrl = 'https://gonba-garage.vercel.app';

export function getSiteUrl() {
  return new URL(process.env.NEXT_PUBLIC_SITE_URL || fallbackSiteUrl);
}
