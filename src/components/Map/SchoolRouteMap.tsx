/**
 * Leaflet Interactive Map for RutaEscolar PWA
 * Renders:
 *   - School destination pin with arrival deadline badge
 *   - Depot / Origin pin
 *   - Numbered student pickup stops (with state color-coding)
 *   - Real-time School Van marker with heading and pulse animation
 *   - Route polyline geometry (active vs completed legs)
 */

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Alumno, Colegio, ParadaRuta, TrackingLog } from '../../types';

interface SchoolRouteMapProps {
  colegio: Colegio;
  origen: { lat: number; lng: number; direccion?: string };
  paradas: ParadaRuta[];
  alumnosMap: Map<string, Alumno>;
  vanLocation?: TrackingLog | null;
  polylineGeometry?: [number, number][];
  activeStopIndex?: number;
  highlightStudentId?: string; // For parent portal view
  onMarkerClick?: (parada: ParadaRuta) => void;
  className?: string;
}

export const SchoolRouteMap: React.FC<SchoolRouteMapProps> = ({
  colegio,
  origen,
  paradas,
  alumnosMap,
  vanLocation,
  polylineGeometry,
  activeStopIndex,
  highlightStudentId,
  onMarkerClick,
  className = 'h-full w-full'
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const polylineLayerRef = useRef<L.LayerGroup | null>(null);
  const vanMarkerRef = useRef<L.Marker | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [colegio.lat, colegio.lng],
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

  // Update Route Polylines and Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    const polylineLayer = polylineLayerRef.current;
    if (!map || !markersLayer || !polylineLayer) return;

    markersLayer.clearLayers();
    polylineLayer.clearLayers();

    // 1. Draw Route Polyline
    if (polylineGeometry && polylineGeometry.length > 0) {
      // Background glow
      L.polyline(polylineGeometry, {
        color: '#f59e0b',
        weight: 6,
        opacity: 0.8,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(polylineLayer);

      // Inner stroke
      L.polyline(polylineGeometry, {
        color: '#fbbf24',
        weight: 3,
        opacity: 1,
        lineCap: 'round',
        dashArray: '8, 8'
      }).addTo(polylineLayer);
    }

    // 2. Add Origin Depot Marker
    const originIcon = L.divIcon({
      className: 'custom-map-marker',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="w-9 h-9 bg-slate-900 border-2 border-sky-400 rounded-full shadow-lg flex items-center justify-center text-sky-400 font-bold text-xs">
            🏁
          </div>
          <span class="absolute -bottom-5 bg-slate-900/90 text-sky-300 text-[10px] font-medium px-1.5 py-0.5 rounded shadow border border-sky-500/30 whitespace-nowrap">
            Origen
          </span>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    L.marker([origen.lat, origen.lng], { icon: originIcon })
      .bindPopup(`<div class="p-1 font-sans text-slate-800"><b class="text-xs">Punto de Salida / Origen</b><p class="text-[11px] text-slate-600">${origen.direccion || 'Base del Conductor'}</p></div>`)
      .addTo(markersLayer);

    // 3. Add School Destination Marker
    const schoolIcon = L.divIcon({
      className: 'custom-map-marker',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="w-10 h-10 bg-amber-500 border-2 border-white rounded-full shadow-xl flex items-center justify-center text-slate-950 font-black text-sm">
            🏫
          </div>
          <span class="absolute -bottom-6 bg-amber-500 text-slate-950 font-bold text-[10px] px-2 py-0.5 rounded-full shadow border border-amber-600 whitespace-nowrap">
            Meta: ${colegio.hora_llegada_limite.substring(0, 5)}
          </span>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    L.marker([colegio.lat, colegio.lng], { icon: schoolIcon })
      .bindPopup(`
        <div class="p-1.5 font-sans text-slate-800">
          <div class="flex items-center gap-1.5 text-amber-600 font-bold text-xs">🏫 Escuela Destino</div>
          <p class="font-bold text-sm text-slate-900 mt-0.5">${colegio.nombre}</p>
          <p class="text-[11px] text-slate-600 mt-0.5">${colegio.direccion}</p>
          <div class="mt-1 bg-amber-50 border border-amber-200 text-amber-900 text-[10px] px-1.5 py-0.5 rounded font-medium">
            Llegada límite: ${colegio.hora_llegada_limite}
          </div>
        </div>
      `)
      .addTo(markersLayer);

    // 4. Add Student Pickup Stops Markers
    paradas.forEach((parada, idx) => {
      const student = alumnosMap.get(parada.alumno_id) || parada.alumno;
      const isCurrentActive = activeStopIndex !== undefined && activeStopIndex === idx;
      const isParentStudent = highlightStudentId && parada.alumno_id === highlightStudentId;

      let bgColor = 'bg-slate-800 border-amber-400 text-amber-300';
      let statusBadge = 'Pendiente';

      if (parada.estado === 'recogido') {
        bgColor = 'bg-emerald-600 border-white text-white';
        statusBadge = 'A Bordo';
      } else if (parada.estado === 'ausente') {
        bgColor = 'bg-rose-700 border-white text-white';
        statusBadge = 'Ausente';
      } else if (isCurrentActive) {
        bgColor = 'bg-amber-500 border-amber-200 text-slate-950 animate-bounce';
        statusBadge = 'Siguiente';
      }

      if (isParentStudent) {
        bgColor = 'bg-emerald-500 border-4 border-emerald-200 text-slate-950 font-black scale-125';
      }

      const markerHtml = `
        <div class="relative flex items-center justify-center group cursor-pointer">
          ${isCurrentActive ? '<div class="absolute w-12 h-12 rounded-full bg-amber-400/40 animate-ping"></div>' : ''}
          ${isParentStudent ? '<div class="absolute w-14 h-14 rounded-full bg-emerald-400/30 animate-pulse"></div>' : ''}
          <div class="w-8 h-8 ${bgColor} rounded-full border-2 shadow-md flex items-center justify-center font-bold text-xs transition-transform duration-200">
            ${parada.orden}
          </div>
          <span class="absolute -bottom-5 bg-slate-900/90 text-slate-200 text-[9px] font-semibold px-1.5 py-0.5 rounded shadow border border-slate-700 whitespace-nowrap">
            ${student ? student.nombre.split(' ')[0] : `Parada #${parada.orden}`} (${parada.hora_estimada.substring(0, 5)})
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
              <span class="text-[10px] font-bold text-amber-600 uppercase">Parada #${parada.orden}</span>
              <span class="text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                parada.estado === 'recogido' ? 'bg-emerald-100 text-emerald-800' :
                parada.estado === 'ausente' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
              }">${statusBadge}</span>
            </div>
            <p class="font-bold text-sm text-slate-900 mt-1">${student?.nombre || 'Alumno'}</p>
            <p class="text-[11px] text-slate-600 mt-0.5">${student?.direccion_recogida || 'Dirección de recogida'}</p>
            <div class="mt-2 text-[10px] text-slate-500 border-t pt-1 flex justify-between">
              <span>Hora estimada:</span>
              <b class="text-slate-800">${parada.hora_estimada}</b>
            </div>
          </div>
        `)
        .addTo(markersLayer);

      if (onMarkerClick) {
        marker.on('click', () => onMarkerClick(parada));
      }
    });

    // 5. Fit bounds if needed
    const allCoords: [number, number][] = [
      [origen.lat, origen.lng],
      [colegio.lat, colegio.lng],
      ...paradas.map((p) => [p.lat, p.lng] as [number, number])
    ];

    if (allCoords.length > 0 && !vanLocation) {
      const bounds = L.latLngBounds(allCoords);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [colegio, origen, paradas, polylineGeometry, activeStopIndex, highlightStudentId]);

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
          <div class="absolute w-12 h-12 rounded-full bg-amber-500/40 animate-ping"></div>
          <div class="w-10 h-10 bg-amber-500 border-2 border-slate-950 rounded-full shadow-2xl flex items-center justify-center text-slate-950 font-black text-base z-10">
            🚐
          </div>
          <span class="absolute -bottom-6 bg-slate-950 text-amber-400 text-[10px] font-black px-2 py-0.5 rounded shadow-lg border border-amber-500/50 whitespace-nowrap z-20">
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
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-inner">
      <div ref={mapContainerRef} className={className} />

      {/* Floating control buttons */}
      <div className="absolute top-3 right-3 z-[400] flex flex-col gap-2">
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
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900/90 text-slate-200 shadow-md backdrop-blur border border-slate-700 hover:bg-slate-800 hover:text-amber-400 active:scale-95 transition-all text-sm font-semibold"
        >
          🎯
        </button>
      </div>

      {/* Mini Legend Overlay */}
      <div className="absolute bottom-3 left-3 z-[400] hidden sm:flex items-center gap-2.5 rounded-lg bg-slate-950/85 px-3 py-1.5 text-[11px] font-medium text-slate-300 backdrop-blur border border-slate-800 shadow-lg">
        <div className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-800 border border-amber-400"></span>
          <span>Pendiente</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
          <span>Recogido</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-600"></span>
          <span>Ausente</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
          <span>Escuela</span>
        </div>
      </div>
    </div>
  );
};
