use serde::{Serialize, Deserialize};
use crate::settings::AppSettings;

#[derive(Debug, Clone)]
pub enum AiProvider {
    None,
    Ollama { base_url: String, model: String },
    Claude { api_key: String, model: String },
    OpenAI { api_key: String, model: String },
}

impl AiProvider {
    pub async fn complete(&self, system: &str, user: &str) -> Result<String, String> {
        match self {
            AiProvider::None => Err("No AI provider configured".into()),
            AiProvider::Ollama { base_url, model } => {
                // POST to {base_url}/api/generate with model, system, prompt
                let client = reqwest::Client::new();
                let body = serde_json::json!({
                    "model": model,
                    "system": system,
                    "prompt": user,
                    "stream": false
                });
                let resp = client.post(format!("{}/api/generate", base_url))
                    .json(&body)
                    .timeout(std::time::Duration::from_secs(120))
                    .send()
                    .await
                    .map_err(|e| format!("Ollama request failed: {}", e))?;
                let json: serde_json::Value = resp.json().await
                    .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;
                json["response"].as_str()
                    .map(|s| s.to_string())
                    .ok_or_else(|| "Invalid Ollama response format".to_string())
            },
            AiProvider::Claude { api_key, model } => {
                // POST to https://api.anthropic.com/v1/messages
                let client = reqwest::Client::new();
                let body = serde_json::json!({
                    "model": model,
                    "max_tokens": 1024,
                    "system": system,
                    "messages": [{"role": "user", "content": user}]
                });
                let resp = client.post("https://api.anthropic.com/v1/messages")
                    .header("x-api-key", api_key)
                    .header("anthropic-version", "2023-06-01")
                    .header("content-type", "application/json")
                    .json(&body)
                    .timeout(std::time::Duration::from_secs(120))
                    .send()
                    .await
                    .map_err(|e| format!("Claude API request failed: {}", e))?;
                let json: serde_json::Value = resp.json().await
                    .map_err(|e| format!("Failed to parse Claude response: {}", e))?;
                json["content"][0]["text"].as_str()
                    .map(|s| s.to_string())
                    .ok_or_else(|| format!("Invalid Claude response: {}", json))
            },
            AiProvider::OpenAI { api_key, model } => {
                // POST to https://api.openai.com/v1/chat/completions
                let client = reqwest::Client::new();
                let body = serde_json::json!({
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user}
                    ],
                    "max_tokens": 1024
                });
                let resp = client.post("https://api.openai.com/v1/chat/completions")
                    .header("Authorization", format!("Bearer {}", api_key))
                    .header("Content-Type", "application/json")
                    .json(&body)
                    .timeout(std::time::Duration::from_secs(120))
                    .send()
                    .await
                    .map_err(|e| format!("OpenAI request failed: {}", e))?;
                let json: serde_json::Value = resp.json().await
                    .map_err(|e| format!("Failed to parse OpenAI response: {}", e))?;
                json["choices"][0]["message"]["content"].as_str()
                    .map(|s| s.to_string())
                    .ok_or_else(|| format!("Invalid OpenAI response: {}", json))
            },
        }
    }

    pub fn from_settings(settings: &AppSettings, db: &crate::db::Database) -> Self {
        match settings.ai_provider.as_str() {
            "ollama" => {
                let base_url = db.get_setting("ollama_base_url")
                    .ok().flatten()
                    .unwrap_or_else(|| "http://localhost:11434".to_string());
                AiProvider::Ollama {
                    base_url,
                    model: settings.ai_model.clone(),
                }
            }
            "claude" => {
                let api_key = db.get_setting("ai_api_key")
                    .ok().flatten()
                    .unwrap_or_default();
                AiProvider::Claude {
                    api_key,
                    model: if settings.ai_model.is_empty() { "claude-sonnet-4-6".to_string() } else { settings.ai_model.clone() },
                }
            }
            "openai" => {
                let api_key = db.get_setting("ai_api_key")
                    .ok().flatten()
                    .unwrap_or_default();
                AiProvider::OpenAI {
                    api_key,
                    model: if settings.ai_model.is_empty() { "gpt-4o".to_string() } else { settings.ai_model.clone() },
                }
            }
            _ => AiProvider::None,
        }
    }
}

// Task 5.2: Auto-tag and auto-summarize functions
pub async fn auto_tag(content: &str, provider: &AiProvider) -> Result<Vec<String>, String> {
    let truncated = &content[..content.len().min(2000)];
    let prompt = format!(
        "Extract 3-5 concise tags from this content. Return as a JSON array of strings only, no other text.\n\n{}",
        truncated
    );
    let response = provider.complete(
        "You are a content tagger. Return only a JSON array of strings, nothing else.",
        &prompt
    ).await?;
    // Try to parse as JSON array
    let trimmed = response.trim();
    serde_json::from_str::<Vec<String>>(trimmed)
        .or_else(|_| {
            // Try to find JSON array in the response
            if let Some(start) = trimmed.find('[') {
                if let Some(end) = trimmed.rfind(']') {
                    return serde_json::from_str(&trimmed[start..=end])
                        .map_err(|e| format!("Failed to parse tags: {}", e));
                }
            }
            Err(format!("Could not parse tags from response: {}", trimmed))
        })
}

pub async fn auto_summarize(content: &str, provider: &AiProvider) -> Result<String, String> {
    let truncated = &content[..content.len().min(3000)];
    let prompt = format!(
        "Summarize this content in 2-3 sentences:\n\n{}",
        truncated
    );
    provider.complete("You are a concise summarizer. Return only the summary, nothing else.", &prompt).await
}

// Task 5.3: RAG Chat — "Ask My Yoinks"

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatResponse {
    pub answer: String,
    pub source_ids: Vec<String>,
}

pub async fn ask_yoinks(
    question: &str,
    search_engine: &crate::search::SearchEngine,
    provider: &AiProvider,
    db: &crate::db::Database,
) -> Result<ChatResponse, String> {
    // 1. Search index for relevant content (top 5 results)
    let results = search_engine.search(question, 5)?;

    // 2. Build context from search results
    let context = results.iter().map(|r| {
        // Try to get full clip content if it's a clip
        let full_content = if r.content_type == "clip" {
            db.get_clip(&r.id)
                .ok()
                .flatten()
                .and_then(|c| c.markdown.clone())
                .unwrap_or_else(|| r.snippet.clone())
        } else {
            r.snippet.clone()
        };
        let truncated = &full_content[..full_content.len().min(1500)];
        format!("Source: {}\nTitle: {}\nContent: {}\n---", r.url, r.title, truncated)
    }).collect::<Vec<_>>().join("\n\n");

    if context.is_empty() {
        return Ok(ChatResponse {
            answer: "I couldn't find any relevant content in your saved items. Try rephrasing your question or saving more content first.".to_string(),
            source_ids: vec![],
        });
    }

    // 3. Build prompt with context
    let system = "You are a helpful assistant answering questions based on the user's saved content. \
                   Cite sources by title when referencing specific content. \
                   If the saved content doesn't contain relevant information, say so.";
    let user_prompt = format!(
        "Based on my saved content:\n\n{}\n\nQuestion: {}",
        context, question
    );

    // 4. Get AI response
    let answer = provider.complete(system, &user_prompt).await?;
    let source_ids = results.iter().map(|r| r.id.clone()).collect();

    Ok(ChatResponse {
        answer,
        source_ids,
    })
}
