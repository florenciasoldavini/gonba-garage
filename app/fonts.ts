import localFont from 'next/font/local';

export const geistSans = localFont({
  src: './fonts/geist-sans-variable.woff2',
  weight: '100 900',
  style: 'normal',
  variable: '--font-geist-sans',
  display: 'swap',
  fallback: ['Arial', 'Helvetica', 'sans-serif'],
});

export const geistMono = localFont({
  src: './fonts/geist-mono-variable.woff2',
  weight: '100 900',
  style: 'normal',
  variable: '--font-geist-mono',
  display: 'swap',
  fallback: ['monospace'],
});
