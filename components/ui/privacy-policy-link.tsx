import Link from 'next/link';

import { LEGAL_PAGES } from '@/constants/legal';

/** For consent notes inside forms: a new tab keeps what the visitor already typed. */
export function PrivacyPolicyLink() {
  return (
    <Link href={LEGAL_PAGES.privacy.path} target="_blank">
      política de privacidad
    </Link>
  );
}
