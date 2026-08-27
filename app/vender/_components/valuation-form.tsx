'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowUpRight, CarFront, Check, ClipboardCheck, Gauge, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CustomSelect } from '@/components/ui/custom-select';
import { Eyebrow } from '@/components/ui/eyebrow';

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

async function getCatalogOptions(url: string, signal: AbortSignal): Promise<CatalogOption[]> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('Catalog request failed');

  const payload = await response.json() as { options?: CatalogOption[] };
  if (!Array.isArray(payload.options)) throw new Error('Invalid catalog response');
  return payload.options;
}

export function ValuationForm() {
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState(1);
  const [condition, setCondition] = useState('');
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
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const controller = new AbortController();

    getCatalogOptions('/api/vehicle-catalog?resource=brands', controller.signal)
      .then((options) => {
        setMakes(options);
        setMakeStatus('ready');
      })
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
      .then((options) => {
        setModels(options);
        setModelStatus('ready');
      })
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
      .then((options) => {
        setVersions(options);
        setVersionStatus('ready');
      })
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
  const availableYears = [...new Set(
    versions.flatMap(({ availableYears: optionYears = [] }) => optionYears),
  )]
    .filter((optionYear) => optionYear > 0)
    .sort((a, b) => b - a);
  const filteredVersions = year && year !== MANUAL_OPTION
    ? versions.filter(({ availableYears: optionYears = [] }) => optionYears.includes(Number(year)))
    : [];
  const versionName = filteredVersions.find(({ id }) => id === versionId)?.name ?? '';
  const makeOptions = [...makes.map(({ id, name }) => ({ value: id, label: name })), manualMakeOption];
  const modelOptions = [...models.map(({ id, name }) => ({ value: id, label: name })), manualModelOption];
  const yearOptions = [...availableYears.map((optionYear) => ({ value: String(optionYear), label: String(optionYear) })), manualYearOption];
  const versionOptions = [...filteredVersions.map(({ id, name }) => ({ value: id, label: name })), manualVersionOption];

  const moveToStep = (nextStep: number) => {
    setStep(nextStep);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const continueToNextStep = () => {
    const currentSection = formRef.current?.querySelector<HTMLElement>(`[data-step="${step}"]`);
    const missingCustomSelect = currentSection?.querySelector<HTMLButtonElement>('[data-required-select="true"][data-value=""]');
    if (missingCustomSelect) {
      missingCustomSelect.setAttribute('aria-invalid', 'true');
      missingCustomSelect.focus();
      return;
    }
    const controls = currentSection?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea');

    for (const control of controls ?? []) {
      if (!control.checkValidity()) {
        control.reportValidity();
        return;
      }
    }

    moveToStep(Math.min(step + 1, 3));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    event.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (submitted) {
    return (
      <section className="valuation-success glass-panel" aria-live="polite">
        <span className="valuation-success-icon"><Check aria-hidden="true" size={24} strokeWidth={2} /></span>
        <Eyebrow>Solicitud preparada</Eyebrow>
        <h2>Ya tenemos una primera foto de tu auto.</h2>
        <p>En la versión final, Gonba Garage recibirá estos datos para revisar la unidad y contactarte con una estimación preliminar.</p>
        <div className="valuation-success-next">
          <strong>¿Qué sigue?</strong>
          <ol>
            <li><span>01</span> Revisamos la información.</li>
            <li><span>02</span> Te contactamos para conocer más detalles.</li>
            <li><span>03</span> Coordinamos una inspección si la unidad encaja.</li>
          </ol>
        </div>
        <Button type="button" onClick={() => { setSubmitted(false); setStep(1); }}>Cargar otro vehículo <ArrowUpRight aria-hidden="true" size={16} /></Button>
        <small>Demostración: todavía no se enviaron datos.</small>
      </section>
    );
  }

  return (
    <form className="valuation-form glass-panel" ref={formRef} onSubmit={handleSubmit}>
      <div className="valuation-form-heading">
        <div><span>Formulario de tasación · Paso {step} de 3</span><strong>Completalo en aproximadamente 3 minutos.</strong></div>
        <span className="valuation-form-time">3 min</span>
      </div>

      <div className="valuation-stepper" aria-label={`Paso ${step} de 3`}>
        <div className="valuation-stepper-track" aria-hidden="true"><span style={{ width: `${(step / 3) * 100}%` }} /></div>
        <ol>
          {['Vehículo', 'Estado', 'Contacto'].map((label, index) => {
            const stepNumber = index + 1;
            return (
              <li className={stepNumber === step ? 'is-active' : stepNumber < step ? 'is-complete' : ''} aria-current={stepNumber === step ? 'step' : undefined} key={label}>
                <span>{stepNumber < step ? <Check aria-hidden="true" size={12} /> : `0${stepNumber}`}</span>
                <strong>{label}</strong>
              </li>
            );
          })}
        </ol>
      </div>

      <section className="valuation-form-section valuation-form-step" data-step="1" hidden={step !== 1}>
        <div className="valuation-step-heading">
          <span><CarFront aria-hidden="true" size={17} /></span>
          <div><strong>01 · El vehículo</strong><p>Los datos básicos nos ayudan a identificar correctamente la versión.</p></div>
        </div>
        <div className="valuation-fields">
          <div className="valuation-select-field">
            <span>Marca *</span>
            <CustomSelect
              ariaLabel="Marca"
              required
              searchable
              value={makeId}
              onChange={handleMakeChange}
              options={makeOptions}
              disabled={makeStatus === 'loading'}
              placeholder={makeStatus === 'loading' ? 'Cargando marcas…' : 'Seleccionar marca'}
              searchPlaceholder="Buscar marca…"
            />
            {makeId === MANUAL_OPTION
              ? <input name="make" required autoComplete="off" placeholder="Escribí la marca" aria-label="Ingresar marca" />
              : <input name="make" type="hidden" value={makeName} />}
            {makeStatus === 'error' && <small className="valuation-catalog-status">No pudimos cargar las marcas. <button type="button" onClick={() => { setMakeStatus('loading'); setMakeRetry((value) => value + 1); }}>Reintentar</button> o elegí “Otra”.</small>}
          </div>

          {makeId === MANUAL_OPTION ? (
            <label><span>Modelo *</span><input name="model" required autoComplete="off" placeholder="Ej. 330i" /></label>
          ) : (
            <div className="valuation-select-field">
              <span>Modelo *</span>
              <CustomSelect
                ariaLabel="Modelo"
                required
                searchable
                key={makeId}
                value={modelId}
                onChange={handleModelChange}
                options={modelOptions}
                disabled={!makeId || modelStatus === 'loading'}
                placeholder={modelStatus === 'loading' ? 'Cargando modelos…' : !makeId ? 'Primero elegí una marca' : 'Seleccionar modelo'}
                searchPlaceholder="Buscar modelo…"
              />
              {modelId === MANUAL_OPTION
                ? <input name="model" required autoComplete="off" placeholder="Escribí el modelo" aria-label="Ingresar modelo" />
                : <input name="model" type="hidden" value={modelName} />}
              {modelStatus === 'error' && <small className="valuation-catalog-status">No pudimos cargar los modelos. <button type="button" onClick={() => { setModelStatus('loading'); setModelRetry((value) => value + 1); }}>Reintentar</button> o elegí “Otro”.</small>}
            </div>
          )}

          {makeId === MANUAL_OPTION || modelId === MANUAL_OPTION ? (
            <label><span>Año *</span><input name="year" required inputMode="numeric" type="number" min="1950" max="2027" placeholder="2021" /></label>
          ) : (
            <div className="valuation-select-field">
              <span>Año *</span>
              <CustomSelect
                ariaLabel="Año"
                required
                key={modelId}
                value={year}
                onChange={handleYearChange}
                options={yearOptions}
                disabled={!modelId || versionStatus === 'loading'}
                placeholder={versionStatus === 'loading' ? 'Cargando años…' : !modelId ? 'Primero elegí un modelo' : 'Seleccionar año'}
              />
              {year === MANUAL_OPTION
                ? <input name="year" required inputMode="numeric" type="number" min="1950" max="2027" placeholder="Escribí el año" aria-label="Ingresar año" />
                : <input name="year" type="hidden" value={year} />}
              {versionStatus === 'error' && <small className="valuation-catalog-status">No pudimos cargar los años. <button type="button" onClick={() => { setVersionStatus('loading'); setVersionRetry((value) => value + 1); }}>Reintentar</button> o elegí “Otro”.</small>}
            </div>
          )}

          {makeId === MANUAL_OPTION || modelId === MANUAL_OPTION || year === MANUAL_OPTION ? (
            <label><span>Versión</span><input name="version" autoComplete="off" placeholder="Ej. M Sport" /></label>
          ) : (
            <div className="valuation-select-field">
              <span>Versión</span>
              <CustomSelect
                ariaLabel="Versión"
                searchable
                key={`${modelId}-${year}`}
                value={versionId}
                onChange={setVersionId}
                options={versionOptions}
                disabled={!year || versionStatus === 'loading'}
                placeholder={versionStatus === 'loading' ? 'Cargando versiones…' : !year ? 'Primero elegí un año' : 'Seleccionar versión'}
                searchPlaceholder="Buscar versión…"
              />
              {versionId === MANUAL_OPTION
                ? <input name="version" autoComplete="off" placeholder="Escribí la versión" aria-label="Ingresar versión" />
                : <input name="version" type="hidden" value={versionName} />}
            </div>
          )}
          <label><span>Color</span><input name="color" autoComplete="off" placeholder="Ej. Negro" /></label>
          <small className="valuation-catalog-credit valuation-field-wide">Catálogo vehicular provisto por <a href="https://argautos.com" target="_blank" rel="noreferrer">Arg Autos</a>.</small>
        </div>
      </section>

      <section className="valuation-form-section valuation-form-step" data-step="2" hidden={step !== 2}>
        <div className="valuation-step-heading">
          <span><Gauge aria-hidden="true" size={17} /></span>
          <div><strong>02 · Estado y configuración</strong><p>Una descripción honesta permite preparar una estimación más realista.</p></div>
        </div>
        <div className="valuation-fields">
          <label><span>Kilometraje *</span><input name="mileage" required inputMode="numeric" type="number" min="0" placeholder="48000" /></label>
          <div className="valuation-select-field"><span>Estado general *</span><CustomSelect name="condition" ariaLabel="Estado general" required value={condition} onChange={setCondition} options={[{ value: 'Excelente', label: 'Excelente' }, { value: 'Muy bueno', label: 'Muy bueno' }, { value: 'Bueno', label: 'Bueno' }, { value: 'Necesita reparaciones', label: 'Necesita reparaciones' }]} /></div>
          <label className="valuation-field-wide"><span>Comentarios sobre el estado</span><textarea name="notes" rows={4} placeholder="Service, detalles de pintura, cubiertas, equipamiento o cualquier información relevante." /></label>
          <label className="valuation-file-field valuation-field-wide">
            <Upload aria-hidden="true" size={20} />
            <span><strong>Agregar fotos del vehículo</strong><small>Exterior, interior y tablero · Opcional</small></span>
            <input name="photos" type="file" accept="image/*" multiple />
          </label>
        </div>
      </section>

      <section className="valuation-form-section valuation-form-step" data-step="3" hidden={step !== 3}>
        <div className="valuation-step-heading">
          <span><ClipboardCheck aria-hidden="true" size={17} /></span>
          <div><strong>03 · Tus datos</strong><p>Los usamos únicamente para contactarte y coordinar los próximos pasos.</p></div>
        </div>
        <div className="valuation-fields">
          <label><span>Nombre y apellido *</span><input name="name" required autoComplete="name" placeholder="Tu nombre" /></label>
          <label><span>Teléfono *</span><input name="phone" required autoComplete="tel" type="tel" placeholder="11 0000 0000" /></label>
        </div>
      </section>

      <div className="valuation-form-submit">
        {step === 3 && <label className="valuation-consent"><input required type="checkbox" name="consent" /><span><Check aria-hidden="true" size={11} /></span>Acepto que me contacten para evaluar este vehículo.</label>}
        <div className="valuation-step-actions">
          {step > 1 && <button className="valuation-back-button" type="button" onClick={() => moveToStep(step - 1)}><ArrowLeft aria-hidden="true" size={15} /> Volver</button>}
          {step < 3 ? (
            <Button type="button" onClick={continueToNextStep}>Continuar <ArrowUpRight aria-hidden="true" size={16} /></Button>
          ) : (
            <Button type="submit">Solicitar estimación <ArrowUpRight aria-hidden="true" size={16} /></Button>
          )}
        </div>
        <small>Esta versión es demostrativa y no envía información todavía.</small>
      </div>
    </form>
  );
}
