'use client';

import { useEffect, useState } from 'react';
import { CarFront } from 'lucide-react';

import { CustomSelect } from '@/components/ui/custom-select';
import { ValuationStepHeading } from './valuation-step-heading';

type CatalogOption = {
  id: string;
  name: string;
  availableYears?: number[];
};

type CatalogState = 'idle' | 'loading' | 'ready' | 'error';

const MANUAL_OPTION = '__manual__';
const manualMakeOption = { value: MANUAL_OPTION, label: 'Otra / No la encuentro' };
const manualModelOption = { value: MANUAL_OPTION, label: 'Otro / No lo encuentro' };
const manualVersionOption = { value: MANUAL_OPTION, label: 'Otra / No la encuentro' };
const manualYearOption = { value: MANUAL_OPTION, label: 'Otro / No aparece' };

type ManualCatalogFieldProps = {
  label: string;
  name: string;
  placeholder: string;
  required?: boolean;
  type?: 'text' | 'number';
  inputMode?: 'numeric';
  min?: number;
  max?: number;
  onReturn?: () => void;
};

function ManualCatalogField({
  inputMode,
  label,
  max,
  min,
  name,
  onReturn,
  placeholder,
  required = false,
  type = 'text',
}: ManualCatalogFieldProps) {
  return (
    <label className="valuation-manual-field">
      <span>{label}</span>
      {onReturn ? (
        <button className="valuation-manual-return" type="button" onClick={onReturn}>
          Volver a opciones
        </button>
      ) : null}
      <input
        autoComplete="off"
        autoFocus={Boolean(onReturn)}
        aria-label={`Ingresar ${label.replace(' *', '').toLocaleLowerCase('es')}`}
        inputMode={inputMode}
        max={max}
        min={min}
        name={name}
        placeholder={placeholder}
        required={required}
        type={type}
      />
    </label>
  );
}

async function getCatalogOptions(url: string, signal: AbortSignal): Promise<CatalogOption[]> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('Catalog request failed');

  const payload = await response.json() as { options?: CatalogOption[] };
  if (!Array.isArray(payload.options)) throw new Error('Invalid catalog response');
  return payload.options;
}

export function VehicleCatalogFields({ hidden }: { hidden: boolean }) {
  const [makeId, setMakeId] = useState('');
  const [modelId, setModelId] = useState('');
  const [year, setYear] = useState('');
  const [versionId, setVersionId] = useState('');
  const [makes, setMakes] = useState<CatalogOption[]>([]);
  const [models, setModels] = useState<CatalogOption[]>([]);
  const [versions, setVersions] = useState<CatalogOption[]>([]);
  const [makeStatus, setMakeStatus] = useState<CatalogState>('loading');
  const [modelStatus, setModelStatus] = useState<CatalogState>('idle');
  const [versionStatus, setVersionStatus] = useState<CatalogState>('idle');
  const [makeRetry, setMakeRetry] = useState(0);
  const [modelRetry, setModelRetry] = useState(0);
  const [versionRetry, setVersionRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getCatalogOptions('/api/vehicle-catalog?resource=brands', controller.signal)
      .then((options) => { setMakes(options); setMakeStatus('ready'); })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setMakeStatus('error');
      });
    return () => controller.abort();
  }, [makeRetry]);

  useEffect(() => {
    if (!makeId || makeId === MANUAL_OPTION) return;
    const controller = new AbortController();
    getCatalogOptions(`/api/vehicle-catalog?resource=models&brandId=${encodeURIComponent(makeId)}`, controller.signal)
      .then((options) => { setModels(options); setModelStatus('ready'); })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setModelStatus('error');
      });
    return () => controller.abort();
  }, [makeId, modelRetry]);

  useEffect(() => {
    if (!modelId || modelId === MANUAL_OPTION || makeId === MANUAL_OPTION) return;
    const controller = new AbortController();
    getCatalogOptions(`/api/vehicle-catalog?resource=versions&modelId=${encodeURIComponent(modelId)}`, controller.signal)
      .then((options) => { setVersions(options); setVersionStatus('ready'); })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setVersionStatus('error');
      });
    return () => controller.abort();
  }, [makeId, modelId, versionRetry]);

  const handleMakeChange = (nextMakeId: string) => {
    setMakeId(nextMakeId);
    setModelId('');
    setYear('');
    setVersionId('');
    setModels([]);
    setVersions([]);
    setModelStatus(nextMakeId && nextMakeId !== MANUAL_OPTION ? 'loading' : 'idle');
    setVersionStatus('idle');
  };

  const handleModelChange = (nextModelId: string) => {
    setModelId(nextModelId);
    setYear('');
    setVersionId('');
    setVersions([]);
    setVersionStatus(nextModelId && nextModelId !== MANUAL_OPTION ? 'loading' : 'idle');
  };

  const handleYearChange = (nextYear: string) => {
    setYear(nextYear);
    setVersionId('');
  };

  const makeName = makes.find(({ id }) => id === makeId)?.name ?? '';
  const modelName = models.find(({ id }) => id === modelId)?.name ?? '';
  const availableYears = [...new Set(versions.flatMap(({ availableYears: years = [] }) => years))]
    .filter((optionYear) => optionYear > 0)
    .sort((a, b) => b - a);
  const filteredVersions = year && year !== MANUAL_OPTION
    ? versions.filter(({ availableYears: years = [] }) => years.includes(Number(year)))
    : [];
  const versionName = filteredVersions.find(({ id }) => id === versionId)?.name ?? '';
  const makeOptions = [...makes.map(({ id, name }) => ({ value: id, label: name })), manualMakeOption];
  const modelOptions = [...models.map(({ id, name }) => ({ value: id, label: name })), manualModelOption];
  const yearOptions = [...availableYears.map((value) => ({ value: String(value), label: String(value) })), manualYearOption];
  const versionOptions = [...filteredVersions.map(({ id, name }) => ({ value: id, label: name })), manualVersionOption];

  return (
    <section className="valuation-form-section valuation-form-step" data-step="1" hidden={hidden}>
      <ValuationStepHeading
        description="Los datos básicos nos ayudan a identificar correctamente la versión."
        icon={CarFront}
        step={1}
        title="El vehículo"
      />
      <div className="valuation-fields">
        {makeId === MANUAL_OPTION ? (
          <ManualCatalogField
            label="Marca *"
            name="make"
            onReturn={() => handleMakeChange('')}
            placeholder="Escribí la marca"
            required
          />
        ) : (
          <div className="valuation-select-field">
            <span>Marca *</span>
            <CustomSelect ariaLabel="Marca" required searchable value={makeId} onChange={handleMakeChange} options={makeOptions} disabled={makeStatus === 'loading'} placeholder={makeStatus === 'loading' ? 'Cargando marcas…' : 'Seleccionar marca'} searchPlaceholder="Buscar marca…" />
            <input name="make" type="hidden" value={makeName} />
            {makeStatus === 'error' ? <small className="valuation-catalog-status">No pudimos cargar las marcas. <button type="button" onClick={() => { setMakeStatus('loading'); setMakeRetry((value) => value + 1); }}>Reintentar</button> o elegí “Otra”.</small> : null}
          </div>
        )}

        {makeId === MANUAL_OPTION ? (
          <ManualCatalogField label="Modelo *" name="model" placeholder="Ej. 330i" required />
        ) : modelId === MANUAL_OPTION ? (
          <ManualCatalogField
            label="Modelo *"
            name="model"
            onReturn={() => handleModelChange('')}
            placeholder="Escribí el modelo"
            required
          />
        ) : (
          <div className="valuation-select-field">
            <span>Modelo *</span>
            <CustomSelect ariaLabel="Modelo" required searchable key={makeId} value={modelId} onChange={handleModelChange} options={modelOptions} disabled={!makeId || modelStatus === 'loading'} placeholder={modelStatus === 'loading' ? 'Cargando modelos…' : !makeId ? 'Primero elegí una marca' : 'Seleccionar modelo'} searchPlaceholder="Buscar modelo…" />
            <input name="model" type="hidden" value={modelName} />
            {modelStatus === 'error' ? <small className="valuation-catalog-status">No pudimos cargar los modelos. <button type="button" onClick={() => { setModelStatus('loading'); setModelRetry((value) => value + 1); }}>Reintentar</button> o elegí “Otro”.</small> : null}
          </div>
        )}

        {makeId === MANUAL_OPTION || modelId === MANUAL_OPTION ? (
          <ManualCatalogField label="Año *" name="year" inputMode="numeric" type="number" min={1950} max={2027} placeholder="2021" required />
        ) : year === MANUAL_OPTION ? (
          <ManualCatalogField
            label="Año *"
            name="year"
            inputMode="numeric"
            type="number"
            min={1950}
            max={2027}
            onReturn={() => handleYearChange('')}
            placeholder="Escribí el año"
            required
          />
        ) : (
          <div className="valuation-select-field">
            <span>Año *</span>
            <CustomSelect ariaLabel="Año" required key={modelId} value={year} onChange={handleYearChange} options={yearOptions} disabled={!modelId || versionStatus === 'loading'} placeholder={versionStatus === 'loading' ? 'Cargando años…' : !modelId ? 'Primero elegí un modelo' : 'Seleccionar año'} />
            <input name="year" type="hidden" value={year} />
            {versionStatus === 'error' ? <small className="valuation-catalog-status">No pudimos cargar los años. <button type="button" onClick={() => { setVersionStatus('loading'); setVersionRetry((value) => value + 1); }}>Reintentar</button> o elegí “Otro”.</small> : null}
          </div>
        )}

        {makeId === MANUAL_OPTION || modelId === MANUAL_OPTION || year === MANUAL_OPTION ? (
          <ManualCatalogField label="Versión" name="version" placeholder="Ej. M Sport" />
        ) : versionId === MANUAL_OPTION ? (
          <ManualCatalogField
            label="Versión"
            name="version"
            onReturn={() => setVersionId('')}
            placeholder="Escribí la versión"
          />
        ) : (
          <div className="valuation-select-field">
            <span>Versión</span>
            <CustomSelect ariaLabel="Versión" searchable key={`${modelId}-${year}`} value={versionId} onChange={setVersionId} options={versionOptions} disabled={!year || versionStatus === 'loading'} placeholder={versionStatus === 'loading' ? 'Cargando versiones…' : !year ? 'Primero elegí un año' : 'Seleccionar versión'} searchPlaceholder="Buscar versión…" />
            <input name="version" type="hidden" value={versionName} />
          </div>
        )}
        <label><span>Color</span><input name="color" autoComplete="off" placeholder="Ej. Negro" /></label>
        <small className="valuation-catalog-credit valuation-field-wide">Catálogo vehicular provisto por <a href="https://argautos.com" target="_blank" rel="noreferrer">Arg Autos</a>.</small>
      </div>
    </section>
  );
}
