import os
from pathlib import Path
from sqlmodel import SQLModel, create_engine, Session

# DATA_DIR — override via env var for Docker
DATA_DIR = Path(os.getenv("DATA_DIR", Path(__file__).parent.parent / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)

IMAGES_DIR = DATA_DIR / "images"
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = DATA_DIR / "database.db"
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},  # needed for FastAPI async
)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    # Safe migrations — add columns that may not exist in older DBs
    with engine.connect() as conn:
        for sql in [
            "ALTER TABLE packs ADD COLUMN has_draft INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE packs ADD COLUMN layout TEXT NOT NULL DEFAULT '[]'",
            "ALTER TABLE reports ADD COLUMN is_confirmed INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE reports ADD COLUMN confirmed_at TEXT",
            "ALTER TABLE reports ADD COLUMN confirmed_by TEXT",
            "ALTER TABLE reports ADD COLUMN confirmed_selectors TEXT NOT NULL DEFAULT '{}'",
            # notes table columns (table itself created by SQLModel.metadata.create_all above)
            "ALTER TABLE notes ADD COLUMN has_draft INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE notes ADD COLUMN published_content TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE notes ADD COLUMN is_confirmed INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE notes ADD COLUMN confirmed_at TEXT",
            "ALTER TABLE notes ADD COLUMN confirmed_by TEXT",
            "ALTER TABLE notes ADD COLUMN ready_to_confirm INTEGER NOT NULL DEFAULT 0",
            # visuals table — created by SQLModel, extra columns for older DBs
            "ALTER TABLE visuals ADD COLUMN has_draft INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE visuals ADD COLUMN is_confirmed INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE visuals ADD COLUMN confirmed_at TEXT",
            "ALTER TABLE visuals ADD COLUMN confirmed_by TEXT",
            "ALTER TABLE visuals ADD COLUMN ready_to_confirm INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE visuals ADD COLUMN published_definition TEXT NOT NULL DEFAULT '{}'",
            # reports table
            "ALTER TABLE reports ADD COLUMN ready_to_confirm INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE reports ADD COLUMN published_dataset TEXT NOT NULL DEFAULT '{}'",
            "ALTER TABLE reports ADD COLUMN last_dataset TEXT NOT NULL DEFAULT '{}'",
            "ALTER TABLE reports ADD COLUMN last_dataset_at TEXT",
            # folder_id columns for all artifact types
            "ALTER TABLE reports ADD COLUMN folder_id TEXT",
            "ALTER TABLE notes ADD COLUMN folder_id TEXT",
            "ALTER TABLE visuals ADD COLUMN folder_id TEXT",
            "ALTER TABLE packs ADD COLUMN folder_id TEXT",
            "ALTER TABLE images ADD COLUMN folder_id TEXT",
            "ALTER TABLE folders ADD COLUMN parent_id TEXT",
            "ALTER TABLE visuals ADD COLUMN last_dataset_at TEXT",
        ]:
            try:
                conn.execute(__import__('sqlalchemy').text(sql))
                conn.commit()
            except Exception:
                pass  # Column already exists


def get_session():
    with Session(engine) as session:
        yield session
