-- Reviews customers leave at /opinar after a sale or purchase. The design is in docs/architecture.md,
-- "Customer reviews". The API accepts a review only with the customer's consent to show it, and
-- withdrawing one deletes its row.
CREATE TABLE public.customer_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type text NOT NULL CHECK (transaction_type IN ('bought', 'sold')),
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL CHECK (char_length(comment) BETWEEN 1 AND 280),
  -- First name and last initial. The full name typed in the form is never stored.
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 80),
  vehicle text CHECK (char_length(vehicle) BETWEEN 1 AND 60),
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.customer_reviews FROM PUBLIC;
