/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_WORKER_URL: string
  readonly VITE_MAKE_WEBHOOK_URL: string
  readonly VITE_STRIPE_PAYMENT_LINK_URL?: string
  readonly VITE_DEBUG?: string
  readonly NODE_ENV: string
  // Añade aquí cualquier otra variable VITE_ que uses en el futuro
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
