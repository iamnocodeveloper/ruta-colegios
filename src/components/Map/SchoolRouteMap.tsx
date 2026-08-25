/**
 * Leaflet Interactive Map for RutaEscolar PWA
 * Renders:
 *   - School destination pin with arrival deadline badge
 *   - Depot / Origin pin
 *   - Numbered student pickup stops (with state color-coding)
 *   - Real-time School Van marker with heading and pulse animation
 *   - Route polyline geometry (active vs completed legs)
 */

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Alumno, Colegio, ParadaRuta, TrackingLog } from '../../types';

interface SchoolRouteMapProps {
  colegio: Colegio;
  origen: { lat: number; lng: number; direccion?: string };
  onOriginChange?: (newOrigin: { lat: number; lng: number; direccion?: string }) => void;
  paradas: ParadaRuta[];
  alumnosMap: Map<string, Alumno>;
  vanLocation?: TrackingLog | null;
  polylineGeometry?: [number, number][];
  activeStopIndex?: number;
  highlightStudentId?: string; // For parent portal view
  targetArrivalTime?: string; // Explicit target arrival / meta time
  tipoTrayecto?: 'ida' | 'vuelta';
  onMarkerClick?: (parada: ParadaRuta) => void;
  polylineColor?: string; // Custom route line color (for variant selection)
  polylineDash?: string; // Custom dash array (e.g. '8, 8' or '0')
  reorderProgress?: { sequence: string[]; total: number } | null; // Map reorder mode feedback
  // Rutas alternativas (estilo Google Maps): se dibujan debajo de la principal
  alternativePolylines?: {
    geometry: [number, number][];
    color: string;
    dash: string;
    label: string;
    distanceKm?: number;
    durationMin?: number;
  }[];
  className?: string;
}

export const SchoolRouteMap: React.FC<SchoolRouteMapProps> = ({
  colegio,
  origen,
  onOriginChange,
  paradas,
  alumnosMap,
  vanLocation,
  polylineGeometry,
  activeStopIndex,
  highlightStudentId,
  targetArrivalTime,
  tipoTrayecto = 'ida',
  onMarkerClick,
  polylineColor = '#f59e0b',
  polylineDash = '8, 8',
  reorderProgress = null,
  alternativePolylines = [],
  className = 'h-full w-full'
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const polylineLayerRef = useRef<L.LayerGroup | null>(null);
  const vanMarkerRef = useRef<L.Marker | null>(null);
  const originMarkerRef = useRef<L.Marker | null>(null);
  const [clickToPickOrigin, setClickToPickOrigin] = useState<boolean>(false);

  // Reverse geocode helper for origin moves
  const reverseGeocodeOrigin = async (latitude: number, longitude: number) => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'es,en' } });
      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          const road = data.address?.road || data.address?.neighbourhood || data.address?.suburb || '';
          const city = data.address?.city || data.address?.town || data.address?.state || '';
          const cleanAddr = road ? `${road}, ${city}` : data.display_name.split(',').slice(0, 3).join(',');
          return cleanAddr;
        }
      }
    } catch (e) {
      console.warn('Geocoding origin unavailable', e);
    }
    return undefined;
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const centerLat = Number(colegio?.lat) || -0.1872;
    const centerLng = Number(colegio?.lng) || -78.4975;

    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom: 13,
      zoomControl: false
    });

    // Add high quality CartoDB Positron / OSM tiles with dark mode friendly style
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    const polylineLayer = L.layerGroup().addTo(map);

    markersLayerRef.current = markersLayer;
    polylineLayerRef.current = polylineLayer;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Handle map click when clickToPickOrigin is enabled
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !onOriginChange) return;

    const handleMapClick = async (e: L.LeafletMouseEvent) => {
      if (!clickToPickOrigin) return;
      const newLat = Number(e.latlng.lat.toFixed(6));
      const newLng = Number(e.latlng.lng.toFixed(6));
      const addr = await reverseGeocodeOrigin(newLat, newLng);
      onOriginChange({
        lat: newLat,
        lng: newLng,
        direccion: addr || origen.direccion
      });
      setClickToPickOrigin(false);
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [clickToPickOrigin, onOriginChange, origen.direccion]);

  // Update Route Polylines and Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    const polylineLayer = polylineLayerRef.current;
    if (!map || !markersLayer || !polylineLayer) return;

    markersLayer.clearLayers();
    polylineLayer.clearLayers();

    // 0. Draw alternative routes (Google Maps style) UNDER the main one
    (alternativePolylines || []).forEach((alt) => {
      if (!alt.geometry || alt.geometry.length === 0) return;
      L.polyline(alt.geometry, {
        color: alt.color,
        weight: 4,
        opacity: 0.7,
        dashArray: alt.dash,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(polylineLayer);
      L.polyline(alt.geometry, {
        color: alt.color,
        weight: 2,
        opacity: 0.9,
        dashArray: alt.dash,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(polylineLayer);
    });

    // 1. Draw Route Polyline
    if (polylineGeometry && polylineGeometry.length > 0) {
      // Background glow
      L.polyline(polylineGeometry, {
        color: polylineColor,
        weight: 6,
        opacity: 0.8,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(polylineLayer);

      // Inner stroke
      L.polyline(polylineGeometry, {
        color: polylineColor,
        weight: 3,
        opacity: 1,
        lineCap: 'round',
        dashArray: polylineDash
      }).addTo(polylineLayer);
    }

    // 2. Add Origin Depot Marker (Draggable if onOriginChange provided)
    const isOriginDraggable = !!onOriginChange;
    const originIcon = L.divIcon({
      className: 'custom-map-marker',
      html: `
        <div class="relative flex flex-col items-center group ${isOriginDraggable ? 'cursor-grab active:cursor-grabbing' : ''}">
          <div class="w-10 h-10 bg-canvas border-2 border-primary rounded-full shadow-2xl flex items-center justify-center text-sky-600 font-bold text-sm ${isOriginDraggable ? 'ring-4 ring-sky-500/30 animate-pulse' : ''}">
            🏁
          </div>
          <div class="w-3 h-1 bg-ink/40 rounded-full blur-[1px] -mt-0.5"></div>
          <span class="absolute -bottom-5 bg-surface/95 text-sky-600 text-[10px] font-bold px-1.5 py-0.5 rounded shadow border border-primary/40 whitespace-nowrap">
            ${isOriginDraggable ? 'Arrastra Salida 🏁' : 'Punto Salida'}
          </span>
        </div>
      `,
      iconSize: [40, 44],
      iconAnchor: [20, 36]
    });

    const originMarker = L.marker([origen.lat, origen.lng], {
      icon: originIcon,
      draggable: isOriginDraggable,
      autoPan: true
    })
      .bindPopup(`
        <div class="p-1.5 font-sans text-slate-800">
          <div class="flex items-center gap-1 text-sky-700 font-bold text-xs">
            <span>🏁 Punto de Salida / Origen</span>
          </div>
          <p class="text-[11px] text-slate-700 font-semibold mt-0.5">${origen.direccion || 'Base del Conductor'}</p>
          <div class="mt-1 font-mono text-[10px] text-muted">
            ${Number(origen.lat).toFixed(5)}, ${Number(origen.lng).toFixed(5)}
          </div>
          ${isOriginDraggable ? '<div class="mt-1 text-[10px] text-amber-700 font-bold bg-amber-50 p-1 rounded">💡 Puedes arrastrar este marcador a cualquier calle o lugar en el mapa</div>' : ''}
        </div>
      `)
      .addTo(markersLayer);

    if (isOriginDraggable) {
      originMarker.on('dragend', async () => {
        const pos = originMarker.getLatLng();
        const newLat = Number(pos.lat.toFixed(6));
        const newLng = Number(pos.lng.toFixed(6));
        const addr = await reverseGeocodeOrigin(newLat, newLng);
        onOriginChange({
          lat: newLat,
          lng: newLng,
          direccion: addr || origen.direccion
        });
      });
    }

    originMarkerRef.current = originMarker;

    // 3. Add School Destination Marker
    const rawTargetTime = targetArrivalTime || colegio.hora_llegada_limite || '08:00:00';
    const cleanTargetTime = rawTargetTime.length > 5 ? rawTargetTime.substring(0, 5) : rawTargetTime;

    const schoolIcon = L.divIcon({
      className: 'custom-map-marker',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="w-10 h-10 bg-primary border-2 border-white rounded-full shadow-xl flex items-center justify-center text-slate-950 font-black text-sm">
            🏫
          </div>
          <span class="absolute -bottom-6 bg-primary text-slate-950 font-bold text-[10px] px-2 py-0.5 rounded-full shadow border border-amber-600 whitespace-nowrap">
            ${tipoTrayecto === 'vuelta' ? 'Salida: ' : 'Meta: '} ${cleanTargetTime}
          </span>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    L.marker([colegio.lat, colegio.lng], { icon: schoolIcon })
      .bindPopup(`
        <div class="p-1.5 font-sans text-slate-800">
          <div class="flex items-center gap-1.5 text-amber-600 font-bold text-xs">🏫 ${tipoTrayecto === 'vuelta' ? 'Punto de Salida Escolar' : 'Escuela Destino'}</div>
          <p class="font-bold text-sm text-slate-900 mt-0.5">${colegio.nombre}</p>
          <p class="text-[11px] text-slate-600 mt-0.5">${colegio.direccion}</p>
          <div class="mt-1 bg-amber-50 border border-amber-200 text-amber-900 text-[10px] px-1.5 py-0.5 rounded font-medium">
            ${tipoTrayecto === 'vuelta' ? 'Hora de salida escolar' : 'Llegada límite / Meta'}: ${cleanTargetTime}
          </div>
        </div>
      `)
      .addTo(markersLayer);

    // 4. Add Student Pickup Stops Markers
    paradas.forEach((parada, idx) => {
      const student = alumnosMap.get(parada.alumno_id) || parada.alumno;
      const isCurrentActive = activeStopIndex !== undefined && activeStopIndex === idx;
      const isParentStudent = highlightStudentId && parada.alumno_id === highlightStudentId;

      const isReorderActive = !!reorderProgress;
      const reorderSeq = reorderProgress?.sequence || [];
      const reorderIdx = reorderSeq.indexOf(parada.alumno_id);
      const isPickedInReorder = isReorderActive && reorderIdx >= 0;
      const displayOrder = isPickedInReorder ? reorderIdx + 1 : parada.orden;
      const firstUnpickedIdx = isReorderActive
        ? paradas.findIndex((p) => !reorderSeq.includes(p.alumno_id))
        : -1;
      const isNextHint = isReorderActive && idx === firstUnpickedIdx;

      let bgColor = 'bg-slate-800 border-primary/40 text-primary';
      let statusBadge = 'Pendiente';

      if (parada.estado === 'recogido') {
        bgColor = 'bg-emerald-600 border-white text-white';
        statusBadge = 'A Bordo';
      } else if (parada.estado === 'ausente') {
        bgColor = 'bg-rose-700 border-white text-white';
        statusBadge = 'Ausente';
      } else if (isCurrentActive) {
        bgColor = 'bg-primary border-amber-200 text-slate-950 animate-bounce';
        statusBadge = 'Siguiente';
      }

      if (isParentStudent) {
        bgColor = 'bg-emerald-500 border-4 border-emerald-200 text-slate-950 font-black scale-125';
      }

      if (isPickedInReorder) {
        bgColor = 'bg-emerald-500 border-2 border-white text-white scale-110';
        statusBadge = `Nuevo #${reorderIdx + 1}`;
      } else if (isReorderActive) {
        bgColor = 'bg-slate-800/50 border-primary/20 text-muted';
      }

      const markerHtml = `
        <div class="relative flex items-center justify-center group cursor-pointer">
          ${isCurrentActive ? '<div class="absolute w-12 h-12 rounded-full bg-primary/40 animate-ping"></div>' : ''}
          ${isParentStudent ? '<div class="absolute w-14 h-14 rounded-full bg-emerald-400/30 animate-pulse"></div>' : ''}
          ${isNextHint ? '<div class="absolute w-10 h-10 rounded-full bg-sky-400/40 animate-ping"></div>' : ''}
          ${isPickedInReorder ? '<div class="absolute w-10 h-10 rounded-full bg-emerald-400/30 animate-pulse"></div>' : ''}
          <div class="w-8 h-8 ${bgColor} rounded-full border-2 shadow-md flex items-center justify-center font-bold text-xs transition-transform duration-200">
            ${displayOrder}
          </div>
          <span class="absolute -bottom-5 bg-surface/90 text-ink text-[9px] font-semibold px-1.5 py-0.5 rounded shadow border border-line whitespace-nowrap">
            ${student ? student.nombre.split(' ')[0] : `Parada #${parada.orden}`} (${parada.hora_estimada.substring(0, 5)})${isPickedInReorder ? ' ✓' : ''}
          </span>
        </div>
      `;

      const stopIcon = L.divIcon({
        className: 'custom-stop-marker',
        html: markerHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([parada.lat, parada.lng], { icon: stopIcon })
        .bindPopup(`
          <div class="p-1 font-sans text-slate-800 min-w-[180px]">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-bold text-amber-600 uppercase">Parada #${displayOrder}${isPickedInReorder ? ' → Nuevo orden' : ''}</span>
              <span class="text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                isPickedInReorder ? 'bg-emerald-100 text-emerald-800' :
                parada.estado === 'recogido' ? 'bg-emerald-100 text-emerald-800' :
                parada.estado === 'ausente' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
              }">${statusBadge}</span>
            </div>
            <p class="font-bold text-sm text-slate-900 mt-1">${student?.nombre || 'Alumno'}</p>
            <p class="text-[11px] text-slate-600 mt-0.5">${student?.direccion_recogida || 'Dirección de recogida'}</p>
            ${isReorderActive ? `<div class="mt-1 ${isPickedInReorder ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-sky-50 border-sky-200 text-sky-800'} border text-[10px] px-1.5 py-0.5 rounded font-medium">
              ${isPickedInReorder ? `Tocado como nueva posición #${reorderIdx + 1}` : 'Tócalo para asignarlo a la siguiente posición'}
            </div>` : ''}
            <div class="mt-2 text-[10px] text-muted border-t pt-1 flex justify-between">
              <span>Hora estimada:</span>
              <b class="text-slate-800">${parada.hora_estimada}</b>
            </div>
          </div>
        `, isReorderActive ? { autoPan: false } : {})
        .addTo(markersLayer);

      if (onMarkerClick) {
        marker.on('click', () => onMarkerClick(parada));
      }
    });

    // 5. Fit bounds if needed (pero NO durante el modo reorden para no cambiar el zoom)
    const allCoords: [number, number][] = [
      [origen.lat, origen.lng],
      [colegio.lat, colegio.lng],
      ...paradas.map((p) => [p.lat, p.lng] as [number, number])
    ];

    if (allCoords.length > 0 && !vanLocation && !reorderProgress) {
      const bounds = L.latLngBounds(allCoords);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [colegio, origen, paradas, polylineGeometry, activeStopIndex, highlightStudentId, onOriginChange, targetArrivalTime, tipoTrayecto, polylineColor, polylineDash, reorderProgress, alternativePolylines]);

  // Handle Real-Time School Van Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!vanLocation) {
      if (vanMarkerRef.current) {
        map.removeLayer(vanMarkerRef.current);
        vanMarkerRef.current = null;
      }
      return;
    }

    const vanIcon = L.divIcon({
      className: 'custom-van-marker',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-12 h-12 rounded-full bg-primary/40 animate-ping"></div>
          <div class="w-10 h-10 bg-primary border-2 border-surface rounded-full shadow-2xl flex items-center justify-center text-white font-black text-base z-10">
            🚐
          </div>
          <span class="absolute -bottom-6 bg-surface text-primary text-[10px] font-black px-2 py-0.5 rounded shadow-lg border border-primary/40 whitespace-nowrap z-20">
            Unidad en Vivo ${vanLocation.velocidad_kmh ? `• ${Math.round(vanLocation.velocidad_kmh)} km/h` : ''}
          </span>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    if (!vanMarkerRef.current) {
      vanMarkerRef.current = L.marker([vanLocation.lat, vanLocation.lng], { icon: vanIcon, zIndexOffset: 1000 }).addTo(map);
    } else {
      vanMarkerRef.current.setLatLng([vanLocation.lat, vanLocation.lng]);
      vanMarkerRef.current.setIcon(vanIcon);
    }
  }, [vanLocation]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-line bg-surface shadow-inner">
      <div ref={mapContainerRef} className={`${className} ${clickToPickOrigin ? 'cursor-crosshair' : ''}`} />

      {/* Floating control buttons & Origin Click mode */}
      <div className="absolute top-3 right-3 z-[400] flex flex-col gap-2 items-end">
        {onOriginChange && (
          <button
            type="button"
            onClick={() => setClickToPickOrigin(!clickToPickOrigin)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold shadow-lg backdrop-blur transition-all border cursor-pointer ${
              clickToPickOrigin
                ? 'bg-sky-500 text-slate-950 border-sky-300 ring-2 ring-sky-400/50 animate-pulse'
                : 'bg-surface/90 text-sky-600 border-sky-600/40 hover:bg-line hover:text-ink'
            }`}
            title="Haz clic en cualquier punto del mapa para mover la salida"
          >
            <span>🏁</span>
            <span>{clickToPickOrigin ? 'Haz clic en el mapa...' : 'Fijar Salida en Mapa'}</span>
          </button>
        )}

        <button
          id="btn-recenter-map"
          onClick={() => {
            const map = mapInstanceRef.current;
            if (!map) return;
            if (vanLocation) {
              map.setView([vanLocation.lat, vanLocation.lng], 16, { animate: true });
            } else {
              const allCoords: [number, number][] = [
                [origen.lat, origen.lng],
                [colegio.lat, colegio.lng],
                ...paradas.map((p) => [p.lat, p.lng] as [number, number])
              ];
              map.fitBounds(L.latLngBounds(allCoords), { padding: [40, 40] });
            }
          }}
          title="Centrar vista"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface/90 text-ink shadow-md backdrop-blur border border-line hover:bg-line hover:text-primary active:scale-95 transition-all text-sm font-semibold cursor-pointer"
        >
          🎯
        </button>
      </div>

      {/* Origin Mode Active Notification */}
      {clickToPickOrigin && (
        <div className="absolute top-3 left-3 z-[400] rounded-lg bg-sky-950/90 border border-sky-500/60 px-3 py-1.5 text-xs font-bold text-sky-200 shadow-xl flex items-center gap-2 animate-bounce">
          <span>👆</span>
          <span>Haz clic en el mapa donde quieras ubicar el Punto de Salida</span>
        </div>
      )}

      {/* Route alternatives legend (Google Maps style) */}
      {alternativePolylines && alternativePolylines.length > 0 && (
        <div className="absolute bottom-11 left-3 z-[400] hidden sm:flex flex-wrap items-center gap-2.5 rounded-lg bg-surface px-3 py-1.5 text-[11px] font-medium text-ink backdrop-blur border border-line shadow-lg">
          {alternativePolylines.map((alt, i) => (
            <div key={i} className="flex items-center gap-1">
              <span
                className="inline-block h-[3px] w-5 rounded-full"
                style={{ backgroundColor: alt.color }}
              />
              <span>
                {alt.label}
                {alt.distanceKm != null && alt.durationMin != null
                  ? ` (${alt.distanceKm} km · ${alt.durationMin} min)`
                  : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Mini Legend Overlay */}
      <div className="absolute bottom-3 left-3 z-[400] hidden sm:flex items-center gap-2.5 rounded-lg bg-surface px-3 py-1.5 text-[11px] font-medium text-ink backdrop-blur border border-line shadow-lg">
        <div className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-sky-500"></span>
          <span>Salida (🏁)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-800 border border-primary/40"></span>
          <span>Pendiente</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
          <span>Recogido</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-primary"></span>
          <span>Escuela</span>
        </div>
      </div>
    </div>
  );
};
