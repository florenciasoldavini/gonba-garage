const fallbackSiteUrl = 'https://gonbagarage.com.ar';

export function getSiteUrl() {
  return new URL(process.env.NEXT_PUBLIC_SITE_URL || fallbackSiteUrl);
}
