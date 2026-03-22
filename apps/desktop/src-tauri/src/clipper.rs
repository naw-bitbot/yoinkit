use scraper::{Html, Selector};

pub struct ExtractedContent {
    pub title: String,
    pub content_html: String,
    pub author: Option<String>,
    pub date: Option<String>,
    pub description: Option<String>,
    pub site_name: Option<String>,
    pub image: Option<String>,
}

/// Fetch a URL with retries, returning the raw HTML body.
pub async fn fetch_page(url: &str) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let mut last_err = String::new();
    for attempt in 0u32..3 {
        if attempt > 0 {
            tokio::time::sleep(std::time::Duration::from_millis(500 * 2u64.pow(attempt))).await;
        }
        match client.get(url).send().await {
            Ok(resp) => return resp.text().await.map_err(|e| e.to_string()),
            Err(e) => last_err = e.to_string(),
        }
    }
    Err(last_err)
}

/// Extract readable content and metadata from raw HTML.
pub fn extract_readable(html: &str, _url: &str) -> Result<ExtractedContent, String> {
    let document = Html::parse_document(html);

    // ── Metadata extraction ──────────────────────────────────────────────────

    // og:title, og:description, og:image, og:site_name
    let og_title = meta_property(&document, "og:title");
    let og_description = meta_property(&document, "og:description");
    let og_image = meta_property(&document, "og:image");
    let og_site_name = meta_property(&document, "og:site_name");

    // article:author, article:published_time
    let article_author = meta_property(&document, "article:author");
    let article_date = meta_property(&document, "article:published_time");

    // <meta name="author"> and <meta name="description">
    let meta_author = meta_name(&document, "author");
    let meta_description = meta_name(&document, "description");

    // <title> tag text
    let page_title = element_text(&document, "title");

    // First <h1> text
    let h1_title = element_text(&document, "h1");

    // Title priority: og:title > <title> > first <h1>
    let title = og_title
        .or(page_title)
        .or(h1_title)
        .unwrap_or_else(|| "Untitled".to_string());

    let author = article_author.or(meta_author);
    let date = article_date;
    let description = og_description.or(meta_description);
    let site_name = og_site_name;
    let image = og_image;

    // ── Content extraction ───────────────────────────────────────────────────

    // Tags whose entire subtree should be stripped before we look for content.
    let strip_tags = [
        "script", "style", "nav", "footer", "aside", "header", "form",
        "iframe", "noscript",
    ];

    // Candidate selectors for the main content container, in priority order.
    // We try each in turn and use the first one that matches.
    let content_selectors = [
        "article",
        "main",
        "[role=\"main\"]",
        ".post-content",
        ".article-content",
        ".entry-content",
        ".content",
        ".post-body",
        ".article-body",
        "#content",
        "#main",
        "body",
    ];

    // Re-parse to get a clean document we can manipulate as a string.
    // scraper does not support in-place DOM mutation, so we:
    //  1. Find the best content container.
    //  2. Serialize its inner HTML.
    //  3. Strip unwanted elements from that serialised string via a second parse.

    // Find the best matching container element.
    let content_html_raw = find_main_content(&document, &content_selectors);

    // Strip non-content elements from the candidate HTML.
    let content_html = strip_elements(&content_html_raw, &strip_tags);

    Ok(ExtractedContent {
        title,
        content_html,
        author,
        date,
        description,
        site_name,
        image,
    })
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/// Return the `content` attribute of the first `<meta property="…">` tag.
fn meta_property(document: &Html, property: &str) -> Option<String> {
    // Selector: meta[property="<property>"]
    let selector_str = format!("meta[property=\"{}\"]", property);
    let sel = Selector::parse(&selector_str).ok()?;
    document
        .select(&sel)
        .next()
        .and_then(|el| el.value().attr("content"))
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

/// Return the `content` attribute of the first `<meta name="…">` tag.
fn meta_name(document: &Html, name: &str) -> Option<String> {
    let selector_str = format!("meta[name=\"{}\"]", name);
    let sel = Selector::parse(&selector_str).ok()?;
    document
        .select(&sel)
        .next()
        .and_then(|el| el.value().attr("content"))
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

/// Return the trimmed text content of the first matching element.
fn element_text(document: &Html, selector_str: &str) -> Option<String> {
    let sel = Selector::parse(selector_str).ok()?;
    let text: String = document
        .select(&sel)
        .next()?
        .text()
        .collect::<Vec<_>>()
        .join(" ");
    let trimmed = text.trim().to_string();
    if trimmed.is_empty() { None } else { Some(trimmed) }
}

/// Serialise the inner HTML of a scraper element reference.
///
/// scraper exposes `.inner_html()` directly on `ElementRef` — this thin
/// wrapper just calls it.
fn inner_html_of(el: scraper::ElementRef<'_>) -> String {
    el.inner_html()
}

/// Walk through candidate selectors in order and return the inner HTML of the
/// first element found.  Falls back to an empty string if nothing matches.
fn find_main_content(document: &Html, selectors: &[&str]) -> String {
    for &selector_str in selectors {
        if let Ok(sel) = Selector::parse(selector_str) {
            if let Some(el) = document.select(&sel).next() {
                let html = inner_html_of(el);
                // Prefer containers that have some non-trivial text content.
                // A bare <body> with no real text should still be returned as
                // a last resort, but we keep walking if it is nearly empty.
                if !html.trim().is_empty() {
                    return html;
                }
            }
        }
    }
    String::new()
}

/// Re-parse the HTML fragment and rebuild it without the listed tag names.
/// This works by serialising only the nodes that are NOT in the strip list and
/// are not descendants of a stripped node.
fn strip_elements(html: &str, tags: &[&str]) -> String {
    // Wrap in a div so scraper treats it as a fragment.
    let wrapped = format!("<div id=\"__clipper_root__\">{}</div>", html);
    let fragment = Html::parse_fragment(&wrapped);

    let root_sel = Selector::parse("#__clipper_root__").unwrap();
    let root = match fragment.select(&root_sel).next() {
        Some(r) => r,
        None => return html.to_string(),
    };

    // Recursively serialise, skipping stripped tags.
    let mut out = String::new();
    serialize_children(root, tags, &mut out);
    out
}

/// Recursively walk the element tree and write clean HTML into `out`,
/// skipping any element whose tag name is in `strip_tags`.
fn serialize_children(el: scraper::ElementRef<'_>, strip_tags: &[&str], out: &mut String) {
    use scraper::node::Node;

    for child in el.children() {
        match child.value() {
            Node::Text(text) => {
                out.push_str(&escape_html(text));
            }
            Node::Element(elem) => {
                let tag = elem.name().to_lowercase();
                if strip_tags.contains(&tag.as_str()) {
                    // Skip this element and all its descendants.
                    continue;
                }

                // Open tag with attributes.
                out.push('<');
                out.push_str(&tag);

                // Keep only safe / meaningful attributes.
                for (attr_name, attr_val) in elem.attrs() {
                    if should_keep_attr(attr_name, &tag) {
                        out.push(' ');
                        out.push_str(attr_name);
                        out.push_str("=\"");
                        out.push_str(&escape_attr(attr_val));
                        out.push('"');
                    }
                }

                // Void elements.
                if is_void_element(&tag) {
                    out.push_str(" />");
                    continue;
                }

                out.push('>');

                // Recurse into children.
                if let Some(child_ref) = scraper::ElementRef::wrap(child) {
                    serialize_children(child_ref, strip_tags, out);
                }

                out.push_str("</");
                out.push_str(&tag);
                out.push('>');
            }
            _ => {} // comments, processing instructions, etc.
        }
    }
}

/// Attributes we are willing to keep for each tag family.
fn should_keep_attr(attr: &str, tag: &str) -> bool {
    // Always keep these on any element.
    let universal = ["id", "class", "lang", "dir"];
    if universal.contains(&attr) {
        return true;
    }
    match tag {
        "a" => matches!(attr, "href" | "title" | "rel"),
        "img" => matches!(attr, "src" | "alt" | "width" | "height" | "loading"),
        "source" => matches!(attr, "src" | "srcset" | "type" | "media"),
        "picture" => false,
        "video" | "audio" => matches!(attr, "src" | "controls" | "width" | "height"),
        "ol" | "ul" => matches!(attr, "type" | "start"),
        "li" => matches!(attr, "value"),
        "table" | "th" | "td" => matches!(attr, "colspan" | "rowspan" | "scope"),
        "blockquote" => matches!(attr, "cite"),
        "time" => matches!(attr, "datetime"),
        "code" | "pre" => matches!(attr, "class"), // language class
        "h1" | "h2" | "h3" | "h4" | "h5" | "h6" => false,
        _ => false,
    }
}

/// HTML void elements that must not have a closing tag.
fn is_void_element(tag: &str) -> bool {
    matches!(
        tag,
        "area" | "base" | "br" | "col" | "embed" | "hr" | "img" | "input"
            | "link" | "meta" | "param" | "source" | "track" | "wbr"
    )
}

fn escape_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

fn escape_attr(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('"', "&quot;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}
