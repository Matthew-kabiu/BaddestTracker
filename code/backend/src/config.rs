//! Environment configuration. Parsed once at boot; the process refuses to start if invalid.

use anyhow::{Context, bail};
use secrecy::SecretString;
use serde::Deserialize;

/// Every setting the backend reads from the environment. Field `foo_bar` maps to env `FOO_BAR`.
/// All fields are required: there are no defaults, so a missing variable stops the boot.
#[derive(Deserialize)]
pub struct Config {
    pub app_env: String,
    pub backend_port: u16,
    pub database_url: SecretString,
    pub cors_origins: Vec<String>,
    pub log_level: String,
    pub db_max_conns: u32,
    /// Internal URL of the Better Auth service, e.g. http://auth:<AUTH_PORT> on the compose network.
    pub auth_internal_url: String,
    /// 32-byte key, base64, encrypting users' BYOK AI provider keys at rest.
    pub ai_keys_encryption_key: SecretString,
}

impl Config {
    pub fn load() -> anyhow::Result<Self> {
        let cfg: Config = envy::from_env().context("parse environment")?;
        cfg.validate()?;
        Ok(cfg)
    }

    pub fn is_production(&self) -> bool {
        self.app_env == "production"
    }

    fn validate(&self) -> anyhow::Result<()> {
        if !["development", "staging", "production"].contains(&self.app_env.as_str()) {
            bail!("APP_ENV must be development, staging, or production");
        }
        if self.cors_origins.is_empty() || self.cors_origins.iter().any(|o| o == "*") {
            bail!("CORS_ORIGINS must list explicit origins, never *");
        }
        if tracing_subscriber::EnvFilter::try_new(&self.log_level).is_err() {
            bail!("LOG_LEVEL is not a valid tracing filter");
        }
        if self.backend_port == 0 {
            bail!("BACKEND_PORT must be a real port");
        }
        if !self.auth_internal_url.starts_with("http") {
            bail!("AUTH_INTERNAL_URL must be an http(s) URL");
        }
        if self.db_max_conns == 0 {
            bail!("DB_MAX_CONNS must be at least 1");
        }
        Ok(())
    }
}

// Manual Debug so `{:?}` can never print a secret. SecretString already redacts itself,
// but listing fields explicitly means a new secret field must be added here deliberately.
impl std::fmt::Debug for Config {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Config")
            .field("app_env", &self.app_env)
            .field("backend_port", &self.backend_port)
            .field("database_url", &"[redacted]")
            .field("cors_origins", &self.cors_origins)
            .field("log_level", &self.log_level)
            .field("db_max_conns", &self.db_max_conns)
            .field("auth_internal_url", &self.auth_internal_url)
            .field("ai_keys_encryption_key", &"[redacted]")
            .finish()
    }
}
