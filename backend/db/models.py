from datetime import datetime, timezone
from typing import Optional
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Text
import json


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ─── Reports ──────────────────────────────────────────────────────────────────


class Report(SQLModel, table=True):
    __tablename__ = "reports"

    id: str = Field(primary_key=True)
    title: str = Field(default="Untitled")
    type: str = Field(default="report")  # report | note | chart | kpi
    status: str = Field(default="draft")  # draft | published
    owner: Optional[str] = Field(default=None)
    folder_id: Optional[str] = Field(default=None, foreign_key="folders.id")
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
    published_at: Optional[datetime] = Field(default=None)

    # Unpublished changes flag — set when a published report is edited
    has_draft: bool = Field(default=False)

    # Full definition stored as JSON blob — always the latest (draft or published)
    definition: str = Field(sa_column=Column(Text), default="{}")
    # Last published snapshot — preserved so viewer always sees clean published version
    published_definition: str = Field(sa_column=Column(Text), default="{}")
    published_dataset: str = Field(
        sa_column=Column(Text), default="{}"
    )  # TM1 data snapshot at publish time
    last_dataset: str = Field(
        sa_column=Column(Text), default="{}"
    )  # Most recent TM1 data (updated on Refresh)
    last_dataset_at: Optional[datetime] = Field(
        default=None
    )  # When last_dataset was fetched

    def get_definition(self) -> dict:
        return json.loads(self.definition)

    def set_definition(self, d: dict):
        self.definition = json.dumps(d)


# ─── Report versions (immutable published snapshots) ─────────────────────────


class ReportVersion(SQLModel, table=True):
    __tablename__ = "report_versions"

    id: Optional[int] = Field(default=None, primary_key=True)
    report_id: str = Field(foreign_key="reports.id", index=True)
    published_at: datetime = Field(default_factory=utcnow)
    published_by: Optional[str] = Field(default=None)
    definition: str = Field(sa_column=Column(Text), default="{}")

    def get_definition(self) -> dict:
        return json.loads(self.definition)


# ─── Packs ────────────────────────────────────────────────────────────────────


class Pack(SQLModel, table=True):
    __tablename__ = "packs"

    id: str = Field(primary_key=True)
    name: str = Field(default="Untitled Pack")
    description: str = Field(default="")
    status: str = Field(default="draft")  # draft | published
    has_draft: bool = Field(default=False)
    owner: Optional[str] = Field(default=None)
    folder_id: Optional[str] = Field(default=None, foreign_key="folders.id")
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
    published_at: Optional[datetime] = Field(default=None)

    # Ordered list of artifact IDs (derived from layout for backward compat)
    statements: str = Field(sa_column=Column(Text), default="[]")

    # Rich section-based layout definition
    layout: str = Field(sa_column=Column(Text), default="[]")

    # Pack-level header/footer defaults
    defaults: str = Field(sa_column=Column(Text), default="{}")

    # Lock state — once locked, pack becomes permanently read-only
    locked: bool = Field(default=False)
    locked_at: Optional[datetime] = Field(default=None)
    locked_by: Optional[str] = Field(default=None)

    # Roll Forward provenance
    rolled_from_pack_id: Optional[str] = Field(default=None)

    def get_statements(self) -> list[str]:
        return json.loads(self.statements)

    def set_statements(self, s: list[str]):
        self.statements = json.dumps(s)

    def get_layout(self) -> list:
        return json.loads(self.layout)

    def set_layout(self, l: list):
        self.layout = json.dumps(l)


# ─── Pack versions (immutable published snapshots) ───────────────────────────


class PackVersion(SQLModel, table=True):
    __tablename__ = "pack_versions"

    id: Optional[int] = Field(default=None, primary_key=True)
    pack_id: str = Field(foreign_key="packs.id", index=True)
    published_at: datetime = Field(default_factory=utcnow)
    published_by: Optional[str] = Field(default=None)
    statements: str = Field(sa_column=Column(Text), default="[]")
    layout: str = Field(sa_column=Column(Text), default="[]")
    defaults: str = Field(sa_column=Column(Text), default="{}")
    name: str = Field(default="")


# ─── Visuals (KPI + Chart) ────────────────────────────────────────────────────


class Visual(SQLModel, table=True):
    __tablename__ = "visuals"

    id: str = Field(primary_key=True)
    title: str = Field(default="Untitled Visual")
    visual_type: str = Field(default="kpi")  # kpi | chart
    status: str = Field(default="draft")  # draft | published
    has_draft: bool = Field(default=False)
    owner: Optional[str] = Field(default=None)
    folder_id: Optional[str] = Field(default=None, foreign_key="folders.id")
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
    published_at: Optional[datetime] = Field(default=None)

    last_dataset_at: Optional[datetime] = Field(default=None)

    # Full definition stored as JSON blob (cube, view, config, etc.)
    definition: str = Field(sa_column=Column(Text), default="{}")
    published_definition: str = Field(sa_column=Column(Text), default="{}")

    def get_definition(self) -> dict:
        return json.loads(self.definition)

    def set_definition(self, d: dict):
        self.definition = json.dumps(d)


# ─── Image library ───────────────────────────────────────────────────────────


class Image(SQLModel, table=True):
    __tablename__ = "images"

    id: str = Field(primary_key=True)
    name: str = Field(default="")  # user-facing label
    filename: str = Field(default="")  # stored filename on disk
    mime_type: str = Field(default="image/jpeg")
    size_bytes: int = Field(default=0)
    width: Optional[int] = Field(default=None)  # image width in pixels
    height: Optional[int] = Field(default=None)  # image height in pixels
    description: Optional[str] = Field(default="")  # user notes
    alt_text: Optional[str] = Field(default="")  # accessibility text
    tags: str = Field(default="")  # comma-separated tags
    uploaded_by: Optional[str] = Field(default=None)  # username who uploaded
    folder_id: Optional[str] = Field(default=None, foreign_key="folders.id")
    uploaded_at: datetime = Field(default_factory=utcnow)


# ─── Edit locks ───────────────────────────────────────────────────────────────


class EditLock(SQLModel, table=True):
    __tablename__ = "edit_locks"

    target_id: str = Field(primary_key=True)  # report_id or pack_id
    target_type: str = Field(default="report")  # report | pack
    locked_by: str = Field(default="unknown")
    locked_at: datetime = Field(default_factory=utcnow)
    expires_at: datetime = Field(default_factory=utcnow)


# ─── Folders ────────────────────────────────────────────────────────────────────


class Folder(SQLModel, table=True):
    __tablename__ = "folders"

    id: str = Field(primary_key=True)
    name: str = Field(default="New Folder")
    artifact_type: str = Field(
        default="report"
    )  # report | note | visual | pack | image
    parent_id: Optional[str] = Field(default=None, foreign_key="folders.id")
    created_at: datetime = Field(default_factory=utcnow)


# ─── Audit log ────────────────────────────────────────────────────────────────


class PackComment(SQLModel, table=True):
    __tablename__ = "pack_comments"

    id: Optional[int] = Field(default=None, primary_key=True)
    pack_id: str = Field(index=True)
    author: str = Field(default="")
    body: str = Field(sa_column=Column(Text), default="")
    created_at: datetime = Field(default_factory=utcnow)


class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_log"

    id: Optional[int] = Field(default=None, primary_key=True)
    user: str = Field(default="system")
    action: str = Field(
        default=""
    )  # create | save_draft | publish | delete | lock | unlock
    target_type: str = Field(default="report")  # report | pack
    target_id: str = Field(default="")
    target_title: str = Field(default="")
    timestamp: datetime = Field(default_factory=utcnow)
    detail: Optional[str] = Field(default=None)
