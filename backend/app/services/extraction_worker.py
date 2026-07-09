from __future__ import annotations

import sys
import time
import threading
import subprocess
from datetime import datetime, timezone

from sqlmodel import Session, select
from app.db.database import engine
from app.db.models import ProcessLog


# ---------------------------------------------------------------------------
# Utilitare
# ---------------------------------------------------------------------------

def append_log(log: ProcessLog, line: str) -> None:
    stamp = datetime.now(timezone.utc).strftime("%H:%M:%S")
    log.logs = (log.logs or "") + f"[{stamp}] {line}\n"


def _is_cancelled(job_id: int) -> bool:
    """Verifica in DB daca jobul a fost anulat intre timp."""
    with Session(engine) as session:
        job = session.get(ProcessLog, job_id)
        return job is not None and job.status == "cancelled"


def _build_cmd(module: str, job: ProcessLog) -> list[str]:
    """
    Construieste comanda pentru CLI.
    Daca jobul are bbox (label setat), foloseste --bbox + --label.
    Altfel foloseste --county (compatibilitate cu extragerea pe judet).
    """
    cmd = [
        sys.executable, "-m", module,
        "--start-year", str(job.start_year),
        "--end-year", str(job.end_year),
        "--start-month", str(job.start_month),
        "--end-month", str(job.end_month),
    ]

    has_bbox = (
        job.label is not None
        and job.min_lon is not None and job.min_lat is not None
        and job.max_lon is not None and job.max_lat is not None
    )

    if has_bbox:
        bbox_str = f"{job.min_lon},{job.min_lat},{job.max_lon},{job.max_lat}"
        cmd += ["--bbox", bbox_str, "--label", job.label]
    else:
        cmd += ["--county", job.county]

    return cmd


def run_cli(cmd: list[str]) -> tuple[bool, str]:
    print(f"\n[Worker] Rulez: {' '.join(cmd)}\n", flush=True)
    collected = []
    try:
        # Pornim procesul si citim output-ul linie cu linie, in timp real
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,  # combinam stderr in stdout
            text=True,
            bufsize=1,  # line-buffered
        )

        for line in process.stdout:
            line = line.rstrip()
            print(f"   | {line}", flush=True)  # afisam in consola PyCharm
            collected.append(line)

        process.wait(timeout=3600)
        ok = process.returncode == 0
        output = "\n".join(collected[-60:])  # ultimele 60 de linii pentru DB
        return ok, output

    except subprocess.TimeoutExpired:
        process.kill()
        return False, "Timeout: extractia a depasit 1 ora."
    except Exception as e:
        return False, f"Eroare la rulare: {e}"

# ---------------------------------------------------------------------------
# WORKER 1 - Sentinel
# ---------------------------------------------------------------------------

def _claim_sentinel_job() -> int | None:
    with Session(engine) as session:
        job = session.exec(
            select(ProcessLog)
            .where(ProcessLog.stage == "queued")
            .where(ProcessLog.status != "cancelled")
            .order_by(ProcessLog.created_at)
        ).first()
        if job is None:
            return None

        job.status = "running"
        job.stage = "sentinel_running"
        job.progress = 10
        job.started_at = datetime.now(timezone.utc)
        target = job.label or job.county
        append_log(job, f"[Worker Sentinel] Start imagini {target} {job.start_year}-{job.end_year}")
        session.add(job)
        session.commit()
        return job.id


def _run_sentinel(job_id: int) -> None:
    with Session(engine) as session:
        job = session.get(ProcessLog, job_id)
        cmd = _build_cmd("extraction.sentinel_cli", job)

    ok, out = run_cli(cmd)

    # daca jobul a fost anulat in timp ce rula Sentinel, ne oprim aici
    if _is_cancelled(job_id):
        with Session(engine) as session:
            job = session.get(ProcessLog, job_id)
            append_log(job, "[Worker Sentinel] Job anulat. Nu se continua cu ERA5.")
            job.stage = "done"
            job.progress = 0
            job.completed_at = datetime.now(timezone.utc)
            session.add(job)
            session.commit()
        return

    with Session(engine) as session:
        job = session.get(ProcessLog, job_id)
        if ok:
            append_log(job, "[Worker Sentinel] Imagini extrase. Trece in coada ERA5.")
            job.stage = "sentinel_done"
            job.progress = 50
        else:
            append_log(job, "[Worker Sentinel] Esec la extragerea imaginilor.")
            append_log(job, out[-500:])
            job.status = "failed"
            job.stage = "done"
            job.message = "Extractia Sentinel a esuat."
            job.completed_at = datetime.now(timezone.utc)
        session.add(job)
        session.commit()


def sentinel_worker_loop(poll_seconds: float = 5.0) -> None:
    while True:
        try:
            job_id = _claim_sentinel_job()
            if job_id is not None:
                _run_sentinel(job_id)
            else:
                time.sleep(poll_seconds)
        except Exception as e:
            print(f"[Worker Sentinel] Eroare in bucla: {e}")
            time.sleep(poll_seconds)


# ---------------------------------------------------------------------------
# WORKER 2 - ERA5
# ---------------------------------------------------------------------------

def _claim_era5_job() -> int | None:
    with Session(engine) as session:
        job = session.exec(
            select(ProcessLog)
            .where(ProcessLog.stage == "sentinel_done")
            .where(ProcessLog.status != "cancelled")
            .order_by(ProcessLog.created_at)
        ).first()
        if job is None:
            return None

        job.stage = "era5_running"
        job.progress = 60
        target = job.label or job.county
        append_log(job, f"[Worker ERA5] Start clima {target} {job.start_year}-{job.end_year}")
        session.add(job)
        session.commit()
        return job.id


def _run_era5(job_id: int) -> None:
    with Session(engine) as session:
        job = session.get(ProcessLog, job_id)
        cmd = _build_cmd("extraction.era5_cli", job)

    ok, out = run_cli(cmd)

    if _is_cancelled(job_id):
        with Session(engine) as session:
            job = session.get(ProcessLog, job_id)
            append_log(job, "[Worker ERA5] Job anulat in timpul rularii.")
            job.stage = "done"
            job.completed_at = datetime.now(timezone.utc)
            session.add(job)
            session.commit()
        return

    with Session(engine) as session:
        job = session.get(ProcessLog, job_id)
        if ok:
            append_log(job, "[Worker ERA5] Clima extrasa. Extractie completa.")
            job.status = "completed"
            job.stage = "done"
            job.progress = 100
            job.message = "Extractie completa."
        else:
            append_log(job, "[Worker ERA5] Esec la extragerea climei.")
            append_log(job, out[-500:])
            job.status = "failed"
            job.stage = "done"
            job.message = "Extractia ERA5 a esuat."
        job.completed_at = datetime.now(timezone.utc)
        session.add(job)
        session.commit()


def era5_worker_loop(poll_seconds: float = 5.0) -> None:
    while True:
        try:
            job_id = _claim_era5_job()
            if job_id is not None:
                _run_era5(job_id)
            else:
                time.sleep(poll_seconds)
        except Exception as e:
            print(f"[Worker ERA5] Eroare in bucla: {e}")
            time.sleep(poll_seconds)


# ---------------------------------------------------------------------------
# Pornirea workerilor ca thread-uri de fundal (apelata la startup)
# ---------------------------------------------------------------------------

_workers_started = False


def start_workers() -> None:
    global _workers_started
    if _workers_started:
        return
    _workers_started = True

    t1 = threading.Thread(target=sentinel_worker_loop, daemon=True, name="sentinel-worker")
    t2 = threading.Thread(target=era5_worker_loop, daemon=True, name="era5-worker")
    t1.start()
    t2.start()
    print("[Workers] Sentinel + ERA5 pornite.")