from fastapi import APIRouter

from app.api.dependencies import Database, DecisionDate
from app.models.api import ComparisonResponse
from app.services import api_service

router = APIRouter()


@router.get("/comparisons/{decision_date}", response_model=ComparisonResponse,
            summary="Matched hourly decision-time forecast versus actual")
async def comparison(
    decision_date: DecisionDate, connection: Database,
) -> ComparisonResponse:
    return await api_service.comparison(connection, decision_date)
