use rand::Rng;
use std::sync::Mutex;

pub struct AuthManager {
    token: Mutex<String>,
}

impl AuthManager {
    pub fn new() -> Self {
        let token = Self::generate_token();
        Self { token: Mutex::new(token) }
    }

    fn generate_token() -> String {
        let mut rng = rand::thread_rng();
        let bytes: Vec<u8> = (0..32).map(|_| rng.gen()).collect();
        hex::encode(bytes)
    }

    pub fn get_token(&self) -> String {
        self.token.lock().unwrap().clone()
    }

    pub fn validate(&self, token: &str) -> bool {
        let current = self.token.lock().unwrap();
        *current == token
    }

    pub fn regenerate(&self) -> String {
        let new_token = Self::generate_token();
        let mut current = self.token.lock().unwrap();
        *current = new_token.clone();
        new_token
    }
}
