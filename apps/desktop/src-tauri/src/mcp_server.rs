use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::io::{self, BufRead, Write};

use crate::clipper;
use crate::db::Database;
use crate::markdown::{self, MarkdownOptions};
use crate::search::SearchEngine;

#[derive(Deserialize)]
struct JsonRpcRequest {
    #[allow(dead_code)]
    jsonrpc: String,
    id: Option<Value>,
    method: String,
    params: Option<Value>,
}

#[derive(Serialize)]
struct JsonRpcResponse {
    jsonrpc: String,
    id: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<JsonRpcError>,
}

#[derive(Serialize)]
struct JsonRpcError {
    code: i64,
    message: String,
}

impl JsonRpcResponse {
    fn success(id: Value, result: Value) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            id,
            result: Some(result),
            error: None,
        }
    }

    fn error(id: Value, code: i64, message: String) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            id,
            result: None,
            error: Some(JsonRpcError { code, message }),
        }
    }
}

fn tools_list() -> Value {
    json!({
        "tools": [
            {
                "name": "search_yoinks",
                "description": "Search across all saved content (clips, downloads, transcripts)",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "query": { "type": "string", "description": "Search query" },
                        "limit": { "type": "number", "description": "Max results (default 10)" }
                    },
                    "required": ["query"]
                }
            },
            {
                "name": "get_clip",
                "description": "Get full content of a saved clip by ID",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "id": { "type": "string", "description": "Clip ID" }
                    },
                    "required": ["id"]
                }
            },
            {
                "name": "list_recent_clips",
                "description": "List recently saved clips",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "limit": { "type": "number", "description": "Max results (default 10)" }
                    }
                }
            },
            {
                "name": "clip_url",
                "description": "Clip a URL — extract readable content and save as Markdown",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "url": { "type": "string", "description": "URL to clip" }
                    },
                    "required": ["url"]
                }
            }
        ]
    })
}

fn handle_tool_call(
    name: &str,
    args: &Value,
    db: &Database,
    search_engine: &Option<SearchEngine>,
) -> Result<Value, String> {
    match name {
        "search_yoinks" => {
            let query = args["query"].as_str().ok_or("Missing query parameter")?;
            let limit = args["limit"].as_u64().unwrap_or(10) as usize;
            let engine = search_engine.as_ref().ok_or("Search engine not available")?;
            let results = engine.search(query, limit)?;
            Ok(json!({
                "content": [{
                    "type": "text",
                    "text": serde_json::to_string_pretty(&results).unwrap_or_default()
                }]
            }))
        }
        "get_clip" => {
            let id = args["id"].as_str().ok_or("Missing id parameter")?;
            let clip = db.get_clip(id)
                .map_err(|e| format!("DB error: {}", e))?
                .ok_or_else(|| format!("Clip not found: {}", id))?;
            let content = clip.markdown.as_deref().unwrap_or("No content");
            Ok(json!({
                "content": [{
                    "type": "text",
                    "text": format!(
                        "# {}\n\nSource: {}\nDate: {}\n\n{}",
                        clip.title.as_deref().unwrap_or("Untitled"),
                        clip.url,
                        clip.created_at,
                        content
                    )
                }]
            }))
        }
        "list_recent_clips" => {
            let limit = args["limit"].as_u64().unwrap_or(10) as usize;
            let all_clips = db.list_clips().map_err(|e| format!("DB error: {}", e))?;
            let clips: Vec<_> = all_clips.into_iter().take(limit).collect();
            let summary: Vec<Value> = clips.iter().map(|c| {
                json!({
                    "id": c.id,
                    "title": c.title,
                    "url": c.url,
                    "source_type": c.source_type,
                    "created_at": c.created_at
                })
            }).collect();
            Ok(json!({
                "content": [{
                    "type": "text",
                    "text": serde_json::to_string_pretty(&summary).unwrap_or_default()
                }]
            }))
        }
        "clip_url" => {
            let url = args["url"].as_str().ok_or("Missing url parameter")?;
            // Use tokio runtime for async clip operation
            let rt = tokio::runtime::Runtime::new()
                .map_err(|e| format!("Failed to create runtime: {}", e))?;
            let url_owned = url.to_string();
            let clip = rt.block_on(async {
                let raw_html = clipper::fetch_page(&url_owned).await?;
                let content = clipper::extract_readable(&raw_html, &url_owned)?;
                let options = MarkdownOptions {
                    include_frontmatter: true,
                    include_images: true,
                    image_download_path: None,
                };
                let md_output = markdown::html_to_markdown(&content, &url_owned, &options);
                let markdown_text = format!("{}{}", md_output.frontmatter, md_output.body);
                let clip = crate::db::Clip {
                    id: uuid::Uuid::new_v4().to_string(),
                    url: url_owned.clone(),
                    title: Some(content.title),
                    markdown: Some(markdown_text),
                    html: Some(raw_html),
                    summary: content.description,
                    tags: "[]".to_string(),
                    source_type: "clip".to_string(),
                    vault_path: None,
                    created_at: chrono::Utc::now().to_rfc3339(),
                    updated_at: None,
                };
                db.insert_clip(&clip).map_err(|e| format!("DB error: {}", e))?;
                Ok::<_, String>(clip)
            })?;
            Ok(json!({
                "content": [{
                    "type": "text",
                    "text": format!(
                        "Clipped: {}\nID: {}\nTitle: {}",
                        clip.url,
                        clip.id,
                        clip.title.as_deref().unwrap_or("Untitled")
                    )
                }]
            }))
        }
        _ => Err(format!("Unknown tool: {}", name)),
    }
}

/// Run the MCP server on stdin/stdout.
/// This is designed to be invoked as a separate process.
pub fn run_mcp_server(db_path: &str, search_index_path: &str) {
    let db = Database::new_with_path(db_path).expect("Failed to open database");

    let search_engine = match SearchEngine::new(search_index_path) {
        Ok(engine) => Some(engine),
        Err(e) => {
            eprintln!("Warning: Search engine failed to initialize: {}", e);
            None
        }
    };

    let stdin = io::stdin();
    let stdout = io::stdout();

    for line in stdin.lock().lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => break,
        };

        if line.trim().is_empty() {
            continue;
        }

        let request: JsonRpcRequest = match serde_json::from_str(&line) {
            Ok(req) => req,
            Err(e) => {
                let resp = JsonRpcResponse::error(
                    Value::Null,
                    -32700,
                    format!("Parse error: {}", e),
                );
                let _ = writeln!(stdout.lock(), "{}", serde_json::to_string(&resp).unwrap());
                continue;
            }
        };

        let id = request.id.clone().unwrap_or(Value::Null);

        let response = match request.method.as_str() {
            "initialize" => JsonRpcResponse::success(id, json!({
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {}
                },
                "serverInfo": {
                    "name": "yoinkit-mcp",
                    "version": "0.1.0"
                }
            })),
            "notifications/initialized" => continue,
            "tools/list" => JsonRpcResponse::success(id, tools_list()),
            "tools/call" => {
                let params = request.params.unwrap_or(json!({}));
                let tool_name = params["name"].as_str().unwrap_or("");
                let arguments = &params["arguments"];

                match handle_tool_call(tool_name, arguments, &db, &search_engine) {
                    Ok(result) => JsonRpcResponse::success(id, result),
                    Err(e) => JsonRpcResponse::error(id, -32000, e),
                }
            }
            _ => JsonRpcResponse::error(id, -32601, format!("Method not found: {}", request.method)),
        };

        let output = serde_json::to_string(&response).unwrap();
        let mut out = stdout.lock();
        let _ = writeln!(out, "{}", output);
        let _ = out.flush();
    }
}
