/** Loose shape check shared by the alert forms and the alert APIs, so both reject the same addresses. */
export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Copy for an email field the form should not send, or null when it looks deliverable. */
export function getEmailError(value: string) {
  const email = value.trim();
  if (!email) return 'Ingresá tu email.';
  if (email.length > 320 || !emailPattern.test(email)) return 'Revisá el email. Tiene que ser como nombre@gmail.com.';
  return null;
}
