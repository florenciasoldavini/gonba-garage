import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default async function AppleIcon() {
  const icon = await readFile(join(process.cwd(), 'public/brand/gonba-garage-apple-icon.png'));

  return new Response(icon, { headers: { 'Content-Type': contentType } });
}
