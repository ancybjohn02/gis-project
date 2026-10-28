from fastapi.middleware.cors import CORSMiddleware
from io import BytesIO

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile, Query
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.database import engine
from app.validators import validate_assets

app = FastAPI(
    title="Telecom Asset Mapping API",
    description=(
        "A GIS backend for importing, validating, "
        "and querying telecom infrastructure assets."
    ),
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

@app.get("/", tags=["General"])
def root():
    return {
        "message": "Telecom Asset Mapping API is running",
        "docs": "/docs",
    }


@app.get("/health", tags=["General"])
def health_check():
    return {
        "status": "healthy",
        "service": "telecom-asset-mapping-api",
    }


@app.post("/assets/validate", tags=["Asset Validation"])
async def validate_asset_file(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a CSV file.",
        )

    try:
        content = await file.read()
        df = pd.read_csv(BytesIO(content))
    except (pd.errors.ParserError, UnicodeDecodeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="The uploaded file could not be parsed as a CSV.",
        )

    if df.empty:
        raise HTTPException(
            status_code=400,
            detail="The uploaded CSV contains no records.",
        )

    return validate_assets(df)


@app.post("/assets/import", tags=["Asset Import"])
async def import_asset_file(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a CSV file.",
        )

    try:
        content = await file.read()
        df = pd.read_csv(BytesIO(content))
    except (pd.errors.ParserError, UnicodeDecodeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="The uploaded file could not be parsed as a CSV.",
        )

    if df.empty:
        raise HTTPException(
            status_code=400,
            detail="The uploaded CSV contains no records.",
        )

    validation = validate_assets(df)
    valid_data = validation["valid_data"]

    inserted_records = 0
    existing_records = 0

    insert_query = text("""
        INSERT INTO public.telecom_assets (
            asset_id,
            asset_type,
            latitude,
            longitude,
            location
        )
        VALUES (
            :asset_id,
            :asset_type,
            :latitude,
            :longitude,
            ST_SetSRID(
                ST_MakePoint(:longitude, :latitude),
                4326
            )::geography
        )
        ON CONFLICT (asset_id) DO NOTHING
    """)

    try:
        with engine.begin() as connection:
            for record in valid_data:
                result = connection.execute(insert_query, record)

                if result.rowcount == 1:
                    inserted_records += 1
                else:
                    existing_records += 1

    except SQLAlchemyError:
        raise HTTPException(
            status_code=500,
            detail="Database import failed. Check the backend logs.",
        )

    return {
        "total_records": validation["total_records"],
        "valid_records": validation["valid_records"],
        "invalid_records": validation["invalid_records"],
        "inserted_records": inserted_records,
        "skipped_existing_records": existing_records,
        "errors": validation["errors"],
    }

@app.get("/assets/nearby", tags=["Spatial Queries"])
def find_nearby_assets(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    radius_m: float = Query(5000, gt=0, le=100000),
):
    query = text("""
        SELECT
            asset_id,
            asset_type,
            latitude,
            longitude,
            ST_Distance(
                location,
                ST_SetSRID(
                    ST_MakePoint(:longitude, :latitude),
                    4326
                )::geography
            ) AS distance_m
        FROM public.telecom_assets
        WHERE ST_DWithin(
            location,
            ST_SetSRID(
                ST_MakePoint(:longitude, :latitude),
                4326
            )::geography,
            :radius_m
        )
        ORDER BY distance_m ASC
    """)

    try:
        with engine.connect() as connection:
            result = connection.execute(
                query,
                {
                    "latitude": latitude,
                    "longitude": longitude,
                    "radius_m": radius_m,
                },
            )

            assets = [
                {
                    "asset_id": row.asset_id,
                    "asset_type": row.asset_type,
                    "latitude": row.latitude,
                    "longitude": row.longitude,
                    "distance_m": round(row.distance_m, 2),
                }
                for row in result
            ]

    except SQLAlchemyError:
        raise HTTPException(
            status_code=500,
            detail="Spatial query failed. Check the backend logs.",
        )

    return {
        "search_location": {
            "latitude": latitude,
            "longitude": longitude,
        },
        "radius_m": radius_m,
        "total_found": len(assets),
        "assets": assets,
    }


@app.get("/assets", tags=["Assets"])
def get_assets():
    query = text("""
        SELECT
            asset_id,
            asset_type,
            latitude,
            longitude
        FROM public.telecom_assets
        ORDER BY asset_id
    """)

    try:
        with engine.connect() as connection:
            result = connection.execute(query)

            assets = [
                {
                    "asset_id": row.asset_id,
                    "asset_type": row.asset_type,
                    "latitude": row.latitude,
                    "longitude": row.longitude,
                }
                for row in result
            ]

    except SQLAlchemyError:
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve assets. Check the backend logs.",
        )

    return {
        "total": len(assets),
        "assets": assets,
    }
