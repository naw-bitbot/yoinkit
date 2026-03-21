use crate::auth::AuthManager;
use crate::commands::AppState;
use crate::wget::WgetFlags;
use axum::{
    extract::{Path, State as AxumState},
    http::{HeaderMap, StatusCode},
    routing::{delete, get, post, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};

#[derive(Clone)]
struct ApiState {
    app_state: Arc<AppState>,
    auth: Arc<AuthManager>,
}

fn validate_token(headers: &HeaderMap, auth: &AuthManager) -> Result<(), StatusCode> {
    let token = headers
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or(StatusCode::UNAUTHORIZED)?;

    if auth.validate(token) {
        Ok(())
    } else {
        Err(StatusCode::UNAUTHORIZED)
    }
}

pub async fn start_api_server(app_state: Arc<AppState>, auth: Arc<AuthManager>) {
    // CORS is permissive because the API only listens on localhost (127.0.0.1)
    // and all mutating endpoints require a valid Bearer token.
    // The auth token is the primary security mechanism.
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let state = ApiState { app_state, auth };

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/download", post(create_download))
        .route("/downloads", get(get_downloads))
        .route("/downloads/:id", get(get_download_by_id))
        .route("/downloads/:id", delete(delete_download_by_id))
        .route("/downloads/:id/pause", post(pause_download))
        .route("/downloads/:id/resume", post(resume_download))
        .route("/settings", get(get_settings))
        .route("/settings", put(update_settings))
        .route("/clip", post(clip_page))
        .layer(cors)
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:9271")
        .await
        .expect("Failed to bind to port 9271");

    tokio::spawn(async move {
        axum::serve(listener, app).await.ok();
    });
}

async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "ok", "app": "yoinkit", "version": "0.1.0" }))
}

#[derive(Deserialize)]
struct DownloadRequest {
    url: String,
    flags: Option<WgetFlags>,
    save_path: Option<String>,
}

#[derive(Serialize)]
struct DownloadResponse {
    id: String,
}

async fn create_download(
    headers: HeaderMap,
    AxumState(state): AxumState<ApiState>,
    Json(req): Json<DownloadRequest>,
) -> Result<Json<DownloadResponse>, StatusCode> {
    validate_token(&headers, &state.auth)?;
    let id = state.app_state.download_manager
        .start_download(req.url, req.flags.unwrap_or_default(), req.save_path)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(DownloadResponse { id }))
}

async fn get_downloads(
    headers: HeaderMap,
    AxumState(state): AxumState<ApiState>,
) -> Result<Json<Vec<crate::db::Download>>, StatusCode> {
    validate_token(&headers, &state.auth)?;
    state.app_state.download_manager
        .list_downloads()
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn get_download_by_id(
    headers: HeaderMap,
    AxumState(state): AxumState<ApiState>,
    Path(id): Path<String>,
) -> Result<Json<Option<crate::db::Download>>, StatusCode> {
    validate_token(&headers, &state.auth)?;
    state.app_state.download_manager
        .get_download(&id)
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn delete_download_by_id(
    headers: HeaderMap,
    AxumState(state): AxumState<ApiState>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    validate_token(&headers, &state.auth)?;
    // Try to cancel if active, ignore errors (may already be finished)
    let _ = state.app_state.download_manager.cancel_download(&id).await;
    state.app_state.download_manager
        .delete_download(&id)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn pause_download(
    headers: HeaderMap,
    AxumState(state): AxumState<ApiState>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    validate_token(&headers, &state.auth)?;
    state.app_state.download_manager
        .pause_download(&id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::OK)
}

async fn resume_download(
    headers: HeaderMap,
    AxumState(state): AxumState<ApiState>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    validate_token(&headers, &state.auth)?;
    state.app_state.download_manager
        .resume_download(&id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::OK)
}

async fn get_settings(
    headers: HeaderMap,
    AxumState(state): AxumState<ApiState>,
) -> Result<Json<crate::settings::AppSettings>, StatusCode> {
    validate_token(&headers, &state.auth)?;
    crate::settings::get_settings(&state.app_state.db)
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn update_settings(
    headers: HeaderMap,
    AxumState(state): AxumState<ApiState>,
    Json(new_settings): Json<crate::settings::AppSettings>,
) -> Result<StatusCode, StatusCode> {
    validate_token(&headers, &state.auth)?;
    crate::settings::update_settings(&state.app_state.db, &new_settings)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::OK)
}

#[derive(Deserialize)]
struct ClipRequest {
    url: String,
    html: Option<String>,
}

async fn clip_page(
    headers: HeaderMap,
    AxumState(state): AxumState<ApiState>,
    Json(req): Json<ClipRequest>,
) -> Result<Json<crate::db::Clip>, StatusCode> {
    validate_token(&headers, &state.auth)?;

    // Get the HTML — either provided or fetched
    let raw_html = match req.html {
        Some(html) => html,
        None => crate::clipper::fetch_page(&req.url).await
            .map_err(|_| StatusCode::BAD_GATEWAY)?,
    };

    // Extract readable content
    let content = crate::clipper::extract_readable(&raw_html, &req.url)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Convert to Markdown
    let md_output = crate::markdown::html_to_markdown(
        &content, &req.url,
        &crate::markdown::MarkdownOptions {
            include_frontmatter: true,
            include_images: true,
            image_download_path: None,
        },
    );

    // Save to DB
    let clip = crate::db::Clip {
        id: uuid::Uuid::new_v4().to_string(),
        url: req.url,
        title: Some(content.title),
        markdown: Some(format!("{}{}", md_output.frontmatter, md_output.body)),
        html: Some(raw_html),
        summary: None,
        tags: "[]".to_string(),
        source_type: "clip".to_string(),
        vault_path: None,
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: None,
    };

    state.app_state.db.insert_clip(&clip)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(clip))
}
