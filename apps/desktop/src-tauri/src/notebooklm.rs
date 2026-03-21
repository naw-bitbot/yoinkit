use crate::db::Clip;
use std::fs;

/// Exports a clip as a well-formatted text file ready for NotebookLM import.
pub fn export_for_notebooklm(clip: &Clip, export_dir: &str) -> Result<String, String> {
    let expanded = shellexpand::tilde(export_dir).to_string();
    fs::create_dir_all(&expanded).map_err(|e| format!("Failed to create export dir: {}", e))?;

    let title = clip.title.clone().unwrap_or_else(|| "Untitled".to_string());
    let safe_title: String = title
        .chars()
        .map(|c| if c.is_alphanumeric() || c == ' ' || c == '-' || c == '_' { c } else { '_' })
        .collect::<String>()
        .trim()
        .to_string();
    let safe_title = if safe_title.is_empty() { "untitled".to_string() } else { safe_title };

    let file_name = format!("{}.txt", safe_title);
    let file_path = format!("{}/{}", expanded, file_name);

    let mut content = String::new();
    content.push_str(&format!("# {}\n\n", title));
    content.push_str(&format!("Source: {}\n", clip.url));
    content.push_str(&format!("Date: {}\n\n", clip.created_at));

    if let Some(ref summary) = clip.summary {
        content.push_str(&format!("## Summary\n\n{}\n\n", summary));
    }

    let tags: Vec<String> = serde_json::from_str(&clip.tags).unwrap_or_default();
    if !tags.is_empty() {
        content.push_str(&format!("Tags: {}\n\n", tags.join(", ")));
    }

    if let Some(ref markdown) = clip.markdown {
        content.push_str("---\n\n");
        content.push_str(markdown);
    }

    fs::write(&file_path, &content)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(file_path)
}

/// Export multiple clips as a single combined document for NotebookLM.
pub fn export_batch_for_notebooklm(clips: &[Clip], export_dir: &str, batch_name: &str) -> Result<String, String> {
    let expanded = shellexpand::tilde(export_dir).to_string();
    fs::create_dir_all(&expanded).map_err(|e| format!("Failed to create export dir: {}", e))?;

    let safe_name: String = batch_name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == ' ' || c == '-' || c == '_' { c } else { '_' })
        .collect::<String>()
        .trim()
        .to_string();
    let safe_name = if safe_name.is_empty() { "batch_export".to_string() } else { safe_name };

    let file_path = format!("{}/{}.txt", expanded, safe_name);

    let mut content = String::new();
    content.push_str(&format!("# {}\n\n", batch_name));
    content.push_str(&format!("Exported {} items from Yoinkit\n\n", clips.len()));
    content.push_str("---\n\n");

    for (i, clip) in clips.iter().enumerate() {
        let title = clip.title.as_deref().unwrap_or("Untitled");
        content.push_str(&format!("## {}. {}\n\n", i + 1, title));
        content.push_str(&format!("Source: {}\n", clip.url));
        content.push_str(&format!("Date: {}\n\n", clip.created_at));

        if let Some(ref summary) = clip.summary {
            content.push_str(&format!("**Summary:** {}\n\n", summary));
        }

        if let Some(ref markdown) = clip.markdown {
            content.push_str(markdown);
            content.push_str("\n\n");
        }

        content.push_str("---\n\n");
    }

    fs::write(&file_path, &content)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(file_path)
}
