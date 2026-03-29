use tracing::{info};
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

use crate::error::Error;
use crate::state::AppState;

mod routes;
mod error;
mod signal;
mod state;
mod role;
mod peer;

type MainError<T> = Result<T, Error>;
#[tokio::main]
async fn main() -> MainError<()>
{
    //This is boilerplate code for sanity checks
    tracing_subscriber::registry()
        .with(fmt::layer())
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| {
            "server=debug,axum=info,tower_http=debug".into()
        }))
        .init();
    
    let app = crate::routes::app_router(AppState::new());

    let listener = tokio::net::TcpListener::bind("0.0.0.0:6969")
        .await?;
    
    info!("Server runnning on http://localhost:6969");
    info!("Oh, this is gonna be fucking hell.");

    axum::serve(listener,app).await?;

    Ok(())
}
