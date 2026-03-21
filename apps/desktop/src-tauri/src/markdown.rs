use scraper::{Html, Selector, ElementRef};
use scraper::node::Node;
use crate::clipper::ExtractedContent;

// ── Public types ─────────────────────────────────────────────────────────────

pub struct MarkdownOptions {
    pub include_frontmatter: bool,
    pub include_images: bool,
    pub image_download_path: Option<String>,
}

pub struct MarkdownOutput {
    pub frontmatter: String,
    pub body: String,
    pub images: Vec<String>,
}

// ── Entry point ───────────────────────────────────────────────────────────────

/// Convert `ExtractedContent` to a `MarkdownOutput`.
///
/// `url` is the canonical page URL recorded in the YAML frontmatter.
pub fn html_to_markdown(
    content: &ExtractedContent,
    url: &str,
    options: &MarkdownOptions,
) -> MarkdownOutput {
    // Build YAML frontmatter.
    let mut frontmatter = String::new();
    if options.include_frontmatter {
        frontmatter.push_str("---\n");
        frontmatter.push_str(&format!(
            "title: \"{}\"\n",
            escape_yaml_string(&content.title)
        ));
        frontmatter.push_str(&format!("source: \"{}\"\n", url));
        frontmatter.push_str(&format!(
            "date: \"{}\"\n",
            chrono::Utc::now().format("%Y-%m-%d")
        ));
        if let Some(author) = &content.author {
            frontmatter.push_str(&format!("author: \"{}\"\n", escape_yaml_string(author)));
        }
        if let Some(description) = &content.description {
            frontmatter.push_str(&format!(
                "description: \"{}\"\n",
                escape_yaml_string(description)
            ));
        }
        if let Some(site) = &content.site_name {
            frontmatter.push_str(&format!("site: \"{}\"\n", escape_yaml_string(site)));
        }
        frontmatter.push_str("tags: []\n");
        frontmatter.push_str("---\n\n");
    }

    // Collect state that we thread through the conversion.
    let mut state = ConversionState::default();

    // Wrap content in a div so scraper treats it as a rooted fragment.
    let wrapped = format!("<div id=\"__md_root__\">{}</div>", content.content_html);
    let fragment = Html::parse_fragment(&wrapped);

    let root_sel = Selector::parse("#__md_root__").unwrap();
    let body = if let Some(root) = fragment.select(&root_sel).next() {
        let raw = convert_children(root, &mut state, Context::Block);
        normalize_blank_lines(&raw)
    } else {
        String::new()
    };

    let mut images = state.images;
    if !options.include_images {
        images.clear();
    }

    MarkdownOutput {
        frontmatter,
        body,
        images,
    }
}

// ── Conversion context ────────────────────────────────────────────────────────

/// Whether we are currently inside an inline context (e.g. inside a paragraph)
/// or a block context (direct children of a block container).
#[derive(Clone, Copy, PartialEq)]
enum Context {
    Block,
    Inline,
}

/// Mutable state threaded through the recursive walk.
#[derive(Default)]
struct ConversionState {
    images: Vec<String>,
}

// ── Core recursive converter ──────────────────────────────────────────────────

/// Convert all children of `el` to a Markdown string.
fn convert_children(el: ElementRef<'_>, state: &mut ConversionState, ctx: Context) -> String {
    let mut out = String::new();
    for child in el.children() {
        match child.value() {
            Node::Text(text) => {
                let t = text.as_ref();
                if ctx == Context::Block && t.trim().is_empty() {
                    continue;
                }
                out.push_str(&collapse_whitespace(t));
            }
            Node::Element(_) => {
                if let Some(el_ref) = ElementRef::wrap(child) {
                    out.push_str(&convert_element(el_ref, state, ctx));
                }
            }
            _ => {}
        }
    }
    out
}

/// Convert a single element to Markdown.
fn convert_element(el: ElementRef<'_>, state: &mut ConversionState, ctx: Context) -> String {
    let tag = el.value().name().to_lowercase();

    match tag.as_str() {
        // ── Headings ──────────────────────────────────────────────────────────
        "h1" | "h2" | "h3" | "h4" | "h5" | "h6" => {
            let level = tag[1..].parse::<usize>().unwrap_or(1);
            let prefix = "#".repeat(level);
            let inner = convert_children(el, state, Context::Inline).trim().to_string();
            if inner.is_empty() {
                return String::new();
            }
            format!("\n\n{} {}\n\n", prefix, inner)
        }

        // ── Paragraph ─────────────────────────────────────────────────────────
        "p" => {
            let inner = convert_children(el, state, Context::Inline).trim().to_string();
            if inner.is_empty() {
                return String::new();
            }
            format!("\n\n{}\n\n", inner)
        }

        // ── Line break ────────────────────────────────────────────────────────
        "br" => "  \n".to_string(),

        // ── Horizontal rule ───────────────────────────────────────────────────
        "hr" => "\n\n---\n\n".to_string(),

        // ── Links ─────────────────────────────────────────────────────────────
        "a" => {
            let href = el.value().attr("href").unwrap_or("").trim().to_string();
            let inner = convert_children(el, state, Context::Inline).trim().to_string();
            let text = if inner.is_empty() { href.clone() } else { inner };
            if href.is_empty() {
                text
            } else {
                format!("[{}]({})", text, href)
            }
        }

        // ── Images ────────────────────────────────────────────────────────────
        "img" => {
            let src = el.value().attr("src").unwrap_or("").trim().to_string();
            let alt = el.value().attr("alt").unwrap_or("").trim().to_string();
            if src.is_empty() {
                return String::new();
            }
            if !src.starts_with("data:") {
                state.images.push(src.clone());
            }
            format!("![{}]({})", alt, src)
        }

        // ── Bold ──────────────────────────────────────────────────────────────
        "strong" | "b" => {
            let inner = convert_children(el, state, Context::Inline).trim().to_string();
            if inner.is_empty() {
                return String::new();
            }
            format!("**{}**", inner)
        }

        // ── Italic ────────────────────────────────────────────────────────────
        "em" | "i" => {
            let inner = convert_children(el, state, Context::Inline).trim().to_string();
            if inner.is_empty() {
                return String::new();
            }
            format!("*{}*", inner)
        }

        // ── Strikethrough ─────────────────────────────────────────────────────
        "del" | "s" | "strike" => {
            let inner = convert_children(el, state, Context::Inline).trim().to_string();
            if inner.is_empty() {
                return String::new();
            }
            format!("~~{}~~", inner)
        }

        // ── Inline code ───────────────────────────────────────────────────────
        // Note: if the parent is <pre>, the "pre" arm renders the full block
        // including this <code> child via collect_raw_text, so we would only
        // reach here for a bare <code> outside of <pre>.
        "code" => {
            let inner = collect_raw_text(el);
            if inner.is_empty() {
                return String::new();
            }
            if inner.contains('`') {
                format!("`` {} ``", inner)
            } else {
                format!("`{}`", inner)
            }
        }

        // ── Code block ────────────────────────────────────────────────────────
        "pre" => {
            let lang = detect_code_language(el);
            let inner = collect_raw_text(el);
            let code = inner.trim_end_matches('\n');
            format!("\n\n```{}\n{}\n```\n\n", lang, code)
        }

        // ── Blockquote ────────────────────────────────────────────────────────
        "blockquote" => {
            let inner = convert_children(el, state, Context::Block);
            let quoted = inner
                .lines()
                .map(|line| {
                    if line.trim().is_empty() {
                        ">".to_string()
                    } else {
                        format!("> {}", line)
                    }
                })
                .collect::<Vec<_>>()
                .join("\n");
            let trimmed = quoted.trim().to_string();
            if trimmed.is_empty() {
                return String::new();
            }
            format!("\n\n{}\n\n", trimmed)
        }

        // ── Unordered list ────────────────────────────────────────────────────
        "ul" => {
            let items = collect_list_items(el, state, false, 0);
            if items.is_empty() {
                return String::new();
            }
            format!("\n\n{}\n\n", items.trim_end())
        }

        // ── Ordered list ──────────────────────────────────────────────────────
        "ol" => {
            let items = collect_list_items(el, state, true, 0);
            if items.is_empty() {
                return String::new();
            }
            format!("\n\n{}\n\n", items.trim_end())
        }

        // ── List item — fallback (normally handled by collect_list_items) ─────
        "li" => convert_children(el, state, Context::Inline),

        // ── Tables ────────────────────────────────────────────────────────────
        "table" => convert_table(el, state),

        // ── Table sections / cells — pass-through (handled in convert_table) ──
        "thead" | "tbody" | "tfoot" | "tr" | "th" | "td" => {
            convert_children(el, state, ctx)
        }

        // ── Definition list ───────────────────────────────────────────────────
        "dl" => {
            let inner = convert_children(el, state, Context::Block);
            format!("\n\n{}\n\n", inner.trim())
        }
        "dt" => {
            let inner = convert_children(el, state, Context::Inline).trim().to_string();
            format!("\n**{}**\n", inner)
        }
        "dd" => {
            let inner = convert_children(el, state, Context::Inline).trim().to_string();
            format!(":   {}\n", inner)
        }

        // ── Figure / figcaption ───────────────────────────────────────────────
        "figure" => {
            let inner = convert_children(el, state, Context::Block);
            let trimmed = inner.trim().to_string();
            if trimmed.is_empty() {
                return String::new();
            }
            format!("\n\n{}\n\n", trimmed)
        }
        "figcaption" => {
            let inner = convert_children(el, state, Context::Inline).trim().to_string();
            if inner.is_empty() {
                return String::new();
            }
            format!("*{}*\n", inner)
        }

        // ── Superscript / subscript ───────────────────────────────────────────
        "sup" => {
            let inner = convert_children(el, state, Context::Inline).trim().to_string();
            format!("^{}^", inner)
        }
        "sub" => {
            let inner = convert_children(el, state, Context::Inline).trim().to_string();
            format!("~{}~", inner)
        }

        // ── Mark / highlight ──────────────────────────────────────────────────
        "mark" => {
            let inner = convert_children(el, state, Context::Inline).trim().to_string();
            format!("=={}==", inner)
        }

        // ── Abbreviation ──────────────────────────────────────────────────────
        "abbr" => {
            let title = el.value().attr("title").unwrap_or("").trim().to_string();
            let inner = convert_children(el, state, Context::Inline).trim().to_string();
            if title.is_empty() {
                inner
            } else {
                format!("{} ({})", inner, title)
            }
        }

        // ── Block containers — recurse transparently ───────────────────────────
        "div" | "section" | "article" | "main" | "header" | "footer" | "aside"
        | "nav" | "details" | "summary" => {
            convert_children(el, state, Context::Block)
        }

        // ── Inline containers — recurse preserving context ────────────────────
        "span" | "label" | "cite" | "q" | "time" | "small" | "big"
        | "bdi" | "bdo" | "wbr" => {
            convert_children(el, state, ctx)
        }

        // ── Skip non-content elements ─────────────────────────────────────────
        "script" | "style" | "noscript" | "iframe" | "form" | "button"
        | "input" | "select" | "textarea" | "svg" | "canvas" | "video"
        | "audio" | "object" | "embed" | "map" | "area" | "picture"
        | "source" | "track" => String::new(),

        // ── Catch-all: recurse preserving context ─────────────────────────────
        _ => convert_children(el, state, ctx),
    }
}

// ── List helpers ──────────────────────────────────────────────────────────────

/// Collect `<li>` children of a `<ul>` or `<ol>` into a Markdown list string.
///
/// `ordered` — true for `<ol>`, false for `<ul>`.
/// `depth`   — nesting depth (0 = top level), used for indentation.
fn collect_list_items(
    el: ElementRef<'_>,
    state: &mut ConversionState,
    ordered: bool,
    depth: usize,
) -> String {
    let indent = "  ".repeat(depth);
    let mut out = String::new();
    let mut index: usize = 1;

    for child in el.children() {
        match child.value() {
            Node::Element(elem) if elem.name() == "li" => {
                if let Some(li_ref) = ElementRef::wrap(child) {
                    let item_md = convert_li(li_ref, state, ordered, index, depth);
                    out.push_str(&format!("{}{}", indent, item_md));
                    index += 1;
                }
            }
            Node::Text(t) if !t.trim().is_empty() => {
                // Text directly inside a list without <li> — treat as an item.
                let text = collapse_whitespace(t.as_ref());
                let bullet = if ordered {
                    format!("{}. ", index)
                } else {
                    "- ".to_string()
                };
                out.push_str(&format!("{}{}{}\n", indent, bullet, text.trim()));
                index += 1;
            }
            _ => {}
        }
    }
    out
}

/// Convert a single `<li>` element to a Markdown list item string.
fn convert_li(
    el: ElementRef<'_>,
    state: &mut ConversionState,
    ordered: bool,
    index: usize,
    depth: usize,
) -> String {
    let bullet = if ordered {
        format!("{}. ", index)
    } else {
        "- ".to_string()
    };

    // Separate direct inline content from nested lists.
    let mut inline_parts: Vec<String> = Vec::new();
    let mut nested: Vec<String> = Vec::new();

    for child in el.children() {
        match child.value() {
            Node::Text(t) => {
                let text = collapse_whitespace(t.as_ref());
                if !text.trim().is_empty() {
                    inline_parts.push(text);
                }
            }
            Node::Element(elem) => {
                let tag = elem.name().to_lowercase();
                if let Some(child_ref) = ElementRef::wrap(child) {
                    match tag.as_str() {
                        "ul" => {
                            nested.push(collect_list_items(
                                child_ref,
                                state,
                                false,
                                depth + 1,
                            ));
                        }
                        "ol" => {
                            nested.push(collect_list_items(
                                child_ref,
                                state,
                                true,
                                depth + 1,
                            ));
                        }
                        "p" => {
                            let text = convert_children(child_ref, state, Context::Inline)
                                .trim()
                                .to_string();
                            if !text.is_empty() {
                                inline_parts.push(text);
                            }
                        }
                        _ => {
                            let text = convert_element(child_ref, state, Context::Inline)
                                .trim()
                                .to_string();
                            if !text.is_empty() {
                                inline_parts.push(text);
                            }
                        }
                    }
                }
            }
            _ => {}
        }
    }

    let main_text = inline_parts.join(" ").trim().to_string();
    let mut result = format!("{}{}\n", bullet, main_text);

    for nest in nested {
        // Each line of the nested list is already indented by collect_list_items;
        // we add one extra indent level here relative to the parent bullet.
        for line in nest.lines() {
            if !line.is_empty() {
                result.push_str("  ");
                result.push_str(line);
                result.push('\n');
            }
        }
    }

    result
}

// ── Table helpers ─────────────────────────────────────────────────────────────

fn convert_table(el: ElementRef<'_>, state: &mut ConversionState) -> String {
    let mut header_rows: Vec<Vec<String>> = Vec::new();
    let mut body_rows: Vec<Vec<String>> = Vec::new();

    for child in el.children() {
        if let Node::Element(elem) = child.value() {
            let tag = elem.name().to_lowercase();
            match tag.as_str() {
                "thead" => {
                    if let Some(section) = ElementRef::wrap(child) {
                        collect_rows(section, state, &mut header_rows);
                    }
                }
                "tbody" | "tfoot" => {
                    if let Some(section) = ElementRef::wrap(child) {
                        collect_rows(section, state, &mut body_rows);
                    }
                }
                "tr" => {
                    if let Some(tr) = ElementRef::wrap(child) {
                        let cells = collect_cells(tr, state);
                        // Before seeing thead/tbody, rows go to body.
                        body_rows.push(cells);
                    }
                }
                _ => {}
            }
        }
    }

    if header_rows.is_empty() && body_rows.is_empty() {
        return String::new();
    }

    // If no thead, promote the first body row to header.
    let (headers, rows) = if !header_rows.is_empty() {
        (header_rows, body_rows)
    } else {
        let mut rows = body_rows;
        let first = if rows.is_empty() { vec![] } else { rows.remove(0) };
        (vec![first], rows)
    };

    let col_count = headers
        .iter()
        .chain(rows.iter())
        .map(|r| r.len())
        .max()
        .unwrap_or(0);

    if col_count == 0 {
        return String::new();
    }

    let mut md = "\n\n".to_string();

    for header_row in &headers {
        let padded = pad_row(header_row, col_count);
        md.push('|');
        for cell in &padded {
            md.push_str(&format!(" {} |", cell));
        }
        md.push('\n');
    }

    // Separator row.
    md.push('|');
    for _ in 0..col_count {
        md.push_str(" --- |");
    }
    md.push('\n');

    for row in &rows {
        let padded = pad_row(row, col_count);
        md.push('|');
        for cell in &padded {
            md.push_str(&format!(" {} |", cell));
        }
        md.push('\n');
    }

    md.push_str("\n\n");
    md
}

fn collect_rows(
    section: ElementRef<'_>,
    state: &mut ConversionState,
    out: &mut Vec<Vec<String>>,
) {
    for child in section.children() {
        if let Node::Element(elem) = child.value() {
            if elem.name() == "tr" {
                if let Some(tr) = ElementRef::wrap(child) {
                    out.push(collect_cells(tr, state));
                }
            }
        }
    }
}

fn collect_cells(tr: ElementRef<'_>, state: &mut ConversionState) -> Vec<String> {
    let mut cells = Vec::new();
    for child in tr.children() {
        if let Node::Element(elem) = child.value() {
            let tag = elem.name();
            if tag == "th" || tag == "td" {
                if let Some(cell) = ElementRef::wrap(child) {
                    let text = convert_children(cell, state, Context::Inline)
                        .trim()
                        .replace('|', "\\|")
                        .to_string();
                    cells.push(text);
                }
            }
        }
    }
    cells
}

fn pad_row(row: &[String], col_count: usize) -> Vec<String> {
    let mut padded = row.to_vec();
    while padded.len() < col_count {
        padded.push(String::new());
    }
    padded
}

// ── Text utilities ────────────────────────────────────────────────────────────

/// Collect all text content inside an element as raw text, preserving
/// whitespace exactly.  Used for `<pre>` and bare `<code>`.
fn collect_raw_text(el: ElementRef<'_>) -> String {
    let mut out = String::new();
    for node in el.descendants() {
        if let Node::Text(t) = node.value() {
            out.push_str(t.as_ref());
        }
    }
    out
}

/// Collapse runs of ASCII whitespace (spaces, tabs, newlines) to a single
/// space, so that inline text is rendered cleanly.
fn collapse_whitespace(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut last_was_space = false;
    for ch in s.chars() {
        if ch == '\n' || ch == '\r' || ch == '\t' || ch == ' ' {
            if !last_was_space {
                result.push(' ');
            }
            last_was_space = true;
        } else {
            result.push(ch);
            last_was_space = false;
        }
    }
    result
}

/// Reduce three or more consecutive blank lines to two (one blank line).
fn normalize_blank_lines(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut consecutive_blank: usize = 0;

    for line in s.lines() {
        if line.trim().is_empty() {
            consecutive_blank += 1;
            if consecutive_blank <= 2 {
                result.push('\n');
            }
        } else {
            consecutive_blank = 0;
            result.push_str(line);
            result.push('\n');
        }
    }

    // Strip leading blank lines.
    let trimmed = result.trim_start_matches('\n').to_string();
    trimmed
}

/// Try to detect the programming language from `<pre><code class="language-X">`.
fn detect_code_language(pre: ElementRef<'_>) -> String {
    for child in pre.children() {
        if let Node::Element(elem) = child.value() {
            if elem.name() == "code" {
                if let Some(class) = elem.attr("class") {
                    for cls in class.split_whitespace() {
                        if let Some(lang) = cls.strip_prefix("language-") {
                            return lang.to_string();
                        }
                        if let Some(lang) = cls.strip_prefix("lang-") {
                            return lang.to_string();
                        }
                    }
                }
            }
        }
    }
    String::new()
}

/// Escape double quotes and backslashes for use inside YAML double-quoted scalars.
fn escape_yaml_string(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn make_content(html: &str) -> ExtractedContent {
        ExtractedContent {
            title: "Test".to_string(),
            content_html: html.to_string(),
            author: None,
            date: None,
            description: None,
            site_name: None,
            image: None,
        }
    }

    fn opts() -> MarkdownOptions {
        MarkdownOptions {
            include_frontmatter: false,
            include_images: true,
            image_download_path: None,
        }
    }

    #[test]
    fn headings() {
        let out = html_to_markdown(
            &make_content("<h1>Hello</h1><h2>World</h2>"),
            "https://x.com",
            &opts(),
        );
        assert!(out.body.contains("# Hello"), "body: {}", out.body);
        assert!(out.body.contains("## World"), "body: {}", out.body);
    }

    #[test]
    fn paragraph() {
        let out = html_to_markdown(
            &make_content("<p>Simple text.</p>"),
            "https://x.com",
            &opts(),
        );
        assert!(out.body.contains("Simple text."), "body: {}", out.body);
    }

    #[test]
    fn link() {
        let out = html_to_markdown(
            &make_content("<p><a href=\"https://rust-lang.org\">Rust</a></p>"),
            "https://x.com",
            &opts(),
        );
        assert!(
            out.body.contains("[Rust](https://rust-lang.org)"),
            "body: {}",
            out.body
        );
    }

    #[test]
    fn bold_italic() {
        let out = html_to_markdown(
            &make_content("<p><strong>bold</strong> and <em>italic</em></p>"),
            "https://x.com",
            &opts(),
        );
        assert!(out.body.contains("**bold**"), "body: {}", out.body);
        assert!(out.body.contains("*italic*"), "body: {}", out.body);
    }

    #[test]
    fn unordered_list() {
        let out = html_to_markdown(
            &make_content("<ul><li>A</li><li>B</li></ul>"),
            "https://x.com",
            &opts(),
        );
        assert!(out.body.contains("- A"), "body: {}", out.body);
        assert!(out.body.contains("- B"), "body: {}", out.body);
    }

    #[test]
    fn ordered_list() {
        let out = html_to_markdown(
            &make_content("<ol><li>First</li><li>Second</li></ol>"),
            "https://x.com",
            &opts(),
        );
        assert!(out.body.contains("1. First"), "body: {}", out.body);
        assert!(out.body.contains("2. Second"), "body: {}", out.body);
    }

    #[test]
    fn image_collected() {
        let out = html_to_markdown(
            &make_content("<img src=\"https://example.com/pic.png\" alt=\"pic\" />"),
            "https://x.com",
            &opts(),
        );
        assert_eq!(out.images, vec!["https://example.com/pic.png"]);
        assert!(
            out.body.contains("![pic](https://example.com/pic.png)"),
            "body: {}",
            out.body
        );
    }

    #[test]
    fn code_block() {
        let out = html_to_markdown(
            &make_content("<pre><code class=\"language-rust\">fn main() {}</code></pre>"),
            "https://x.com",
            &opts(),
        );
        assert!(out.body.contains("```rust"), "body: {}", out.body);
        assert!(out.body.contains("fn main() {}"), "body: {}", out.body);
    }

    #[test]
    fn blockquote() {
        let out = html_to_markdown(
            &make_content("<blockquote><p>Wise words.</p></blockquote>"),
            "https://x.com",
            &opts(),
        );
        assert!(out.body.contains("> Wise words."), "body: {}", out.body);
    }

    #[test]
    fn table() {
        let html = "<table><thead><tr><th>Name</th><th>Age</th></tr></thead>\
                    <tbody><tr><td>Alice</td><td>30</td></tr></tbody></table>";
        let out = html_to_markdown(&make_content(html), "https://x.com", &opts());
        assert!(out.body.contains("| Name |"), "body: {}", out.body);
        assert!(out.body.contains("| --- |"), "body: {}", out.body);
        assert!(out.body.contains("| Alice |"), "body: {}", out.body);
    }

    #[test]
    fn frontmatter_included() {
        let o = MarkdownOptions {
            include_frontmatter: true,
            include_images: true,
            image_download_path: None,
        };
        let content = ExtractedContent {
            title: "My Page".to_string(),
            content_html: "<p>Hello</p>".to_string(),
            author: Some("Alice".to_string()),
            date: None,
            description: None,
            site_name: None,
            image: None,
        };
        let out = html_to_markdown(&content, "https://example.com/page", &o);
        assert!(out.frontmatter.contains("title: \"My Page\""), "fm: {}", out.frontmatter);
        assert!(out.frontmatter.contains("author: \"Alice\""), "fm: {}", out.frontmatter);
        assert!(
            out.frontmatter.contains("source: \"https://example.com/page\""),
            "fm: {}",
            out.frontmatter
        );
    }

    #[test]
    fn nested_list() {
        let html =
            "<ul><li>A<ul><li>A1</li><li>A2</li></ul></li><li>B</li></ul>";
        let out = html_to_markdown(&make_content(html), "https://x.com", &opts());
        assert!(out.body.contains("- A"), "body: {}", out.body);
        assert!(out.body.contains("- B"), "body: {}", out.body);
        assert!(out.body.contains("A1"), "body: {}", out.body);
        assert!(out.body.contains("A2"), "body: {}", out.body);
    }

    #[test]
    fn bold_inside_link() {
        let out = html_to_markdown(
            &make_content("<p><a href=\"https://x.com\"><strong>Click</strong></a></p>"),
            "https://x.com",
            &opts(),
        );
        assert!(
            out.body.contains("[**Click**](https://x.com)"),
            "body: {}",
            out.body
        );
    }

    #[test]
    fn images_excluded_when_option_off() {
        let o = MarkdownOptions {
            include_frontmatter: false,
            include_images: false,
            image_download_path: None,
        };
        let out = html_to_markdown(
            &make_content("<img src=\"https://example.com/pic.png\" alt=\"pic\" />"),
            "https://x.com",
            &o,
        );
        // Body still has the markdown image syntax (we don't suppress the tag,
        // only the collected URL list).
        assert!(out.images.is_empty(), "images should be empty");
    }

    #[test]
    fn data_uri_image_not_collected() {
        let out = html_to_markdown(
            &make_content("<img src=\"data:image/png;base64,abc\" alt=\"\" />"),
            "https://x.com",
            &opts(),
        );
        // data: URIs should not be added to the images list.
        assert!(out.images.is_empty(), "images: {:?}", out.images);
    }
}
