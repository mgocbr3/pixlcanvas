declare namespace NodeJS {
  interface ProcessEnv {
    PORT?: string;
    CORS_ORIGIN?: string;
    SUPABASE_URL?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    SUPABASE_JWT_SECRET?: string;

    // Local dev convenience (do not enable in production)
    PIXLLAND_DEV_AUTH_BYPASS?: string;
    PIXLLAND_DEV_USER_ID?: string;

    // Defaults
    PIXLLAND_DEFAULT_SKYBOX?: string;

    // Editor proxy
    EDITOR_PORT?: string;
    PIXLLAND_API_URL?: string;
    PIXLLAND_EDITOR_ACCESS_TOKEN?: string;
    PIXLLAND_ACCESS_TOKEN?: string;

    // Editor config URLs
    PIXLLAND_HOME_URL?: string;
    PIXLLAND_FRONTEND_URL?: string;
    PIXLLAND_STATIC_URL?: string;
    PIXLLAND_IMAGES_URL?: string;
    PIXLLAND_ENGINE_URL?: string;
    PIXLLAND_REALTIME_HTTP?: string;
    PIXLLAND_RELAY_WS?: string;
    PIXLLAND_MESSENGER_WS?: string;

    // Upload limits and disk allowance
    UPLOAD_MAX_BYTES?: string;
    PIXLLAND_DISK_ALLOWANCE_BYTES?: string;
    PIXLLAND_DISK_USED_BYTES?: string;

    // Optional: storage bucket names
    SUPABASE_ASSETS_BUCKET?: string;
    SUPABASE_PROJECTS_BUCKET?: string;
  }
}
