use serde::{Deserialize, Serialize};

use crate::role::Role;

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum SignalMessage
{
    #[serde(rename = "join")]
    Join { role: Role },

    #[serde(rename = "offer")]
    Offer { sdp: String, target_id: Option<String> },
    
    #[serde(rename = "answer")]
    Answer { sdp: String, target_id: Option<String> },

    #[serde(rename = "ice-candidate")]
    Ice { candidate: String, target_id: Option<String> },
}
