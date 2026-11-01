import Image from 'next/image';
import Link from 'next/link';

const LOGO_MARK_SRC = '/brand/gonba-garage-logo-mark.svg';
const LOGO_MARK_WIDTH = 234;
const LOGO_MARK_HEIGHT = 171;

type WordmarkProps = {
  href?: string;
  className?: string;
  preload?: boolean;
};

export function Wordmark({ href = '/', className = '', preload = false }: WordmarkProps) {
  return (
    <Link
      className={`wordmark${className ? ` ${className}` : ''}`}
      href={href}
      aria-label="Gonba's Garage, inicio"
    >
      <Image
        src={LOGO_MARK_SRC}
        alt=""
        width={LOGO_MARK_WIDTH}
        height={LOGO_MARK_HEIGHT}
        preload={preload}
        unoptimized
      />
    </Link>
  );
}
