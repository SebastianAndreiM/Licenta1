from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.db.database import get_session
from app.db.models import User, ProcessLog
from app.routers.auth import get_current_user

router = APIRouter(
    prefix="/extractions",
    tags=["Extractions"],
)


def _make_bbox_label(min_lon: float, min_lat: float, max_lon: float, max_lat: float) -> str:
    """Aceeasi conventie ca in CLI-uri: bbox_22.30_43.60_24.10_44.45"""
    return "bbox_" + "_".join(f"{c:.2f}" for c in (min_lon, min_lat, max_lon, max_lat))


@router.post("/start")
def start_extraction(
        start_year: int,
        end_year: int,
        start_month: int,
        end_month: int,
        county: Optional[str] = None,
        min_lon: Optional[float] = None,
        min_lat: Optional[float] = None,
        max_lon: Optional[float] = None,
        max_lat: Optional[float] = None,
        session: Session = Depends(get_session),
        current_user: User = Depends(get_current_user),
):
    # Determinam daca e extragere pe bbox sau pe judet
    has_bbox = None not in (min_lon, min_lat, max_lon, max_lat)

    if has_bbox:
        label = _make_bbox_label(min_lon, min_lat, max_lon, max_lat)
        job = ProcessLog(
            county=label,           # folosim eticheta si la county (consistent cu CLI)
            label=label,
            min_lon=min_lon,
            min_lat=min_lat,
            max_lon=max_lon,
            max_lat=max_lat,
            start_year=start_year,
            end_year=end_year,
            start_month=start_month,
            end_month=end_month,
            user_id=current_user.id,
            status="pending",
            stage="queued",
            progress=0,
            message="In coada",
        )
    else:
        if not county:
            return {"error": "Trebuie sa dai fie county, fie bbox (min_lon/min_lat/max_lon/max_lat)."}
        job = ProcessLog(
            county=county,
            label=None,
            start_year=start_year,
            end_year=end_year,
            start_month=start_month,
            end_month=end_month,
            user_id=current_user.id,
            status="pending",
            stage="queued",
            progress=0,
            message="In coada",
        )

    session.add(job)
    session.commit()
    session.refresh(job)

    return {
        "job_id": job.id,
        "status": job.status,
        "label": job.label or job.county,
        "message": "Extractie adaugata in coada",
    }


@router.get("/status/{job_id}")
def get_status(
        job_id: int,
        session: Session = Depends(get_session),
        current_user: User = Depends(get_current_user),
):
    job = session.get(ProcessLog, job_id)
    if job is None:
        return {"found": False}

    return {
        "found": True,
        "job_id": job.id,
        "county": job.county,
        "label": job.label,
        "status": job.status,
        "stage": job.stage,
        "progress": job.progress,
        "message": job.message,
        "logs": job.logs,
    }


@router.get("/my-active")
def get_my_active(
        session: Session = Depends(get_session),
        current_user: User = Depends(get_current_user),
):
    """Joburile utilizatorului curent care inca ruleaza (pending/running).
    Frontend-ul le foloseste ca sa recupereze extragerea la revenire in pagina."""
    stmt = (
        select(ProcessLog)
        .where(
            ProcessLog.user_id == current_user.id,
            ProcessLog.status.in_(("pending", "running")),
        )
        .order_by(ProcessLog.created_at.desc())
    )
    jobs = session.exec(stmt).all()
    return [
        {
            "found": True,
            "job_id": j.id,
            "county": j.county,
            "label": j.label,
            "status": j.status,
            "stage": j.stage,
            "progress": j.progress,
            "message": j.message,
            "logs": j.logs,
        }
        for j in jobs
    ]


@router.get("/queue")
def get_queue(
        session: Session = Depends(get_session),
        current_user: User = Depends(get_current_user),
):
    stmt = select(ProcessLog).order_by(ProcessLog.created_at.desc())
    jobs = session.exec(stmt).all()
    return [
        {
            "job_id": j.id,
            "county": j.county,
            "label": j.label,
            "start_year": j.start_year,
            "end_year": j.end_year,
            "status": j.status,
            "stage": j.stage,
            "progress": j.progress,
        }
        for j in jobs
    ]


@router.post("/cancel/{job_id}")
def cancel_extraction(
        job_id: int,
        session: Session = Depends(get_session),
        current_user: User = Depends(get_current_user),
):
    job = session.get(ProcessLog, job_id)
    if job is None:
        return {"found": False, "message": "Job inexistent."}

    if job.status in ("completed", "failed", "cancelled"):
        return {
            "found": True,
            "job_id": job.id,
            "status": job.status,
            "message": "Jobul este deja finalizat, nu se poate anula.",
        }

    job.status = "cancelled"
    job.message = "Anulat de utilizator."
    stamp = datetime.now(timezone.utc).strftime("%H:%M:%S")
    job.logs = (job.logs or "") + f"[{stamp}] Anulare ceruta de utilizator.\n"

    if job.stage in ("queued", "sentinel_done"):
        job.stage = "done"
        job.completed_at = datetime.now(timezone.utc)
        msg = "Job anulat din coada."
    else:
        msg = "Anulare inregistrata. Procesul curent se va opri la urmatoarea etapa."

    session.add(job)
    session.commit()

    return {
        "found": True,
        "job_id": job.id,
        "status": job.status,
        "message": msg,
    }