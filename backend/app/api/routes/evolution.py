from fastapi import APIRouter

from app.api.dependencies import Database, TargetTime
from app.models.api import ForecastEvolutionResponse
from app.services import api_service

router = APIRouter()


@router.get("/forecast-evolution", response_model=ForecastEvolutionResponse,
            summary="All target vintages with original decision-time eligibility")
async def evolution(
    target_time: TargetTime, connection: Database,
) -> ForecastEvolutionResponse:
    return await api_service.evolution(connection, target_time)
