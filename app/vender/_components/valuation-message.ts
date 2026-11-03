import { getWhatsAppUrl } from '@/lib/contact';

export type ValuationDetail = {
  label: string;
  value: string;
};

function getField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export function getValuationDetails(formData: FormData): ValuationDetail[] {
  const mileage = getField(formData, 'mileage');

  return [
    {
      label: 'Vehículo',
      value: ['make', 'model', 'version']
        .map(field => getField(formData, field))
        .filter(Boolean)
        .join(' '),
    },
    { label: 'Año', value: getField(formData, 'year') },
    { label: 'Color', value: getField(formData, 'color') },
    { label: 'Kilometraje', value: mileage ? `${Number(mileage).toLocaleString('es-AR')} km` : '' },
    { label: 'Estado general', value: getField(formData, 'condition') },
    { label: 'Comentarios', value: getField(formData, 'notes') },
  ].filter(({ value }) => value);
}

export function buildValuationMessage(formData: FormData) {
  const name = getField(formData, 'name');
  const details = getValuationDetails(formData).map(({ label, value }) => `${label}: ${value}`);

  return [name ? `Hola, soy ${name}. Quiero tasar mi auto:` : 'Hola, quiero tasar mi auto:', details.join('\n')].join(
    '\n\n',
  );
}

export function getValuationWhatsAppUrl(formData: FormData) {
  return getWhatsAppUrl(buildValuationMessage(formData));
}
