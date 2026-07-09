from fastapi import APIRouter, Depends, HTTPException, Response
from sqlmodel import Session, select

from app.db.database import get_session
from app.db.models import SatelliteImage

router = APIRouter(
    prefix="/images",
    tags=["Images"],
)


@router.get("/by-scene")
def get_image_by_scene(
    county: str,
    scene_id: str,
    image_type: str = "ndvi_preview",
    session: Session = Depends(get_session),
):
    statement = select(SatelliteImage).where(
        SatelliteImage.county == county,
        SatelliteImage.scene_id == scene_id,
        SatelliteImage.image_type == image_type,
    )

    image = session.exec(statement).first()

    if image is None:
        raise HTTPException(status_code=404, detail="Image not found")

    return Response(
        content=image.content,
        media_type=image.mime_type,
        headers={
            "Content-Disposition": f'inline; filename="{image.filename}"'
        },
    )

@router.get("/id/{image_id}")
def get_image_by_id(
    image_id: int,
    session: Session = Depends(get_session),
):
    image = session.get(SatelliteImage, image_id)

    if image is None:
        raise HTTPException(status_code=404, detail="Image not found")

    return Response(
        content=image.content,
        media_type=image.mime_type,
        headers={
            "Content-Disposition": f'inline; filename="{image.filename}"'
        },
    )