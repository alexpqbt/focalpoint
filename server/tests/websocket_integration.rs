use tokio_tungstenite::connect_async;
use futures_util::{SinkExt, StreamExt};
use serde_json::json;
use tungstenite::protocol::Message as WsMessage;
use tungstenite::protocol::frame::coding::CloseCode;

#[tokio::test]
async fn test_classroom_websocket_flow()
{
    let room_id = "room1";

    let (mut teacher_ws, _) = connect_async(format!("ws://localhost:6969/ws/{}", room_id))
        .await
        .expect("Failed to connect teacher");

    teacher_ws.send(WsMessage::Text(
        json!({"type": "join", "role": "teacher"}).to_string().into()
    )).await.expect("Failed to send teacher join");

    let (mut student1_ws, _) = connect_async(format!("ws://localhost:6969/ws/{}", room_id))
        .await
        .expect("Failed to connect student1");

    student1_ws.send(WsMessage::Text(
        json!({"type": "join", "role": "student"}).to_string().into()
    )).await.expect("Failed to send student join");

    let student_id = tokio::time::timeout(
        std::time::Duration::from_secs(5),
        teacher_ws.next()
    )
    .await
    .expect("Timed out waiting for peer-joined")
    .expect("Stream closed")
    .expect("WebSocket error");

    let student_id = match student_id
    {
        WsMessage::Text(txt) =>
        {
            let msg: serde_json::Value = serde_json::from_str(&txt).unwrap();
            assert_eq!(msg["type"], "peers-joined");
            msg["peer_id"].as_str().unwrap().to_string()
        },
        _ => panic!("Expected peer_joined notification"),
    };

    let offer_sdp = "v=0 teacher offer";
    teacher_ws.send(WsMessage::Text(json!(
    {
        "type": "offer",
        "sdp": offer_sdp,
        "target_id": student_id,
    }).to_string().into())).await.expect("Failed to send offer");

    let msg = tokio::time::timeout(
        std::time::Duration::from_secs(5),
        student1_ws.next()
    )
    .await
    .expect("Timed out waiting for offer")
    .expect("Stream closed")
    .expect("WebSocket error");

    match msg
    {
        WsMessage::Text(txt) => assert!(txt.contains(offer_sdp), "Student should receive offer"),
        _ => panic!("Expected offer"),
    }

    let answer_sdp = "v=0 student answer";
    student1_ws.send(WsMessage::Text(json!(
    {
        "type": "answer",
        "sdp": answer_sdp,
        "target_id": null,
    }).to_string().into())).await.expect("Failed to send answer");

    let msg = tokio::time::timeout(
        std::time::Duration::from_secs(5),
        teacher_ws.next()
    )
    .await
    .expect("Timed out waiting for answer")
    .expect("Stream closed")
    .expect("WebSocket error");

    match msg
    {
        WsMessage::Text(txt) => assert!(txt.contains(answer_sdp), "Teacher should receive answer"),
        _ => panic!("Expected answer"),
    }

    teacher_ws.close(None).await.expect("Failed to close");

    if let Some(Ok(WsMessage::Close(Some(frame)))) = student1_ws.next().await
    {
        assert_eq!(frame.code, CloseCode::Normal);
        assert!(frame.reason.contains("Teacher"));
    }
    else
    {
        panic!("Student should receive close frame");
    }
}
