import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import router
from app.core.config import Settings
from app.core.logging import configure_logging
from app.db.connection import connect_database, initialize_schema
from app.services.api_service import MissingDataError


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings if settings is not None else Settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        async with connect_database(settings.database_path) as connection:
            await initialize_schema(connection)
        yield

    application = FastAPI(title="Gridbricks Wind Analytics", version="0.1.0",
                          lifespan=lifespan)
    application.state.database_path = settings.database_path

    @application.exception_handler(MissingDataError)
    async def missing_data(request: Request, error: MissingDataError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(error)})

    @application.exception_handler(Exception)
    async def internal_error(request: Request, error: Exception) -> JSONResponse:
        logging.getLogger(__name__).error("API request failed", exc_info=error)
        return JSONResponse(status_code=500,
                            content={"detail": "Internal server error"})

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET"],
        allow_headers=["Accept", "Content-Type"],
    )
    application.include_router(router, prefix=settings.api_prefix)
    return application


app = create_app()
