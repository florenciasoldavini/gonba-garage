import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import {
  getVehicleAttributeRule,
  VEHICLE_ATTRIBUTE_POLICY_GROUPS,
  VEHICLE_ATTRIBUTE_SECTIONS,
} from '@/features/vehicles/presentation/mercado-libre-attribute-policy';
import {
  groupPublicVehicleAttributes,
  publicVehicleAttributes,
  vehicleAttributeDisplayRule,
  vehicleAttributeLabel,
} from '@/features/vehicles/presentation/public-attributes';
import { vehicleSpecificationLabels } from '@/features/vehicles/presentation/specifications';
import { runtimeImports } from '../helpers/modules.mjs';

const snapshot = JSON.parse(
  readFileSync(new URL('../fixtures/mercado-libre-mla1744-attributes.json', import.meta.url), 'utf8'),
);

describe('vehicle attribute policy', () => {
  it('reads only the policy and the listing cleanup', () => {
    for (const id of runtimeImports('features/vehicles/presentation/public-attributes.ts')) {
      if (id === './listing-cleanup') continue;
      assert.equal(id, './mercado-libre-attribute-policy');
    }
  });

  it('gives every official attribute exactly one explicit decision', () => {
    assert.equal(snapshot.attributes.length, 322);
    assert.equal(new Set(snapshot.attributes.map(a => a.id)).size, 322);
    const configuredIds = VEHICLE_ATTRIBUTE_POLICY_GROUPS.flatMap(group => group.ids);
    assert.equal(new Set(configuredIds).size, configuredIds.length, 'Each ID must have exactly one explicit policy');
    for (const attribute of snapshot.attributes) {
      const rule = getVehicleAttributeRule(attribute.id);
      assert.ok(rule, `Official attribute without a decision: ${attribute.id} (${attribute.name})`);
      if (rule.action === 'show') {
        assert.ok(
          rule.section === 'general' || VEHICLE_ATTRIBUTE_SECTIONS.some(section => section.id === rule.section),
        );
      } else {
        assert.ok(rule.reason, `Exclusion needs an explicit reason: ${attribute.id}`);
      }
    }
  });

  // Use every official ID to prove that visible fields are partitioned once, and
  // excluded fields never leak through grouping, even if called with unfiltered data.
  it('partitions visible fields once and never leaks excluded ones', () => {
    const attrs = snapshot.attributes.map(attribute => Object.freeze({ ...attribute, value_name: 'No' }));
    Object.freeze(attrs);
    const publicAttrs = publicVehicleAttributes(attrs, '');
    const { primary, groups } = groupPublicVehicleAttributes(attrs);
    const rendered = [...primary, ...groups.flatMap(group => group.attributes)];
    assert.equal(new Set(rendered.map(a => a.id)).size, rendered.length);
    assert.deepEqual(rendered.map(a => a.id).sort(), publicAttrs.map(a => a.id).sort());
    assert.ok(rendered.every(attribute => attribute.value_name === 'No'));
    assert.ok(
      rendered.every(attribute => attrs.includes(attribute)),
      'Keep original values/units and objects',
    );
    assert.ok(groups.every(group => group.attributes.length > 0));
    assert.ok(!groups.some(group => /historial|antecedentes|venta|Datos de la unidad/i.test(group.title)));
    console.log(
      `Attribute policy: all 322 official IDs covered; ${publicAttrs.length} displayable and ${322 - publicAttrs.length} intentionally excluded.`,
    );
  });

  it('places attributes in their sections', () => {
    const expectedSections = {
      safety: [
        'HAS_RAIN_SENSOR',
        'HAS_CURTAIN_AIRBAG',
        'HAS_ISOFIX',
        'HAS_REAR_WINDOW_DEFOGGER',
        'WITH_BACKUP_CAMERA',
        'WITH_LANE_CHANGING_SENSOR',
      ],
      comfort: [
        'HAS_CLIMATE_CONTROL',
        'HAS_USB',
        'HAS_CENTRAL_POWER_DOOR_LOCKS',
        'HAS_ELECTRIC_SEATS',
        'HAS_AUTOPILOT',
      ],
      mechanics: ['BATTERY_TYPE', 'BATTERY_CAPACITY', 'CHARGE_TIME', 'CHARGER_TYPE', 'CARS_BATTERY_AUTONOMY', 'BRAKES'],
      dimensions: ['LUGGAGE_CAPACITY', 'PASSENGER_CAPACITY', 'FUEL_CAPACITY'],
      general: ['BRAND', 'MODEL', 'SINGLE_OWNER', 'DOORS', 'VEHICLE_BODY_TYPE'],
    };
    for (const [section, ids] of Object.entries(expectedSections)) {
      for (const id of ids) assert.deepEqual(getVehicleAttributeRule(id), { action: 'show', section });
    }
  });

  it('never displays an excluded attribute', () => {
    for (const group of VEHICLE_ATTRIBUTE_POLICY_GROUPS.filter(group => group.rule.action === 'exclude')) {
      for (const id of group.ids) {
        const attribute = { id, name: id, value_name: 'Sí' };
        assert.deepEqual(vehicleAttributeDisplayRule(attribute, ''), group.rule);
        assert.deepEqual(publicVehicleAttributes([attribute], ''), []);
        assert.deepEqual(groupPublicVehicleAttributes([attribute]), { primary: [], groups: [] });
      }
    }
    assert.deepEqual(getVehicleAttributeRule('HAS_VEHICLE_INSPECTION'), {
      action: 'exclude',
      reason: 'history_disabled',
    });
    assert.deepEqual(getVehicleAttributeRule('SALE_WITH_EXCHANGE'), { action: 'exclude', reason: 'commercial_terms' });
    assert.deepEqual(getVehicleAttributeRule('YEAR_WARRANTY'), { action: 'exclude', reason: 'unconfirmed_warranty' });
  });

  it('hides a version already in the title', () => {
    for (const id of ['TRIM', 'SHORT_VERSION']) {
      const attribute = Object.freeze({ id, name: 'Versión', value_name: 'GR-S' });
      assert.deepEqual(vehicleAttributeDisplayRule(attribute, 'Toyota SW4 GR S'), {
        action: 'exclude',
        reason: 'duplicate_in_title',
      });
      assert.equal(vehicleAttributeDisplayRule(attribute, 'Toyota SW4').action, 'show');
    }
  });

  // Mercado Libre calls the drivetrain "Control de tracción"; its values are Delantera, 4x4 and so on.
  it('labels the drivetrain as the comparison does', () => {
    const drivetrain = Object.freeze({ id: 'TRACTION_CONTROL', name: 'Control de tracción', value_name: '4x4' });
    assert.equal(vehicleAttributeLabel(drivetrain), vehicleSpecificationLabels.traction);
    assert.equal(vehicleAttributeLabel(drivetrain), 'Tracción');
    assert.equal(drivetrain.name, 'Control de tracción', 'The publication keeps its own name');
    assert.equal(
      vehicleAttributeLabel({ id: 'HAS_ASR_TRACTION', name: 'Tracción ASR', value_name: 'Sí' }),
      'Tracción ASR',
      'The safety system keeps its name',
    );
    assert.equal(vehicleAttributeLabel({ id: 'COLOR', name: 'Color', value_name: 'Gris' }), 'Color');
  });

  it('shows the drivetrain once when another attribute already states it', () => {
    const drivetrain = { id: 'TRACTION_CONTROL', name: 'Control de tracción', value_name: '4x4' };
    const legacy = { id: 'DETAILED_MODEL', name: 'Tracción', value_name: '4X4' };
    const { primary } = groupPublicVehicleAttributes([
      drivetrain,
      legacy,
      { id: 'COLOR', name: 'Color', value_name: 'Gris' },
    ]);
    assert.deepEqual(
      primary.map(attribute => attribute.id),
      ['TRACTION_CONTROL', 'COLOR'],
    );
    const different = { ...legacy, value_name: 'Integral' };
    assert.deepEqual(
      groupPublicVehicleAttributes([drivetrain, different]).primary.map(attribute => attribute.id),
      ['TRACTION_CONTROL', 'DETAILED_MODEL'],
      'A different value still shows',
    );
  });

  it('excludes unknown attributes without changing them', () => {
    const unknown = Object.freeze({ id: 'FUTURE_NEW_ATTRIBUTE', name: 'Campo futuro', value_name: 'Dato original' });
    assert.deepEqual(vehicleAttributeDisplayRule(unknown, ''), { action: 'exclude', reason: 'unmapped' });
    assert.deepEqual(publicVehicleAttributes([unknown], ''), []);
    assert.deepEqual(groupPublicVehicleAttributes([unknown]), { primary: [], groups: [] });
    assert.equal(unknown.value_name, 'Dato original');
  });

  // Network check against the public category API: npm run test:live.
  it.runIf(process.env.TEST_LIVE === '1')(
    'covers every attribute of the live category schema',
    async () => {
      const response = await fetch(snapshot.source, { signal: AbortSignal.timeout(30_000) });
      assert.equal(response.status, 200, 'Unable to compare the live category schema');
      const live = await response.json();
      const missing = live.filter(attribute => !getVehicleAttributeRule(attribute.id));
      assert.deepEqual(
        missing.map(a => ({ id: a.id, name: a.name })),
        [],
        'New provider attributes need review and an explicit policy',
      );
      console.log(`Live schema: ${live.length} attributes covered.`);
    },
    60_000,
  );
});
