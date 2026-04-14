import sqlite3
from fastapi import APIRouter, Depends
from sqlmodel import Session, select, func
from db.database import get_session, DB_PATH
from db.models import Report, Pack, AuditLog, ReportVersion, PackVersion

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.get("/stats")
async def get_stats(session: Session = Depends(get_session)):
    report_count = session.exec(select(func.count()).select_from(Report)).one()
    pack_count = session.exec(select(func.count()).select_from(Pack)).one()
    draft_count = session.exec(
        select(func.count()).select_from(Report).where(Report.status == "draft")
    ).one()
    published_count = session.exec(
        select(func.count()).select_from(Report).where(Report.status == "published")
    ).one()
    dirty_count = session.exec(
        select(func.count()).select_from(Report).where(Report.has_draft == True)
    ).one()
    audit_count = session.exec(select(func.count()).select_from(AuditLog)).one()
    version_count = session.exec(select(func.count()).select_from(ReportVersion)).one()
    db_size_bytes = DB_PATH.stat().st_size if DB_PATH.exists() else 0

    return {
        "reports": report_count,
        "packs": pack_count,
        "drafts": draft_count,
        "published": published_count,
        "dirtyReports": dirty_count,
        "auditEntries": audit_count,
        "reportVersions": version_count,
        "dbSizeBytes": db_size_bytes,
    }


@router.get("/reports")
async def get_all_reports(session: Session = Depends(get_session)):
    reports = session.exec(select(Report).order_by(Report.updated_at.desc())).all()
    return {
        "reports": [
            {
                "id": r.id,
                "title": r.title,
                "type": r.type,
                "status": r.status,
                "hasDraft": r.has_draft,
                "everPublished": r.published_at is not None,
                "owner": r.owner,
                "createdAt": r.created_at.isoformat(),
                "updatedAt": r.updated_at.isoformat(),
                "publishedAt": r.published_at.isoformat() if r.published_at else None,
            }
            for r in reports
        ]
    }


@router.get("/packs")
async def get_all_packs(session: Session = Depends(get_session)):
    packs = session.exec(select(Pack).order_by(Pack.updated_at.desc())).all()
    return {
        "packs": [
            {
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "status": p.status,
                "owner": p.owner,
                "reportCount": len(p.get_statements()),
                "createdAt": p.created_at.isoformat(),
                "updatedAt": p.updated_at.isoformat(),
                "publishedAt": p.published_at.isoformat() if p.published_at else None,
            }
            for p in packs
        ]
    }


@router.get("/audit")
async def get_audit_log(session: Session = Depends(get_session)):
    logs = session.exec(
        select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(200)
    ).all()
    return {
        "log": [
            {
                "id": l.id,
                "user": l.user,
                "action": l.action,
                "targetType": l.target_type,
                "targetId": l.target_id,
                "targetTitle": l.target_title,
                "timestamp": l.timestamp.isoformat(),
                "detail": l.detail,
            }
            for l in logs
        ]
    }


@router.get("/schema")
async def get_schema():
    """Return live DB schema from sqlite_master."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    tables = []
    for row in conn.execute(
        "SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name"
    ):
        # Get column info
        cols = []
        for col in conn.execute(f"PRAGMA table_info('{row['name']}')"):
            cols.append(
                {
                    "cid": col["cid"],
                    "name": col["name"],
                    "type": col["type"],
                    "notNull": bool(col["notnull"]),
                    "default": col["dflt_value"],
                    "primaryKey": bool(col["pk"]),
                }
            )
        row_count = conn.execute(f"SELECT COUNT(*) FROM '{row['name']}'").fetchone()[0]
        tables.append(
            {
                "name": row["name"],
                "sql": row["sql"],
                "columns": cols,
                "rowCount": row_count,
            }
        )
    conn.close()
    return {"tables": tables}


@router.get("/table/{table_name}")
async def get_table_data(
    table_name: str, limit: int = 100, offset: int = 0, search: str = ""
):
    """Return rows from a specific table with optional search filter."""
    # Validate table name to prevent SQL injection
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    # Check table exists
    valid = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,)
    ).fetchone()
    if not valid:
        return {"columns": [], "rows": [], "total": 0}

    # Get column info
    columns = [c["name"] for c in conn.execute(f"PRAGMA table_info('{table_name}')")]

    # Build query with search filter on text columns
    where_clause = ""
    params: tuple = ()
    if search:
        text_cols = [
            c
            for c in columns
            if c
            in (
                "title",
                "name",
                "description",
                "type",
                "status",
                "owner",
                "user",
                "action",
                "target_type",
                "target_title",
                "detail",
            )
        ]
        if text_cols:
            where_clause = " WHERE " + " OR ".join([f"{c} LIKE ?" for c in text_cols])
            params = tuple([f"%{search}%"] * len(text_cols))

    # Get total count
    total = conn.execute(
        f"SELECT COUNT(*) FROM '{table_name}'" + where_clause.replace("WHERE", "WHERE"),
        params,
    ).fetchone()[0]

    # Get rows
    query = f"SELECT * FROM '{table_name}'" + where_clause + f" LIMIT ? OFFSET ?"
    rows = conn.execute(query, params + (limit, offset)).fetchall()
    conn.close()

    return {"columns": columns, "rows": [dict(r) for r in rows], "total": total}


@router.get("/versions/{report_id}")
async def get_report_versions(report_id: str, session: Session = Depends(get_session)):
    versions = session.exec(
        select(ReportVersion)
        .where(ReportVersion.report_id == report_id)
        .order_by(ReportVersion.published_at.desc())
    ).all()
    return {
        "versions": [
            {
                "id": v.id,
                "reportId": v.report_id,
                "publishedAt": v.published_at.isoformat(),
                "publishedBy": v.published_by,
            }
            for v in versions
        ]
    }
