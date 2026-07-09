from pathlib import Path

from sqlmodel import Session, select

from app.core.config import settings
from app.db.database import engine, create_db_and_tables
from app.db.models import SatelliteScene, SatelliteImage


def normalize_relative_path(path_value: str) -> str:
    return path_value.replace("\\", "/")


def import_scene_images() -> None:
    create_db_and_tables()

    data_root = Path(settings.DATA_ROOT)

    with Session(engine) as session:
        scenes = session.exec(select(SatelliteScene)).all()

        imported = 0
        skipped = 0
        missing = 0

        for scene in scenes:
            if not scene.file_preview:
                skipped += 1
                continue

            existing = session.exec(
                select(SatelliteImage).where(
                    SatelliteImage.scene_id == scene.scene_id,
                    SatelliteImage.county == scene.county,
                    SatelliteImage.image_type == "ndvi_preview",
                )
            ).first()

            if existing:
                skipped += 1
                continue

            relative_path = normalize_relative_path(scene.file_preview)

            if relative_path.startswith("data/"):
                relative_path = relative_path.removeprefix("data/")

            image_path = data_root / relative_path

            if not image_path.exists():
                print(f"[MISSING] {image_path}")
                missing += 1
                continue

            content = image_path.read_bytes()

            image = SatelliteImage(
                scene_id=scene.scene_id,
                county=scene.county,
                year=scene.year,
                image_type="ndvi_preview",
                filename=image_path.name,
                mime_type="image/png",
                size_bytes=len(content),
                content=content,
            )

            session.add(image)
            imported += 1

        session.commit()

    print("Import finished")
    print(f"Imported: {imported}")
    print(f"Skipped: {skipped}")
    print(f"Missing: {missing}")


if __name__ == "__main__":
    import_scene_images()