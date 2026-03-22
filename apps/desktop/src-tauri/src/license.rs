use serde::{Deserialize, Serialize};

#[allow(dead_code)]
const LEMONSQUEEZY_API_URL: &str = "https://api.lemonsqueezy.com/v1/licenses/activate";

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct LemonSqueezyResponse {
    activated: bool,
    error: Option<String>,
    license_key: Option<LicenseKeyInfo>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct LicenseKeyInfo {
    status: String,
    activation_limit: Option<i32>,
    activation_usage: Option<i32>,
}

#[allow(dead_code)]
#[derive(Debug, Serialize)]
pub struct ActivationResult {
    pub success: bool,
    pub error: Option<String>,
    pub activations_used: Option<i32>,
    pub activations_limit: Option<i32>,
}

#[allow(dead_code)]
pub async fn activate_license(license_key: &str) -> Result<ActivationResult, String> {
    let instance_name = hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "unknown".to_string());

    let client = reqwest::Client::new();
    let resp = client
        .post(LEMONSQUEEZY_API_URL)
        .header("Accept", "application/json")
        .form(&[
            ("license_key", license_key),
            ("instance_name", instance_name.as_str()),
        ])
        .send()
        .await
        .map_err(|e| format!("Network error: {}. Your key has been saved and will be validated on next launch.", e))?;

    let body: LemonSqueezyResponse = resp.json().await.map_err(|e| e.to_string())?;

    if body.activated {
        Ok(ActivationResult {
            success: true,
            error: None,
            activations_used: body.license_key.as_ref().and_then(|k| k.activation_usage),
            activations_limit: body.license_key.as_ref().and_then(|k| k.activation_limit),
        })
    } else {
        Ok(ActivationResult {
            success: false,
            error: body.error.or(Some("Activation failed".to_string())),
            activations_used: None,
            activations_limit: None,
        })
    }
}
