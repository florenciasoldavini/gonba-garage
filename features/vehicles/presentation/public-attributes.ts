import type { MercadoLibreAttribute } from '@/lib/integrations/mercado-libre/types';
import {
  getVehicleAttributeRule,
  VEHICLE_ATTRIBUTE_POLICY_GROUPS,
  VEHICLE_ATTRIBUTE_SECTIONS,
  type VehicleAttributeRule,
} from './mercado-libre-attribute-policy';

function normalizedWords(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function vehicleAttributeDisplayRule(attribute: MercadoLibreAttribute, title: string):
  VehicleAttributeRule | { action: 'exclude'; reason: 'unmapped' | 'duplicate_in_title' } {
  const rule = getVehicleAttributeRule(attribute.id);
  if (!rule) return { action: 'exclude', reason: 'unmapped' };
  if (rule.action === 'exclude') return rule;
  if (attribute.id === 'TRIM' || attribute.id === 'SHORT_VERSION') {
    const value = attribute.value_name
      ?? attribute.values?.map(candidate => candidate.name).filter(Boolean).join(' ')
      ?? '';
    const versionWords = normalizedWords(value);
    if (versionWords && ` ${normalizedWords(title)} `.includes(` ${versionWords} `)) {
      return { action: 'exclude', reason: 'duplicate_in_title' };
    }
  }
  return rule;
}

/** Filter only the public view; never change the original publication or its attributes. */
export function publicVehicleAttributes(attributes: MercadoLibreAttribute[], title: string) {
  return attributes.filter(attribute => vehicleAttributeDisplayRule(attribute, title).action === 'show');
}

const PRIMARY_ATTRIBUTE_IDS = VEHICLE_ATTRIBUTE_POLICY_GROUPS.find(
  group => group.rule.action === 'show' && group.rule.section === 'general',
)?.ids ?? [];

/** Every displayed field has an explicit section. There is no catch-all UI group. */
export function groupPublicVehicleAttributes(attributes: MercadoLibreAttribute[]) {
  const primary = PRIMARY_ATTRIBUTE_IDS.flatMap(id => attributes.filter(attribute => attribute.id === id));
  const groups = VEHICLE_ATTRIBUTE_SECTIONS.map(group => ({ ...group, attributes: [] as MercadoLibreAttribute[] }));
  for (const attribute of attributes) {
    const rule = getVehicleAttributeRule(attribute.id);
    if (rule?.action !== 'show' || rule.section === 'general') continue;
    groups.find(group => group.id === rule.section)?.attributes.push(attribute);
  }
  return { primary, groups: groups.filter(group => group.attributes.length > 0) };
}
