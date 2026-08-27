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
      aria-label="Gonba Garage, inicio"
    >
      GONBA <span>GARAGE</span>
    </Link>
  );
}
