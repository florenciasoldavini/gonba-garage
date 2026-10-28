import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const policy = {};
const compiled = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
new Function('exports', compiled('../features/vehicles/presentation/mercado-libre-attribute-policy.ts'))(policy);
const presentation = {};
new Function('exports', 'require', compiled('../features/vehicles/presentation/public-attributes.ts'))(presentation, id => {
  assert.equal(id, './mercado-libre-attribute-policy');
  return policy;
});
const { getVehicleAttributeRule, VEHICLE_ATTRIBUTE_POLICY_GROUPS, VEHICLE_ATTRIBUTE_SECTIONS } = policy;
const { publicVehicleAttributes, groupPublicVehicleAttributes, vehicleAttributeDisplayRule } = presentation;
const snapshot = JSON.parse(readFileSync(new URL('./fixtures/mercado-libre-mla1744-attributes.json', import.meta.url), 'utf8'));
assert.equal(snapshot.attributes.length, 322);
assert.equal(new Set(snapshot.attributes.map(a => a.id)).size, 322);

const configuredIds = VEHICLE_ATTRIBUTE_POLICY_GROUPS.flatMap(group => group.ids);
assert.equal(new Set(configuredIds).size, configuredIds.length, 'Each ID must have exactly one explicit policy');
for (const attribute of snapshot.attributes) {
  const rule = getVehicleAttributeRule(attribute.id);
  assert.ok(rule, `Official attribute without a decision: ${attribute.id} (${attribute.name})`);
  if (rule.action === 'show') {
    assert.ok(rule.section === 'general' || VEHICLE_ATTRIBUTE_SECTIONS.some(section => section.id === rule.section));
  } else {
    assert.ok(rule.reason, `Exclusion needs an explicit reason: ${attribute.id}`);
  }
}

// Use every official ID to prove that visible fields are partitioned once, and
// excluded fields never leak through grouping, even if called with unfiltered data.
const attrs = snapshot.attributes.map(attribute => Object.freeze({ ...attribute, value_name: 'No' }));
Object.freeze(attrs);
const publicAttrs = publicVehicleAttributes(attrs, '');
const { primary, groups } = groupPublicVehicleAttributes(attrs);
const rendered = [...primary, ...groups.flatMap(group => group.attributes)];
assert.equal(new Set(rendered.map(a => a.id)).size, rendered.length);
assert.deepEqual(rendered.map(a => a.id).sort(), publicAttrs.map(a => a.id).sort());
assert.ok(rendered.every(attribute => attribute.value_name === 'No'));
assert.ok(rendered.every(attribute => attrs.includes(attribute)), 'Keep original values/units and objects');
assert.ok(groups.every(group => group.attributes.length > 0));
assert.ok(!groups.some(group => /historial|antecedentes|venta|Datos de la unidad/i.test(group.title)));

const expectedSections = {
  safety: ['HAS_RAIN_SENSOR', 'HAS_CURTAIN_AIRBAG', 'HAS_ISOFIX', 'HAS_REAR_WINDOW_DEFOGGER', 'WITH_BACKUP_CAMERA', 'WITH_LANE_CHANGING_SENSOR'],
  comfort: ['HAS_CLIMATE_CONTROL', 'HAS_USB', 'HAS_CENTRAL_POWER_DOOR_LOCKS', 'HAS_ELECTRIC_SEATS', 'HAS_AUTOPILOT'],
  mechanics: ['BATTERY_TYPE', 'BATTERY_CAPACITY', 'CHARGE_TIME', 'CHARGER_TYPE', 'CARS_BATTERY_AUTONOMY', 'BRAKES'],
  dimensions: ['LUGGAGE_CAPACITY', 'PASSENGER_CAPACITY', 'FUEL_CAPACITY'],
  general: ['BRAND', 'MODEL', 'SINGLE_OWNER', 'DOORS', 'VEHICLE_BODY_TYPE'],
};
for (const [section, ids] of Object.entries(expectedSections)) {
  for (const id of ids) assert.deepEqual(getVehicleAttributeRule(id), { action: 'show', section });
}
for (const group of VEHICLE_ATTRIBUTE_POLICY_GROUPS.filter(group => group.rule.action === 'exclude')) {
  for (const id of group.ids) {
    const attribute = { id, name: id, value_name: 'Sí' };
    assert.deepEqual(vehicleAttributeDisplayRule(attribute, ''), group.rule);
    assert.deepEqual(publicVehicleAttributes([attribute], ''), []);
    assert.deepEqual(groupPublicVehicleAttributes([attribute]), { primary: [], groups: [] });
  }
}
assert.deepEqual(getVehicleAttributeRule('HAS_VEHICLE_INSPECTION'), { action: 'exclude', reason: 'history_disabled' });
assert.deepEqual(getVehicleAttributeRule('SALE_WITH_EXCHANGE'), { action: 'exclude', reason: 'commercial_terms' });
assert.deepEqual(getVehicleAttributeRule('YEAR_WARRANTY'), { action: 'exclude', reason: 'unconfirmed_warranty' });

for (const id of ['TRIM', 'SHORT_VERSION']) {
  const attribute = Object.freeze({ id, name: 'Versión', value_name: 'GR-S' });
  assert.deepEqual(vehicleAttributeDisplayRule(attribute, 'Toyota SW4 GR S'), { action: 'exclude', reason: 'duplicate_in_title' });
  assert.equal(vehicleAttributeDisplayRule(attribute, 'Toyota SW4').action, 'show');
}
const unknown = Object.freeze({ id: 'FUTURE_NEW_ATTRIBUTE', name: 'Campo futuro', value_name: 'Dato original' });
assert.deepEqual(vehicleAttributeDisplayRule(unknown, ''), { action: 'exclude', reason: 'unmapped' });
assert.deepEqual(publicVehicleAttributes([unknown], ''), []);
assert.deepEqual(groupPublicVehicleAttributes([unknown]), { primary: [], groups: [] });
assert.equal(unknown.value_name, 'Dato original');

if (process.argv.includes('--live')) {
  const response = await fetch(snapshot.source, { signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, 200, 'Unable to compare the live category schema');
  const live = await response.json();
  const missing = live.filter(attribute => !getVehicleAttributeRule(attribute.id));
  assert.deepEqual(missing.map(a => ({ id: a.id, name: a.name })), [], 'New provider attributes need review and an explicit policy');
  console.log(`Live schema: ${live.length} attributes covered.`);
}
console.log(`Attribute policy: all 322 official IDs covered; ${publicAttrs.length} displayable and ${322 - publicAttrs.length} intentionally excluded. Sections, raw values, unknown IDs and duplicate titles passed.`);
