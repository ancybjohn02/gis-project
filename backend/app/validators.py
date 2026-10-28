import pandas as pd

REQUIRED_COLUMNS = [
    "asset_id",
    "asset_type",
    "latitude",
    "longitude",
]


def validate_assets(df: pd.DataFrame) -> dict:
    """
    Validate telecom asset records.

    Required columns:
    asset_id, asset_type, latitude, longitude
    """
    errors = []
    valid_records = []

    # Check required columns
    missing_columns = [
        column for column in REQUIRED_COLUMNS
        if column not in df.columns
    ]

    if missing_columns:
        return {
            "total_records": len(df),
            "valid_records": 0,
            "invalid_records": len(df),
            "errors": [
                {
                    "row": None,
                    "asset_id": None,
                    "error": f"Missing required columns: {missing_columns}",
                }
            ],
            "valid_data": [],
        }

    # Normalize text fields
    df = df.copy()
    df["asset_id"] = df["asset_id"].astype("string").str.strip()
    df["asset_type"] = df["asset_type"].astype("string").str.strip()

    # Convert coordinates to numeric values
    df["latitude"] = pd.to_numeric(df["latitude"], errors="coerce")
    df["longitude"] = pd.to_numeric(df["longitude"], errors="coerce")

    # Detect duplicate IDs
    duplicate_ids = (
        df["asset_id"].notna()
        & df["asset_id"].duplicated(keep=False)
    )

    for position, (_, row) in enumerate(df.iterrows(), start=1):
        row_errors = []
        asset_id = row["asset_id"]

        if pd.isna(asset_id) or not asset_id:
            row_errors.append("Missing asset_id")

        if pd.isna(row["asset_type"]) or not row["asset_type"]:
            row_errors.append("Missing asset_type")

        if pd.isna(row["latitude"]):
            row_errors.append("Missing or invalid latitude")
        elif not -90 <= row["latitude"] <= 90:
            row_errors.append("Latitude must be between -90 and 90")

        if pd.isna(row["longitude"]):
            row_errors.append("Missing or invalid longitude")
        elif not -180 <= row["longitude"] <= 180:
            row_errors.append("Longitude must be between -180 and 180")

        if duplicate_ids.iloc[position - 1]:
            row_errors.append("Duplicate asset_id")

        if row_errors:
            errors.append({
                "row": position,
                "asset_id": (
                    None if pd.isna(asset_id) else str(asset_id)
                ),
                "error": "; ".join(row_errors),
            })
        else:
            valid_records.append({
                "asset_id": str(asset_id),
                "asset_type": str(row["asset_type"]),
                "latitude": float(row["latitude"]),
                "longitude": float(row["longitude"]),
            })

    return {
        "total_records": len(df),
        "valid_records": len(valid_records),
        "invalid_records": len(errors),
        "errors": errors,
        "valid_data": valid_records,
    }