import type { Knex } from 'knex';

/**
 * Billing prep — Lemon Squeezy is the first concrete provider but the
 * schema is provider-agnostic so a future swap (Stripe / Paddle) only
 * adds rows with a different `provider` value rather than a parallel
 * table tree.
 *
 * Three tables:
 *
 *   billing_customers
 *     One row per Rowly user that has ever transacted. `provider` +
 *     `provider_customer_id` is the natural key the provider knows the
 *     customer as. We snapshot the email at create-time so a webhook
 *     that lands before the user re-logs-in can still associate (the
 *     LS payload includes the email and the userId we passed in
 *     `custom_data`).
 *
 *   billing_subscriptions
 *     One row per provider subscription. A user can in theory hold
 *     more than one subscription (replaced plan, etc.) so this is NOT
 *     unique on user_id. The latest non-terminal row is what
 *     entitlement reads. `status` is a free-text column because each
 *     provider has its own status enum (LS uses `on_trial`, `active`,
 *     `paused`, `past_due`, `unpaid`, `cancelled`, `expired`); we
 *     normalise inside the service rather than fight the schema.
 *
 *   billing_events
 *     One row per webhook event we've processed (or attempted to).
 *     Idempotency: `(provider, provider_event_id)` is unique so a
 *     replay of the same webhook is a no-op. We keep the raw payload
 *     and `processed_at` for forensic / audit purposes; if a handler
 *     throws we still write the row with `processed=false` and
 *     `error`. That way an operator can spot a stuck event.
 *
 * No data is moved. No existing column is touched. The migration is
 * pure additive DDL and has a working `down`.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('billing_customers', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable();
    t.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    t.text('provider').notNullable();
    t.text('provider_customer_id').notNullable();
    t.text('email').notNullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    t.unique(['provider', 'provider_customer_id']);
    t.index(['user_id']);
  });

  await knex.schema.createTable('billing_subscriptions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable();
    t.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    t.text('provider').notNullable();
    t.text('provider_subscription_id').notNullable();
    t.text('provider_customer_id').nullable();
    t.text('provider_product_id').nullable();
    t.text('provider_variant_id').nullable();
    t.text('status').notNullable();
    /**
     * Plan is a normalised label our app uses ('monthly' | 'annual').
     * Filled in from the variant id we sent at checkout. Lets the UI
     * render "$12/month" without re-querying the provider.
     */
    t.text('plan').nullable();
    t.timestamp('trial_ends_at').nullable();
    t.timestamp('renews_at').nullable();
    t.timestamp('ends_at').nullable();
    /**
     * Provider-supplied URLs (LS returns these on every subscription
     * payload). Stored so the customer-portal route can answer without
     * a round-trip to the provider.
     */
    t.text('customer_portal_url').nullable();
    t.text('update_payment_method_url').nullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    t.unique(['provider', 'provider_subscription_id']);
    t.index(['user_id', 'status']);
  });

  await knex.schema.createTable('billing_events', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('provider').notNullable();
    t.text('provider_event_id').notNullable();
    t.text('event_name').notNullable();
    t.jsonb('payload').notNullable();
    t.boolean('processed').notNullable().defaultTo(false);
    t.timestamp('processed_at').nullable();
    t.text('error').nullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    t.unique(['provider', 'provider_event_id']);
    t.index(['event_name']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('billing_events');
  await knex.schema.dropTableIfExists('billing_subscriptions');
  await knex.schema.dropTableIfExists('billing_customers');
}
