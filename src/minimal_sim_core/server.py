from __future__ import annotations

import argparse
import asyncio
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from .api import simulate
from .constants import PROTOCOL_VERSION, SimulationErrorCode
from .schema_export import generate_json_schema

app = FastAPI(title="Minimal Sim Core Local Service", version=PROTOCOL_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.post("/simulate", response_model=None)
@app.post("/api/simulate", response_model=None)
async def simulate_endpoint(request: Request) -> Any:
    try:
        payload = await request.json()
        return await asyncio.to_thread(simulate, payload)
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={
                "protocol_version": PROTOCOL_VERSION,
                "status": "error",
                "error": {
                    "code": SimulationErrorCode.INTERNAL_ENGINE_ERROR.value,
                    "message": str(exc) or "Unhandled server error",
                },
            },
        )


@app.get("/api/schema")
async def schema_endpoint() -> dict[str, Any]:
    return generate_json_schema()


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the Minimal Sim Core local service")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind the local service to")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind the local service to")
    args = parser.parse_args()
    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
