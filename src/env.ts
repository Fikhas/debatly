import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
  PUBLIC_SUPABASE_URL: { public: true, schema: (value) => value ?? '' },
  PUBLIC_SUPABASE_ANON_KEY: { public: true, schema: (value) => value ?? '' },
  TURN_CREDENTIALS_URL: { schema: (value) => value ?? '' },
  TURN_CREDENTIALS_TOKEN: { schema: (value) => value ?? '' }
});
