import { WHATSAPP_URL } from '@/constants/contact';

export function getWhatsAppUrl(message?: string) {
  return message ? `${WHATSAPP_URL}?text=${encodeURIComponent(message)}` : WHATSAPP_URL;
}
