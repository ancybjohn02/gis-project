- euses your existing validation function.
- Inserts only valid records.
- Converts longitude and latitude into a PostGIS geography point.
- Uses a database transaction so a database failure rolls back the import.
- Skips asset IDs that already exist instead of overwriting them.
For example, the PostGIS point is created using:
ST_SetSRID(
    ST_MakePoint(longitude, latitude),
    4326
)::geography

The order matters: longitude comes first, latitude second.