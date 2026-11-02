import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Fixtures here are test data only; the application never imports them.
const compiled = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const cleanup = {};
new Function('exports', compiled('../features/vehicles/presentation/listing-cleanup.ts'))(cleanup);
const policy = {};
new Function('exports', compiled('../features/vehicles/presentation/mercado-libre-attribute-policy.ts'))(policy);
const presentation = {};
new Function('exports', 'require', compiled('../features/vehicles/presentation/public-attributes.ts'))(presentation, id => (
  id === './listing-cleanup' ? cleanup : policy
));
const { cleanCatalogVehicle, cleanVehicleDescription, formatVehicleVersion, pickVehicleHighlights, unbreakableVersionSegments, MAX_VEHICLE_HIGHLIGHTS } = cleanup;
const { formatVehicleAttributeValue, vehicleAttributeDisplayRule } = presentation;

// Versions: casing, abbreviations, power, gearboxes and seat or door counts.
for (const [raw, clean] of [
  ['1.4 Lounge 105cv At', '1.4 Lounge 105 CV AT'],
  ['2.8 Tdi Gr-s 4x4 7as 6at', '2.8 TDI GR-S 4x4 · 7 asientos · 6AT'],
  ['1.4 35tfsi Sportback 150 Cv', '1.4 35 TFSI Sportback 150 CV'],
  ['1.6 Vti 115 Feel', '1.6 VTi 115 Feel'],
  ['2.0 Ecoboost 4Wd Badlands At8', '2.0 EcoBoost 4WD Badlands 8AT'],
  ['3.0 Cd 4X4 Limited + At 250Cv', '3.0 CD 4x4 Limited + AT 250 CV'],
  ['2.0 F56 Look Jcw 192Cv 3P At', '2.0 F56 Look JCW 192 CV · 3 puertas · AT'],
  ['3.6 Limited 286hp Techo + Llantas 18', '3.6 Limited 286 HP Techo + Llantas 18'],
  ['2.5 135i Coupe Sportive 306cv', '2.5 135i Coupe Sportive 306 CV'],
  ['1.6 Bic Pack Plus', '1.6 Bic Pack Plus'],
  ['', ''],
]) assert.equal(formatVehicleVersion(raw), clean, raw);
assert.equal(formatVehicleVersion(formatVehicleVersion('2.8 Tdi Gr-s 4x4 7as 6at')), '2.8 TDI GR-S 4x4 · 7 asientos · 6AT', 'Cleaning twice changes nothing');
assert.equal(unbreakableVersionSegments('2.8 TDI GR-S 4x4 · 7 asientos · 6AT 204 CV'), '2.8 TDI GR-\u2060S 4x4\u00a0· 7\u00a0asientos\u00a0· 6AT 204\u00a0CV');

// Descriptions: verbatim except for the trailing sign-off, with either apostrophe.
const body = 'Único dueño.\n\nSe puede ver por Villa Pueyrredon, CABA.';
for (const signOff of ["Gonba's Garage\nCompra - venta - consignación", 'Gonba’s Garage \nCompra - venta - consignación', 'Gonba’s Garage\nCompra – venta – consignacion.']) {
  assert.equal(cleanVehicleDescription(`${body} \n\n${signOff}`), body, signOff);
}
assert.equal(cleanVehicleDescription(`${body}\n\nNo financio.`), `${body}\n\nNo financio.`, 'Other endings stay');
assert.equal(cleanVehicleDescription(`Visitá Gonba's Garage.\n${body}`), `Visitá Gonba's Garage.\n${body}`, 'Only the trailing sign-off goes');

// Highlights: distinguishing attributes first, common equipment last, never more than six.
const yes = id => ({ id, name: id, value_name: 'Sí' });
const common = ['HAS_ABS_BRAKES', 'HAS_AIR_CONDITIONING', 'HAS_ALLOY_WHEELS', 'HAS_BLUETOOTH', 'HAS_AUTOPILOT', 'HAS_PASSENGER_AIRBAG'].map(yes);
const distinct = [yes('SINGLE_OWNER'), { id: 'TRACTION_CONTROL', value_name: '4x4' }, { id: 'PASSENGER_CAPACITY', value_name: '7' }, yes('HAS_LEATHER_UPHOLSTERY')];
assert.deepEqual(pickVehicleHighlights([...common, ...distinct]),
  ['Único dueño', 'Tracción 4x4', '7 asientos', 'Tapizado de cuero', 'Piloto automático', 'Bluetooth']);
assert.equal(pickVehicleHighlights([...common, ...distinct]).length, MAX_VEHICLE_HIGHLIGHTS);
assert.deepEqual(pickVehicleHighlights([{ id: 'SINGLE_OWNER', value_name: 'No' }, yes('HAS_PASSENGER_AIRBAG')]), [], 'No and airbags never show');
assert.deepEqual(pickVehicleHighlights([yes('HAS_PARKING_SENSOR'), yes('HAS_REAR_PARKING_SENSOR')]), ['Sensor de estacionamiento'], 'The rear sensor is not repeated');

const vehicle = { version: '1.4 Lounge 105cv At', description: `${body}\n\nGonba’s Garage\nCompra - venta - consignación`, highlights: ['Frenos ABS'] };
assert.deepEqual(cleanCatalogVehicle(vehicle), { version: '1.4 Lounge 105 CV AT', description: body, highlights: ['Frenos ABS'] }, 'Without attributes the stored highlights stay');
assert.deepEqual(cleanCatalogVehicle(vehicle, [yes('SINGLE_OWNER')]).highlights, ['Único dueño']);

// Specs: distances use the thousands separator; other values stay as published.
assert.equal(formatVehicleAttributeValue({ id: 'KILOMETERS', value_name: '83000 km' }), '83.000 km');
assert.equal(formatVehicleAttributeValue({ id: 'KILOMETERS', value_name: '9800 km' }), '9.800 km');
assert.equal(formatVehicleAttributeValue({ id: 'ENGINE_DISPLACEMENT', value_name: '1400 cc' }), '1400 cc');
assert.equal(formatVehicleAttributeValue({ id: 'COLOR', values: [{ name: 'Azul' }] }), 'Azul');
// The version attribute still counts as already in the title once the title carries the cleaned version.
assert.deepEqual(vehicleAttributeDisplayRule({ id: 'TRIM', value_name: '1.4 Lounge 105cv At' }, `Fiat 500 ${formatVehicleVersion('1.4 Lounge 105cv At')}`),
  { action: 'exclude', reason: 'duplicate_in_title' });

console.log('Listing cleanup: versions, description sign-off, highlights and spec values passed.');
