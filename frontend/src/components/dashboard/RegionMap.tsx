import React, { useRef, useState, useEffect } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';

export interface Bbox {
    minLon: number;
    minLat: number;
    maxLon: number;
    maxLat: number;
}

export interface AnomalyCell {
    cell_lat: number;
    cell_lon: number;
    real_ndvi: number;
    predicted_ndvi: number;
    anomaly: number;
}

interface RegionMapProps {
    onBboxChange: (bbox: Bbox) => void;
    minSize?: number;
    anomalyCells?: AnomalyCell[];
    cellSize?: number;
    // celula selectata din lista (se evidentiaza pe harta)
    selectedCell?: { cell_lat: number; cell_lon: number } | null;
}

const MAP_CENTER: [number, number] = [44.1, 24.8];
const MAP_ZOOM = 7;
const CELL_SIZE_DEG = 0.1;

function anomalyColor(anomaly: number): string {
    const a = Math.max(-0.2, Math.min(0.2, anomaly));
    if (a < -0.05) {
        const intensity = Math.min(1, Math.abs(a) / 0.2);
        const g = Math.round(180 * (1 - intensity));
        return `rgb(200, ${g}, 40)`;
    } else if (a > 0.05) {
        const intensity = Math.min(1, a / 0.2);
        const r = Math.round(120 * (1 - intensity));
        return `rgb(${r}, 160, 60)`;
    }
    return 'rgb(220, 200, 80)';
}

// cheie unica pentru o celula (pentru comparatie)
function cellKey(lat: number, lon: number): string {
    return `${lat.toFixed(2)}_${lon.toFixed(2)}`;
}

export const RegionMap: React.FC<RegionMapProps> = ({
                                                        onBboxChange,
                                                        minSize = 0.2,
                                                        anomalyCells,
                                                        cellSize = CELL_SIZE_DEG,
                                                        selectedCell,
                                                    }) => {
    const [error, setError] = useState<string>('');
    const mapRef = useRef<L.Map | null>(null);
    const anomalyLayerRef = useRef<L.LayerGroup | null>(null);
    // retinem dreptunghiurile per cheie de celula, ca sa le putem evidentia
    const rectsRef = useRef<Map<string, L.Rectangle>>(new Map());

    // Deseneaza stratul de anomalii cand se schimba celulele
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        if (anomalyLayerRef.current) {
            map.removeLayer(anomalyLayerRef.current);
            anomalyLayerRef.current = null;
        }
        rectsRef.current.clear();

        if (!anomalyCells || anomalyCells.length === 0) return;

        const group = L.layerGroup();
        const half = cellSize / 2;

        anomalyCells.forEach((c) => {
            const bounds: L.LatLngBoundsExpression = [
                [c.cell_lat - half, c.cell_lon - half],
                [c.cell_lat + half, c.cell_lon + half],
            ];
            const rect = L.rectangle(bounds, {
                color: '#00000030',
                weight: 1,
                fillColor: anomalyColor(c.anomaly),
                fillOpacity: 0.6,
            });
            rect.bindPopup(
                `NDVI real: ${c.real_ndvi.toFixed(3)}<br>` +
                `NDVI asteptat: ${c.predicted_ndvi.toFixed(3)}<br>` +
                `Anomalie: ${c.anomaly >= 0 ? '+' : ''}${c.anomaly.toFixed(3)}`
            );
            group.addLayer(rect);
            rectsRef.current.set(cellKey(c.cell_lat, c.cell_lon), rect);
        });

        group.addTo(map);
        anomalyLayerRef.current = group;
    }, [anomalyCells, cellSize]);

    // Evidentiaza celula selectata (contur gros, pastreaza culoarea)
    useEffect(() => {
        // resetam toate contururile la normal
        rectsRef.current.forEach((rect) => {
            rect.setStyle({ color: '#00000030', weight: 1 });
        });

        if (!selectedCell) return;
        const key = cellKey(selectedCell.cell_lat, selectedCell.cell_lon);
        const rect = rectsRef.current.get(key);
        if (rect) {
            // contur gros albastru, dar fillColor (culoarea anomaliei) ramane
            rect.setStyle({ color: '#1d4ed8', weight: 4 });
            rect.bringToFront();
            // centram harta pe celula selectata
            const map = mapRef.current;
            if (map) {
                map.panTo([selectedCell.cell_lat, selectedCell.cell_lon]);
            }
        }
    }, [selectedCell]);

    return (
        <div className="flex flex-col gap-2">
            <div
                style={{ height: 400, width: '100%', overflow: 'hidden', position: 'relative' }}
                className="border border-gray-300 dark:border-gray-700"
            >
                <MapContainer
                    center={MAP_CENTER}
                    zoom={MAP_ZOOM}
                    style={{ height: '100%', width: '100%' }}
                    ref={(instance) => {
                        if (instance && !mapRef.current) {
                            mapRef.current = instance;
                            setupDraw(instance, onBboxChange, minSize, setError);
                        }
                    }}
                >
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution="&copy; OpenStreetMap contributors"
                    />
                </MapContainer>
            </div>
            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
            <p className="text-xs text-gray-500 dark:text-gray-400">
                Foloseste butonul de desen din dreapta-sus si trage un dreptunghi peste zona dorita.
            </p>
        </div>
    );
};

function setupDraw(
    map: L.Map,
    onBbox: (bbox: Bbox) => void,
    minSize: number,
    onError: (msg: string) => void,
) {
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const drawControl = new (L as any).Control.Draw({
        position: 'topright',
        draw: {
            rectangle: {
                shapeOptions: { color: '#1B7A3E' },
                showArea: false,
                metric: true,
            },
            polygon: false,
            circle: false,
            circlemarker: false,
            marker: false,
            polyline: false,
        },
        edit: {
            featureGroup: drawnItems,
            edit: false,
            remove: true,
        },
    });
    map.addControl(drawControl);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.on((L as any).Draw.Event.CREATED, (e: any) => {
        drawnItems.clearLayers();

        const layer = e.layer;
        const bounds = layer.getBounds();
        const minLon = bounds.getWest();
        const minLat = bounds.getSouth();
        const maxLon = bounds.getEast();
        const maxLat = bounds.getNorth();

        if (maxLon - minLon < minSize || maxLat - minLat < minSize) {
            onError(`Regiune prea mica. Minim ${minSize}\u00b0 pe fiecare latura.`);
            return;
        }

        onError('');
        drawnItems.addLayer(layer);
        console.log('Bbox desenat:', { minLon, minLat, maxLon, maxLat });
        onBbox({ minLon, minLat, maxLon, maxLat });
    });
}