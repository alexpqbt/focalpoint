use axum::Router;
use axum::routing::get;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade, CloseFrame};
use axum::extract::{Path, State};
use axum::response::IntoResponse;
use futures_util::stream::{StreamExt, SplitStream};
use tracing::{info, debug, error};

use crate::error::Error;
use crate::state::{ RoomState, AppState};
use crate::signal::SignalMessage;

type RouteResult<T> = Result<T, Error>;

async fn health_check() -> impl IntoResponse
{
    info!("--> {:<12} - Health Check -" , "HANDLER");

    axum::response::Html("<h1> The server is definitely running </h1>")
}

pub fn app_router(state: AppState) -> Router
{
    Router::new()
        .route("/", get(health_check))
        .route("/ws", get(websocket_handler))
        .with_state(state)
}

async fn websocket_handler(
    ws: WebSocketUpgrade,
) -> impl IntoResponse
{
    ws.on_failed_upgrade(|error| error!("--> {:<12} - An error has occured! - {error}", "HANDLER"))
        .on_upgrade(|socket|handle_socket(socket)) 
}

async fn handle_socket(mut socket: WebSocket)
{

    while let Some(msg) = socket.recv().await
    {
        if let Ok(msg) = msg 
        {
            match msg 
            {
                Message::Text(utf8_bytes) =>
                {
                    info!("Text received: {utf8_bytes}");
                    let result = socket
                        .send(Message::Text(
                            format!("Echo back text: {utf8_bytes}").into(),
                        ))
                        .await;

                    if let Err(error) = result
                    {
                        info!("Error sending text! {error}");
                        send_close_message(&mut socket, 1011, &format!("Error has occured! {error}"))
                            .await;

                        break;
                    }
                },

                Message::Binary(bytes) => 
                {
                    info!("Received bytes of length: {}", bytes.len());

                    let result = socket
                        .send(Message::Text(
                            format!("Received bytes of length: {}", bytes.len()).into(),
                        ))
                        .await;
                    
                    if let Err(error) = result
                    {
                        info!("Error sending: {error}");
                        send_close_message(&mut socket, 1011, &format!("Error has occured! {error}"))
                            .await;

                        break;
                    }
                },

                _ => {}
            }
        }
        else
        {
            let error = msg.err().unwrap();
            info!("Error receiving message: {:?}", error);
            send_close_message(&mut socket, 1011, &format!("Error has occured! {error}"));
            break;
        }
    }
}

async fn send_close_message(socket: &mut WebSocket, code: u16, reason: &str)
{
    _ = socket
        .send(Message::Close(Some(CloseFrame 
        {
            code: code,
            reason: reason.into()
        })))
        .await;
}






