export function StatusSteps({ steps, title = '¿Qué sigue?' }: { steps: string[]; title?: string }) {
  return (
    <div className="status-steps">
      <strong>{title}</strong>
      <ol>
        {steps.map((step, index) => (
          <li key={step}><span>{String(index + 1).padStart(2, '0')}</span> {step}</li>
        ))}
      </ol>
    </div>
  );
}
