import type { MepQuote } from '@/features/vehicles/domain/catalog-pricing';
import type { Vehicle } from '@/features/vehicles/domain/vehicle';
import { formatApproximateUsdPrice } from '@/features/vehicles/presentation/formatters';
import './approximate-usd-price.css';

type ApproximateUsdPriceProps = {
  className?: string;
  quote: MepQuote | null;
  vehicle: Pick<Vehicle, 'price' | 'currency'>;
};

/** A small secondary line under a peso price. Renders nothing for dollar prices or without a quote. */
export function ApproximateUsdPrice({ className, quote, vehicle }: ApproximateUsdPriceProps) {
  const usd = formatApproximateUsdPrice(vehicle, quote);
  if (!usd) return null;
  return (
    <small className={['price-usd-approx', className].filter(Boolean).join(' ')} title="Aproximado al dólar MEP">
      <span aria-hidden="true">≈ </span><span className="sr-only">Aproximadamente </span>{usd}
    </small>
  );
}
