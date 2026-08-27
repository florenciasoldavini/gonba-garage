import { WHATSAPP_NUMBER } from '@/constants/contact';

export function getWhatsAppUrl(message?: string) {
  const baseUrl = `https://wa.me/${WHATSAPP_NUMBER}`;

  return message ? `${baseUrl}?text=${encodeURIComponent(message)}` : baseUrl;
}
