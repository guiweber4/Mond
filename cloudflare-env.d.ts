declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    AI_VAULT_KEY?: string;
    APP_ADMIN_EMAIL?: string;
    BUCKET?: R2Bucket;
  }
}
