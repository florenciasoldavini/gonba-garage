import type { Metadata } from 'next';

export const SITE_NAME = "Gonba's Garage";
export const DEFAULT_SOCIAL_IMAGE = '/gonba-garage-social-preview.png';

type PageMetadataOptions = {
  title: string;
  description: string;
  path: string;
  image?: string;
  imageAlt?: string;
};

export function createPageMetadata({
  title,
  description,
  path,
  image = DEFAULT_SOCIAL_IMAGE,
  imageAlt = `${SITE_NAME} — Autos usados seleccionados`,
}: PageMetadataOptions): Metadata {
  const isDefaultSocialImage = image === DEFAULT_SOCIAL_IMAGE;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE_NAME,
      type: 'website',
      locale: 'es_AR',
      images: [
        {
          url: image,
          alt: imageAlt,
          ...(isDefaultSocialImage ? { width: 1200, height: 630 } : {}),
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [{ url: image, alt: imageAlt }],
    },
  };
}
