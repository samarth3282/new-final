import { useEffect, useRef } from 'react';
import L from 'leaflet';

export default function HeatmapLeaflet({ data, width = '100%', height = 350 }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
    }

    const map = L.map(mapRef.current, {
      center: [23.0225, 72.5714], // Ahmedabad
      zoom: 10,
      scrollWheelZoom: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 18,
    }).addTo(map);

    // Draw circles for heatmap data
    if (data && data.length > 0) {
      data.forEach(point => {
        const intensity = Math.min(point.intensity || point.cases || 1, 10);
        const radius = intensity * 300;
        const color = intensity > 7 ? '#e74c3c' : intensity > 4 ? '#f39c12' : '#27ae60';

        L.circle([point.lat, point.lng], {
          radius,
          color,
          fillColor: color,
          fillOpacity: 0.35,
          weight: 1,
        })
          .bindPopup(`<strong>${point.area || point.name || 'Area'}</strong><br/>Cases: ${point.cases || intensity}`)
          .addTo(map);
      });
    }

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [data]);

  return (
    <div
      ref={mapRef}
      style={{ width, height, borderRadius: '0.75rem', overflow: 'hidden' }}
    />
  );
}
