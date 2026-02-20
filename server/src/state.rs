use std::sync::Arc;
use dashmap::DashMap;
use std::collections::HashMap;

use crate::peer::Peer;

#[derive(Clone)]
pub struct RoomState 
{
    pub teacher_id: Option<Peer>,
    pub peers: HashMap<String, Peer>,
}

#[derive(Clone)]
pub struct AppState 
{
    pub rooms: Arc<DashMap<String, RoomState>>
}

impl AppState
{
    pub fn new() -> Self 
    {
        Self 
        {
            rooms: Arc::new(DashMap::new())
        }
    }
}
