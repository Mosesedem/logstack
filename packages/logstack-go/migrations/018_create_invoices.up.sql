-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      integer     NOT NULL REFERENCES users(id),
    reference    varchar(255) UNIQUE NOT NULL,
    amount_cents integer     NOT NULL,
    currency     varchar(3)  NOT NULL,
    status       varchar(20) NOT NULL DEFAULT 'pending',
    line_items   jsonb       NOT NULL DEFAULT '[]',
    paid_at      timestamptz,
    created_at   timestamptz NOT NULL DEFAULT NOW(),
    updated_at   timestamptz NOT NULL DEFAULT NOW()
);

-- Add indexes for user-scoped queries and reference lookups
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_reference ON invoices(reference);
