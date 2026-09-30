import type { NextConfig } from "next";

// A Vercel desencoraja nomes com NEXT_PUBLIC_ + KEY. A chave publishable/anon do Supabase é pública por design,
// então aceitamos também nomes sem o prefixo e os embutimos no build com os nomes que o código usa.
const pick = (...names: string[]) => names.map((n) => process.env[n]?.trim()).find(Boolean) ?? "";

const nextConfig: NextConfig = {
  experimental: {
    // Deterministic production builds: a restored Turbopack cache once shipped a stale globals.css.
    turbopackFileSystemCacheForBuild: false,
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: pick("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: pick(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_ANON_KEY",
    ),
  },
};

export default nextConfig;
