import { ChevronDown } from 'lucide-react';
import type { MercadoLibreAttribute } from '@/lib/integrations/mercado-libre/types';
import { groupPublicVehicleAttributes } from '@/features/vehicles/presentation/public-attributes';
import { SpecificationAccordionMotion } from './specification-accordion-motion';

function AttributeList({ attributes }: { attributes: MercadoLibreAttribute[] }) {
  return <dl>{attributes.map(attribute => {
    const value = attribute.value_name
      ?? attribute.values?.map(candidate => candidate.name).filter(Boolean).join(', ')
      ?? 'No especificado';
    return <div key={attribute.id}><dt>{attribute.name}</dt><dd>{value || 'No especificado'}</dd></div>;
  })}</dl>;
}

export function VehicleSpecificationGroups({ attributes }: { attributes: MercadoLibreAttribute[] }) {
  const { primary, groups } = groupPublicVehicleAttributes(attributes);
  const sections = [
    ...(primary.length ? [{ id: 'general', title: 'Información general', attributes: primary }] : []),
    ...groups,
  ];
  return <SpecificationAccordionMotion contentKey={sections.map(group => `${group.id}:${group.attributes.map(attribute => attribute.id).join(',')}`).join('|')}>
    {sections.map(group => <details key={group.id} name="vehicle-specifications" open={group.id === 'general'}>
      <summary><span>{group.title}</span><ChevronDown size={17} strokeWidth={1.8} aria-hidden="true" /></summary>
      <div className="detail-specs-panel"><AttributeList attributes={group.attributes} /></div>
    </details>)}
  </SpecificationAccordionMotion>;
}
