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

    let teacher_join = json!({"type": "join", "role": "teacher"}).to_string();
    teacher_ws.send(WsMessage::Text(teacher_join.into())).await.expect("Failed to send teacher json!");

    let (mut student1_ws, _) = connect_async(format!("ws://localhost:6969/ws/{}", room_id))
        .await
        .expect("Failed to connect student1");

    let student1_join = json!({ "type": "join", "role": "student" }).to_string();
    student1_ws.send(WsMessage::Text(student1_join.into())).await.expect("Failed to send student1 json!");

    let (mut student2_ws, _) = connect_async(format!("ws://localhost:6969/ws/{}", room_id))
        .await
        .expect("Failed to connect student2");

    let student2_join = json!({ "type": "join", "role": "student" }).to_string();
    student2_ws.send(WsMessage::Text(student2_join.into())).await.expect("Failed to send student1 json!");

    let offer_sdp = "student1 is such a sigma";
    let offer_msg = json!(
    {
        "type": "offer",
        "sdp": offer_sdp,
        "target_id": null,
    }).to_string();

    student1_ws.send(WsMessage::Text(offer_msg.into())).await.expect("Student 1 failed to send offer msg");

    if let Some(Ok(msg)) = teacher_ws.next().await
    {
        match msg
        {
            WsMessage::Text(txt) => 
            {
                assert!(txt.contains(offer_sdp), "Teacher should receive student offer");
            },
            
            _ => panic!("Unexpected error in receiving the offer AHHHHHHHHHHHHHHHHhhh"),
        }
    }
    else
    {
        panic!("The teacher has FAILED TO receive ThE meSsage ARhrashbjdashkjll");
    }

    let answer_sdp = "You're a naughty naughty student";
    let answer_msg = json!(
    {
        "type": "answer",
        "sdp": answer_sdp,
        "target_id":  uuid::Uuid::new_v4().to_string(),
    }).to_string();

    teacher_ws.send(WsMessage::Text(answer_msg.into())).await.expect("Failed to send teacher answer msg!");

    if let Some(msg) = student1_ws.next().await
    {
        match msg
        {
            Ok(WsMessage::Text(txt)) =>
            {
                assert!(txt.contains(answer_sdp), "Student1 should receive teacher answer");
            },

            _ => panic!("unaifnjsdfsnhsodkhl;"),
        }
    }
    else
    {
        panic!("PANIC A TTHE DISCO!");
    }

    teacher_ws.close(None).await.expect("closing failed???");

    for student_ws in [&mut student1_ws, &mut student2_ws]
    {
        if let Some(Ok(msg)) = student_ws.next().await
        {
            match msg
            {
                WsMessage::Close(Some(frame)) =>
                {
                    assert_eq!(frame.code, CloseCode::Normal);
                    assert!(frame.reason.contains("Teacher"), "Student should mention your mom");
                },

                _ => panic!("HUH>?>>"),
            }
        }
        else
        {
            panic!("FAILED TO CLOSEHAHfshdjifsdjuikjmll");
        }
    }

}
