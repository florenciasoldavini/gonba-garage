'use client';

import { useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Plus } from 'lucide-react';

const faqs = [
  {
    question: '¿Los vehículos están revisados?',
    answer:
      'Cada unidad se presenta con la información disponible sobre su estado, historial y documentación.',
  },
  {
    question: '¿Puedo entregar mi auto como parte de pago?',
    answer: 'Sí. Primero coordinamos una evaluación para determinar su estado y valor de mercado.',
  },
  {
    question: '¿Trabajan con financiación?',
    answer:
      'Podemos analizar distintas alternativas según el vehículo y las condiciones de la operación.',
  },
  {
    question: '¿Cómo coordino una visita?',
    answer:
      'Contactanos por WhatsApp para confirmar disponibilidad y reservar un horario de atención.',
  },
];

function FaqItem({
  answer,
  initialOpen = false,
  question,
}: {
  answer: string;
  initialOpen?: boolean;
  question: string;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const targetOpenRef = useRef(initialOpen);
  const [renderedOpen, setRenderedOpen] = useState(initialOpen);

  useGSAP(
    () => {
      gsap.set(answerRef.current, {
        autoAlpha: initialOpen ? 1 : 0,
        height: initialOpen ? 'auto' : 0,
      });
      gsap.set(iconRef.current, { rotation: initialOpen ? 45 : 0 });

      return () => timelineRef.current?.kill();
    },
    { scope: detailsRef },
  );

  const handleSummaryClick = (event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();

    const details = detailsRef.current;
    const answerElement = answerRef.current;
    const icon = iconRef.current;

    if (!details || !answerElement || !icon) return;

    const nextOpen = !targetOpenRef.current;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    targetOpenRef.current = nextOpen;
    timelineRef.current?.kill();

    if (reduceMotion) {
      details.open = nextOpen;
      setRenderedOpen(nextOpen);
      gsap.set(answerElement, { autoAlpha: nextOpen ? 1 : 0, height: nextOpen ? 'auto' : 0 });
      gsap.set(icon, { rotation: nextOpen ? 45 : 0 });
      return;
    }

    if (nextOpen) {
      details.open = true;
      setRenderedOpen(true);

      const targetHeight = answerElement.scrollHeight;
      timelineRef.current = gsap
        .timeline({ defaults: { overwrite: 'auto' } })
        .to(
          answerElement,
          {
            autoAlpha: 1,
            duration: 0.48,
            ease: 'power3.out',
            height: targetHeight,
            onComplete: () => gsap.set(answerElement, { height: 'auto' }),
          },
          0,
        )
        .to(icon, { duration: 0.42, ease: 'back.out(1.7)', rotation: 45 }, 0.03);
      return;
    }

    gsap.set(answerElement, { height: answerElement.offsetHeight });
    timelineRef.current = gsap
      .timeline({ defaults: { overwrite: 'auto' } })
      .to(
        answerElement,
        {
          autoAlpha: 0,
          duration: 0.36,
          ease: 'power2.inOut',
          height: 0,
          onComplete: () => {
            details.open = false;
            setRenderedOpen(false);
          },
        },
        0,
      )
      .to(icon, { duration: 0.32, ease: 'power2.inOut', rotation: 0 }, 0);
  };

  return (
    <details className="glass-panel" open={renderedOpen} ref={detailsRef}>
      <summary aria-expanded={renderedOpen} onClick={handleSummaryClick}>
        {question}
        <span className="faq-icon-shell" aria-hidden="true">
          <span className="faq-icon" ref={iconRef}>
            <Plus size={20} strokeWidth={1.8} />
          </span>
        </span>
      </summary>
      <div className="faq-answer" ref={answerRef}>
        <p>{answer}</p>
      </div>
    </details>
  );
}

export function FaqAccordion() {
  return (
    <div className="faq-list">
      {faqs.map((faq, index) => (
        <FaqItem {...faq} initialOpen={index === 0} key={faq.question} />
      ))}
    </div>
  );
}
