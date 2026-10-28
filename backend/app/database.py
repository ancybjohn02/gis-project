import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL, make_url

load_dotenv()

database_url = os.getenv("DATABASE_URL")

if not database_url:
    raise RuntimeError(
        "DATABASE_URL is missing. Add it to the backend .env file."
    )

url = make_url(database_url)

if url.drivername not in {
    "postgresql+psycopg",
    "postgresql",
}:
    raise RuntimeError("DATABASE_URL must use PostgreSQL with Psycopg.")

engine = create_engine(
    url,
    pool_pre_ping=True,
    connect_args={"sslmode": "require"},
)


def check_database_connection() -> dict:
    with engine.connect() as connection:
        result = connection.execute(
            text("SELECT current_database(), PostGIS_Full_Version()")
        )
        database_name, postgis_version = result.one()

    return {
        "connected": True,
        "database": database_name,
        "postgis_enabled": bool(postgis_version),
    }