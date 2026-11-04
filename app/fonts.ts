import localFont from 'next/font/local';

export const geistSans = localFont({
  src: [
    {
      path: './fonts/geist-sans-variable.ttf',
      weight: '100 900',
      style: 'normal',
    },
    {
      path: './fonts/geist-sans-variable-italic.ttf',
      weight: '100 900',
      style: 'italic',
    },
  ],
  variable: '--font-geist-sans',
  display: 'swap',
  fallback: ['Arial', 'Helvetica', 'sans-serif'],
});

export const geistMono = localFont({
  src: [
    {
      path: './fonts/geist-mono-variable.ttf',
      weight: '100 900',
      style: 'normal',
    },
    {
      path: './fonts/geist-mono-variable-italic.ttf',
      weight: '100 900',
      style: 'italic',
    },
  ],
  variable: '--font-geist-mono',
  display: 'swap',
  fallback: ['monospace'],
});
