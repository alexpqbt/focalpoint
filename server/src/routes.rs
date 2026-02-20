use axum::Router;
use axum::routing::get;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade, CloseFrame};
use axum::extract::{Path, State};
use axum::response::IntoResponse;
use tokio::sync::mpsc;
use futures_util::{SinkExt, StreamExt};
use tracing::{info, error};
use uuid::Uuid;
use std::collections::HashMap;

use crate::role::Role;
use crate::peer::Peer;
use crate::state::{ RoomState, AppState};
use crate::signal::SignalMessage;

async fn health_check() -> impl IntoResponse
{
    info!("--> {:<12} - Health Check -" , "HANDLER");

    axum::response::Html("<h1> The server is definitely running </h1>")
}

pub fn app_router(state: AppState) -> Router
{
    Router::new()
        .route("/", get(health_check))
        .route("/ws/{room_id}", get(websocket_handler))
        .with_state(state)
}

async fn websocket_handler(
    ws: WebSocketUpgrade,
    Path(room_id): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse
{
    ws.on_failed_upgrade(|error| error!("--> {:<12} - An error has occured! - {error}", "HANDLER"))
        .on_upgrade(|socket|handle_socket(socket, room_id, state)) 
}

async fn handle_socket(socket: WebSocket, room_id: String, state: AppState)
{
    let (mut ws_sender, mut ws_receiver) = socket.split();
    let peer_id = Uuid::new_v4();

    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();

    tokio::spawn(async move 
    {
        while let Some(msg) = rx.recv().await
        {
            if ws_sender.send(msg).await.is_err()
            {
                break;
            }
        }
    });
    
    let first_msg = match ws_receiver.next().await
    {
        Some(Ok(Message::Text(txt))) => txt,
        _ => 
        {
            error!("Failed to receive message");
            return;
        }
    };
    
    let join_msg: SignalMessage = match serde_json::from_str(&first_msg)
    {
        Ok(SignalMessage::Join {role}) => SignalMessage::Join {role},
        _ =>
        {
            error!("Invalid Join Message");
            return;
        }
    };

    let mut room = state.rooms.entry(room_id.clone()).or_insert_with(|| RoomState
    {
        teacher_id: None,
        peers: HashMap::new(),
    });

    let role = match join_msg
    {
        SignalMessage::Join {role} => role,
        _ => unreachable!(),
    };

    let peer = Peer::new(peer_id, role, tx.clone());
    
    match peer.role
    {
        Role::Teacher => room.teacher_id = Some(peer.clone()),
        Role::Student =>
        {
            room.peers.insert(peer_id.to_string(), peer.clone());
        }
    }

    info!("Peer {:?} Joined Room {:?}", peer_id, room_id);

    while let Some(msg) = ws_receiver.next().await
    {
        match msg
        {
            Ok(Message::Text(txt)) => 
            {
                let signal: SignalMessage = match serde_json::from_str(&txt)
                {
                    Ok(sig) => sig,
                    Err(e) =>
                    {
                        error!("Failed to parse signal! {e}");
                        continue;
                    }
                };

                handle_signal(signal, &peer, &room).await;
            },

            Ok(Message::Close(_)) | Err(_) => 
            {
                break;
            },

            _ => {},
        }
    }

    info!("Peer {:?} disconnected", peer_id);

    match peer.role
    {
        Role::Teacher => 
        {
            if let Some(room) = state.rooms.remove(&room_id) 
            {
                for(_, student_peer) in room.1.peers
                {
                    let _ = student_peer.sender_channel.send(Message::Close(
                        Some(CloseFrame 
                        {
                            code: 1000,
                            reason: "Teacher has left the room".into(),
                        })));
                }
            }
        }
        Role::Student =>
        {
            if let Some(mut room) = state.rooms.get_mut(&room_id)
            {
                room.peers.remove(&peer_id.to_string());
            }
        }
    }
}

async fn handle_signal(signal: SignalMessage, sender_peer: &Peer, room: &RoomState)
{
    match signal
    {
        SignalMessage::Offer {sdp, ..} => 
        {
            if let Some(teacher) = &room.teacher_id
            {
                if let Ok(txt) = serde_json::to_string(&SignalMessage::Offer { sdp, target_id: Some(teacher.id.to_string()) })
                {
                    let _ = teacher.sender_channel.send(Message::Text(txt.into()));
                }
                else
                { 
                    error!("Failed to serialize Signal Message");
                }
            }
        },
    
        SignalMessage::Answer {sdp, target_id: Some(target)} if room.peers.contains_key(&target) => 
        {
            let student = &room.peers[&target];

            if let Ok(txt) = serde_json::to_string(&SignalMessage::Answer { sdp, target_id: Some(sender_peer.id.to_string()) })
            {
                let _ = student.sender_channel.send(Message::Text(txt.into()));
            } 
            else
            { 
                error!("Failed to serialize Signal Message");
            }
        },

        SignalMessage::Ice { candidate, target_id: Some(target) } => 
        {
            let peer = room.teacher_id.as_ref().filter(|teacher| teacher.id.to_string() == target).expect("Peer not found for ICE candidacy");

            if let Ok(txt) = serde_json::to_string(&SignalMessage::Ice { candidate, target_id: Some(sender_peer.id.to_string()), })
            {
                let _ = peer.sender_channel.send(Message::Text(txt.into()));
            }
            else
            {
                error!("Failed to serialize Signal Message");
            }

        },

        _ => {},
    }
}
