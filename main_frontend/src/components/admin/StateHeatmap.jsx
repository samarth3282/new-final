import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

const GUJARAT_GEOJSON_URL =
  'https://raw.githubusercontent.com/geohacker/india/master/state/gujarat.geojson';

const COLOR_SCALE = [
  [0,   '#27AE60'],   // low
  [20,  '#F1C40F'],   // medium-low
  [40,  '#E67E22'],   // medium
  [60,  '#E74C3C'],   // high
  [100, '#8E44AD'],   // critical
];

function getColor(value) {
  for (let i = COLOR_SCALE.length - 1; i >= 0; i--) {
    if (value >= COLOR_SCALE[i][0]) return COLOR_SCALE[i][1];
  }
  return COLOR_SCALE[0][1];
}

/**
 * Interactive state heatmap using Leaflet + GeoJSON district polygons.
 *
 * @param {{ districtData: { name: string, cases: number }[] }} props
 *   districtData — array where each entry has a district `name` and `cases` count.
 */
export default function StateHeatmap({ districtData = [], width = '100%', height = 420 }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
    }

    const map = L.map(mapRef.current, {
      center: [22.3, 71.8],
      zoom: 6,
      scrollWheelZoom: false,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 14,
    }).addTo(map);

    // Build lookup from districtData
    const lookup = {};
    districtData.forEach(d => { lookup[d.name.toLowerCase()] = d.cases; });

    fetch(GUJARAT_GEOJSON_URL)
      .then(r => r.json())
      .then(geojson => {
        L.geoJSON(geojson, {
          style: feature => {
            const name = (feature.properties.NAME_2 || feature.properties.district || feature.properties.name || '').toLowerCase();
            const cases = lookup[name] ?? 0;
            return {
              fillColor: getColor(cases),
              weight: 1.5,
              color: '#555',
              fillOpacity: 0.55,
            };
          },
          onEachFeature: (feature, layer) => {
            const name = feature.properties.NAME_2 || feature.properties.district || feature.properties.name || 'Unknown';
            const cases = lookup[name.toLowerCase()] ?? 0;
            layer.bindTooltip(`<strong>${name}</strong><br/>Cases: ${cases}`, { sticky: true });
            layer.on({
              mouseover: e => {
                e.target.setStyle({ weight: 3, fillOpacity: 0.8 });
              },
              mouseout: e => {
                e.target.setStyle({ weight: 1.5, fillOpacity: 0.55 });
              },
              click: () => setSelected({ name, cases }),
            });
          },
        }).addTo(map);
      })
      .catch(() => {
        // Fallback: draw circles from districtData positions
        districtData.forEach(d => {
          if (!d.lat || !d.lng) return;
          const color = getColor(d.cases);
          L.circle([d.lat, d.lng], {
            radius: Math.max(d.cases * 400, 5000),
            color,
            fillColor: color,
            fillOpacity: 0.45,
            weight: 1.5,
          })
            .bindPopup(`<strong>${d.name}</strong><br/>Cases: ${d.cases}`)
            .addTo(map);
        });
      });

    mapInstance.current = map;
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [districtData]);

  return (
    <div className="relative">
      <div
        ref={mapRef}
        style={{ width, height, borderRadius: '0.75rem', overflow: 'hidden' }}
      />

      {/* Legend */}
      <div className="absolute bottom-3 right-3 bg-surface/90 backdrop-blur rounded-lg p-2 text-xs border border-border">
        {COLOR_SCALE.map(([threshold, color]) => (
          <div key={threshold} className="flex items-center gap-1.5 my-0.5">
            <span style={{ background: color, width: 14, height: 14, borderRadius: 3, display: 'inline-block' }} />
            <span className="text-text-secondary">{threshold === 0 ? '0 – 19' : threshold === 100 ? '100+' : `${threshold} – ${COLOR_SCALE[COLOR_SCALE.findIndex(c => c[0] === threshold) + 1]?.[0] - 1 || '+'}`}</span>
          </div>
        ))}
      </div>

      {/* Selected district info */}
      {selected && (
        <div className="absolute top-3 left-3 bg-surface/90 backdrop-blur rounded-lg px-3 py-2 text-sm border border-border shadow-lg">
          <p className="font-semibold text-text-primary">{selected.name}</p>
          <p className="text-text-secondary">Total Cases: {selected.cases}</p>
          <button onClick={() => setSelected(null)} className="text-xs text-primary mt-1 hover:underline">Close</button>
        </div>
      )}
    </div>
  );
}
