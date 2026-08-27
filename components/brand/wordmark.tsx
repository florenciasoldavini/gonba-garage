import Link from 'next/link';

type WordmarkProps = {
  href?: string;
  className?: string;
};

export function Wordmark({ href = '/', className = '' }: WordmarkProps) {
  return (
    <Link
      className={`wordmark${className ? ` ${className}` : ''}`}
      href={href}
      aria-label="Gonba's Garage, inicio"
    >
      GONBA&apos;S <span>GARAGE</span>
    </Link>
  );
}
