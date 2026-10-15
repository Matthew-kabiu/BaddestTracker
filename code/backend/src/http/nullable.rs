//! Serde helper for PATCH bodies where a field can be cleared: absent → `None` (leave alone),
//! `null` → `Some(None)` (clear), a value → `Some(Some(v))`. Use with `#[serde(default)]`.

use serde::{Deserialize, Deserializer};

pub fn deserialize<'de, D, T>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    Option::<T>::deserialize(deserializer).map(Some)
}

#[cfg(test)]
#[allow(clippy::unwrap_used)] // tests may unwrap: a panic is a test failure
mod tests {
    #[derive(serde::Deserialize)]
    struct Patch {
        #[serde(default, deserialize_with = "super::deserialize")]
        price: Option<Option<i64>>,
    }

    fn parse(json: &str) -> Option<Option<i64>> {
        serde_json::from_str::<Patch>(json).unwrap().price
    }

    #[test]
    fn absent_null_and_value_are_distinct() {
        assert_eq!(parse("{}"), None);
        assert_eq!(parse(r#"{"price":null}"#), Some(None));
        assert_eq!(parse(r#"{"price":250}"#), Some(Some(250)));
    }
}
