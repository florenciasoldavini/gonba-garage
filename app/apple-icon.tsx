import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'center',
          background: '#080a09',
          border: '6px solid #dcff00',
          borderRadius: 38,
          color: '#dcff00',
          display: 'flex',
          fontFamily: 'Arial, sans-serif',
          fontSize: 72,
          fontWeight: 900,
          height: '100%',
          justifyContent: 'center',
          letterSpacing: -10,
          paddingRight: 10,
          width: '100%',
        }}
      >
        GG
      </div>
    ),
    size,
  );
}
