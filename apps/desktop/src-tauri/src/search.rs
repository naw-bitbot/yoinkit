use serde::Serialize;
use tantivy::{
    collector::TopDocs,
    doc,
    query::QueryParser,
    schema::*,
    Index, IndexReader, IndexWriter, TantivyDocument,
};
use std::sync::Mutex;
use std::path::Path;

#[derive(Debug, Serialize)]
pub struct SearchResult {
    pub id: String,
    pub content_type: String,  // "clip", "download", "archive"
    pub title: String,
    pub snippet: String,
    pub url: String,
    pub score: f32,
    pub created_at: String,
}

pub struct SearchEngine {
    index: Index,
    reader: IndexReader,
    writer: Mutex<IndexWriter>,
    schema: Schema,
}

impl SearchEngine {
    pub fn new(index_path: &str) -> Result<Self, String> {
        let path = Path::new(index_path);
        std::fs::create_dir_all(path).map_err(|e| e.to_string())?;

        // Build schema
        let mut schema_builder = Schema::builder();
        schema_builder.add_text_field("id", STRING | STORED);
        schema_builder.add_text_field("content_type", STRING | STORED);
        schema_builder.add_text_field("title", TEXT | STORED);
        schema_builder.add_text_field("body", TEXT);
        schema_builder.add_text_field("url", STRING | STORED);
        schema_builder.add_text_field("tags", TEXT | STORED);
        schema_builder.add_text_field("created_at", STRING | STORED);
        let schema = schema_builder.build();

        // Open or create index
        let index = if path.join("meta.json").exists() {
            Index::open_in_dir(path).map_err(|e| {
                // On corruption, delete and recreate
                let _ = std::fs::remove_dir_all(path);
                let _ = std::fs::create_dir_all(path);
                e.to_string()
            }).unwrap_or_else(|_| {
                Index::create_in_dir(path, schema.clone()).unwrap()
            })
        } else {
            Index::create_in_dir(path, schema.clone()).map_err(|e| e.to_string())?
        };

        let reader = index.reader().map_err(|e| e.to_string())?;
        let writer = index.writer(50_000_000).map_err(|e| e.to_string())?; // 50MB heap

        Ok(Self {
            index,
            reader,
            writer: Mutex::new(writer),
            schema,
        })
    }

    pub fn index_clip(&self, clip: &crate::db::Clip) -> Result<(), String> {
        let mut writer = self.writer.lock().unwrap();
        let id = self.schema.get_field("id").unwrap();
        let content_type = self.schema.get_field("content_type").unwrap();
        let title_field = self.schema.get_field("title").unwrap();
        let body = self.schema.get_field("body").unwrap();
        let url = self.schema.get_field("url").unwrap();
        let tags = self.schema.get_field("tags").unwrap();
        let created_at = self.schema.get_field("created_at").unwrap();

        // Delete existing doc with same id first
        let id_term = tantivy::Term::from_field_text(id, &clip.id);
        writer.delete_term(id_term);

        writer.add_document(doc!(
            id => clip.id.as_str(),
            content_type => clip.source_type.as_str(),
            title_field => clip.title.as_deref().unwrap_or(""),
            body => clip.markdown.as_deref().unwrap_or(""),
            url => clip.url.as_str(),
            tags => clip.tags.as_str(),
            created_at => clip.created_at.as_str(),
        )).map_err(|e| e.to_string())?;

        writer.commit().map_err(|e| e.to_string())?;
        self.reader.reload().map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn index_download(&self, download: &crate::db::Download) -> Result<(), String> {
        let mut writer = self.writer.lock().unwrap();
        let id = self.schema.get_field("id").unwrap();
        let content_type = self.schema.get_field("content_type").unwrap();
        let title_field = self.schema.get_field("title").unwrap();
        let body = self.schema.get_field("body").unwrap();
        let url = self.schema.get_field("url").unwrap();
        let tags = self.schema.get_field("tags").unwrap();
        let created_at = self.schema.get_field("created_at").unwrap();

        let id_term = tantivy::Term::from_field_text(id, &download.id);
        writer.delete_term(id_term);

        // Use filename from save_path as title
        let file_title = std::path::Path::new(&download.save_path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| download.url.clone());

        writer.add_document(doc!(
            id => download.id.as_str(),
            content_type => "download",
            title_field => file_title.as_str(),
            body => "",
            url => download.url.as_str(),
            tags => "",
            created_at => download.created_at.as_str(),
        )).map_err(|e| e.to_string())?;

        writer.commit().map_err(|e| e.to_string())?;
        self.reader.reload().map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn search(&self, query_str: &str, limit: usize) -> Result<Vec<SearchResult>, String> {
        let searcher = self.reader.searcher();
        let title_field = self.schema.get_field("title").unwrap();
        let body_field = self.schema.get_field("body").unwrap();
        let url_field = self.schema.get_field("url").unwrap();
        let tags_field = self.schema.get_field("tags").unwrap();

        let query_parser = QueryParser::for_index(
            &self.index,
            vec![title_field, body_field, url_field, tags_field],
        );

        let query = query_parser.parse_query(query_str)
            .map_err(|e| e.to_string())?;

        let top_docs = searcher.search(&query, &TopDocs::with_limit(limit))
            .map_err(|e| e.to_string())?;

        let id_field = self.schema.get_field("id").unwrap();
        let content_type_field = self.schema.get_field("content_type").unwrap();
        let created_at_field = self.schema.get_field("created_at").unwrap();

        let mut results = Vec::new();
        for (score, doc_address) in top_docs {
            let doc: TantivyDocument = searcher.doc(doc_address).map_err(|e| e.to_string())?;

            let get_text = |field: Field| -> String {
                doc.get_first(field)
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string()
            };

            // Create a snippet from the body
            let body_text = get_text(body_field);
            let snippet = if body_text.len() > 200 {
                format!("{}...", &body_text[..200])
            } else {
                body_text
            };

            results.push(SearchResult {
                id: get_text(id_field),
                content_type: get_text(content_type_field),
                title: get_text(title_field),
                snippet,
                url: get_text(url_field),
                score,
                created_at: get_text(created_at_field),
            });
        }

        Ok(results)
    }

    pub fn rebuild_index(&self, clips: &[crate::db::Clip], downloads: &[crate::db::Download]) -> Result<(), String> {
        {
            let mut writer = self.writer.lock().unwrap();
            writer.delete_all_documents().map_err(|e| e.to_string())?;
            writer.commit().map_err(|e| e.to_string())?;
        }

        for clip in clips {
            self.index_clip(clip)?;
        }
        for download in downloads {
            self.index_download(download)?;
        }

        Ok(())
    }
}
