from fastapi import APIRouter

from app.api.dependencies import Database, DecisionDate
from app.models.api import DecisionResponse
from app.services import api_service

router = APIRouter()


@router.get("/decisions/{decision_date}", response_model=DecisionResponse,
            summary="Day-ahead decision-time forecast and historical P90 band")
async def decision(
    decision_date: DecisionDate, connection: Database,
) -> DecisionResponse:
    return await api_service.decision(connection, decision_date)
