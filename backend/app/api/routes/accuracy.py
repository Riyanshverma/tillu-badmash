from fastapi import APIRouter

from app.api.dependencies import Database
from app.models.api import AccuracyResponse
from app.services import api_service

router = APIRouter()


@router.get("/accuracy", response_model=AccuracyResponse,
            summary="January matched-hour accuracy and historical error statistics")
async def accuracy(connection: Database) -> AccuracyResponse:
    return await api_service.accuracy(connection)
