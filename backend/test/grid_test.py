from app.services.grid import bbox_to_cells

cells = bbox_to_cells(26.5, 43.8, 27.2, 44.3)
for c in cells:
    print(c.cell_id, c.min_lon, c.min_lat, c.max_lon, c.max_lat)
print(f"Total: {len(cells)} celule")