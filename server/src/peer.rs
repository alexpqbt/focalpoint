use uuid::Uuid;
use axum::extract::ws::Message;
use tokio::sync::mpsc;

use crate::role::Role;

#[derive(Debug, Clone)]
pub struct Peer
{
    pub id: Uuid,
    pub role: Role,
    pub sender_channel: mpsc::UnboundedSender<Message>,
}
