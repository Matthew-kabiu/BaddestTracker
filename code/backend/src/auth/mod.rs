//! Authentication is owned by the Better Auth service (code/auth).
//! This module only answers "who is calling?" by asking that service.

mod extractor;

pub use extractor::AuthUser;
