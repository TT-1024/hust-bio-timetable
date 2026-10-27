declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    ANALYTICS_OWNER_EMAIL?: string;
    ANALYTICS_VIEWER_EMAILS?: string;
    BUCKET?: R2Bucket;
  }
}
