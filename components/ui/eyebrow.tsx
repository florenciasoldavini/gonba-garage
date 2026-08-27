import type { HTMLAttributes } from 'react';

type EyebrowProps = HTMLAttributes<HTMLParagraphElement>;

export function Eyebrow({ children, className, ...props }: EyebrowProps) {
  return (
    <p className={['eyebrow', className].filter(Boolean).join(' ')} {...props}>
      <span aria-hidden="true" />
      {children}
    </p>
  );
}
