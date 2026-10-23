from fastapi import APIRouter

from app.api.routes.accuracy import router as accuracy_router
from app.api.routes.comparisons import router as comparisons_router
from app.api.routes.decisions import router as decisions_router
from app.api.routes.evolution import router as evolution_router
from app.api.routes.health import router as health_router

router = APIRouter()
router.include_router(health_router, tags=["health"])
router.include_router(decisions_router, tags=["decisions"])
router.include_router(accuracy_router, tags=["accuracy"])
router.include_router(comparisons_router, tags=["comparisons"])
router.include_router(evolution_router, tags=["forecast-evolution"])
