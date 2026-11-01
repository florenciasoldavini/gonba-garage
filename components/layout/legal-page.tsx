import type { ReactNode } from 'react';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { Eyebrow } from '@/components/ui/eyebrow';

type LegalPageProps = {
  children: ReactNode;
  id: string;
  intro: string;
  title: string;
  updatedAt: string;
};

const updatedFormat = new Intl.DateTimeFormat('es-AR', { dateStyle: 'long', timeZone: 'UTC' });

/** Privacy policy and terms: a heading block and one reading column of short sections. */
export function LegalPage({ children, id, intro, title, updatedAt }: LegalPageProps) {
  return (
    <div className="legal-page" id={id}>
      <SiteHeader />

      <main className="section-shell legal-layout">
        <article aria-labelledby={`${id}-title`}>
          <header className="legal-heading">
            <Eyebrow>Legal</Eyebrow>
            <h1 id={`${id}-title`}>{title}</h1>
            <p>{intro}</p>
            <p className="legal-updated">
              Última actualización: <time dateTime={updatedAt}>{updatedFormat.format(new Date(updatedAt))}</time>
            </p>
          </header>
          <div className="legal-content">{children}</div>
        </article>
      </main>

      <SiteFooter topHref={`#${id}`} />
    </div>
  );
}
