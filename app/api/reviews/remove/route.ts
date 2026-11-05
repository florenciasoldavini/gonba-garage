import { alertPage as page, alertPageButton } from '@/lib/alerts/page';
import { expireHomeReviews } from '@/lib/reviews/cache';
import { parseReviewRemovalToken } from '@/lib/reviews/removal';
import { deleteReview } from '@/lib/reviews/store';

export const runtime = 'nodejs';

function readToken(request: Request) {
  const token = new URL(request.url).searchParams.get('token') || '';
  try {
    return parseReviewRemovalToken(token);
  } catch {
    return null;
  }
}
const invalidLink = () => page('Enlace no válido', '<p>No pudimos validar este enlace.</p>', 400);

// Email security scanners may follow GET links. Only a deliberate POST removes the review.
export async function GET(request: Request) {
  if (!readToken(request)) return invalidLink();
  return page(
    'Retirar opinión',
    `<p>La opinión dejará de mostrarse en el sitio y se borrará. No se puede deshacer.</p>${alertPageButton('Retirar esta opinión')}`,
  );
}
export async function POST(request: Request) {
  const token = readToken(request);
  if (!token) return invalidLink();
  try {
    await deleteReview(token.id);
    expireHomeReviews();
    return page('Opinión retirada', '<p>Ya no se muestra en el sitio.</p>');
  } catch {
    return page('No pudimos retirar la opinión', '<p>Volvé a intentarlo en unos minutos.</p>', 503);
  }
}
