import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ComponentProps } from 'react';

export type ButtonVariant = 'accent' | 'glass' | 'dark' | 'ghost';

const variantClassNames: Record<ButtonVariant, string> = {
  accent: 'button-accent',
  glass: 'button-glass',
  dark: 'button-dark',
  ghost: 'button-ghost',
};

function getButtonClassName(variant: ButtonVariant, className?: string) {
  return ['button', variantClassNames[variant], className].filter(Boolean).join(' ');
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function Button({ className, variant = 'accent', ...props }: ButtonProps) {
  return <button className={getButtonClassName(variant, className)} {...props} />;
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
};

export function ButtonLink({ className, variant = 'accent', ...props }: ButtonLinkProps) {
  return <Link className={getButtonClassName(variant, className)} {...props} />;
}

type ButtonAnchorProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant;
};

export function ButtonAnchor({ className, variant = 'accent', ...props }: ButtonAnchorProps) {
  return <a className={getButtonClassName(variant, className)} {...props} />;
}
