/**
 * Interactive Location Picker Map
 * Allows users to pick GPS coordinates by clicking on the map, dragging the pin,
 * searching for addresses via OSM Nominatim geocoding, or using browser GPS.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { MapPin, Search, Navigation, Check, Loader2, Sparkles, X, ChevronRight, Compass } from 'lucide-react';

interface LocationPickerProps {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number, addressSuggestion?: string) => void;
  title?: string;
  pinType?: 'school' | 'student' | 'origin';
  currentAddress?: string;
  height?: string;
}

// Common fast-lookup sectors and landmarks in Quito, Ecuador for zero-latency instant autocomplete
const QUICK_PRESETS = [
  { name: 'La Carolina, Iñaquito', lat: -0.1815, lng: -78.4840, subtitle: 'Parque La Carolina, Quito Norte' },
  { name: 'González Suárez', lat: -0.2015, lng: -78.4770, subtitle: 'Sector González Suárez / Guápulo, Quito' },
  { name: 'Cumbayá Centro', lat: -0.2010, lng: -78.4310, subtitle: 'Valle de Cumbayá, Quito' },
  { name: 'Tumbaco', lat: -0.2150, lng: -78.4020, subtitle: 'Valle de Tumbaco, Quito' },
  { name: 'La Mariscal / Plaza Foch', lat: -0.2045, lng: -78.4915, subtitle: 'Sector La Mariscal, Quito Centro-Norte' },
  { name: 'El Batán / Monteserrín', lat: -0.1650, lng: -78.4720, subtitle: 'Sector El Batán / Monteserrín, Quito' },
  { name: 'Bellavista / Capilla del Hombre', lat: -0.1870, lng: -78.4700, subtitle: 'Sector Bellavista Alto, Quito' },
  { name: 'La Floresta', lat: -0.2110, lng: -78.4880, subtitle: 'Sector Cultural La Floresta, Quito' },
  { name: 'Centro Histórico / Plaza Grande', lat: -0.2200, lng: -78.5120, subtitle: 'Quito Antiguo, Pichincha' },
  { name: 'Carcelén / Colegio Americano', lat: -0.0985, lng: -78.4835, subtitle: 'Quito Extremo Norte' },
  { name: 'El Condado / San Carlos', lat: -0.1150, lng: -78.4980, subtitle: 'Quito Norte, Pichincha' },
  { name: 'San Rafael / Valle de Los Chillos', lat: -0.3120, lng: -78.4550, subtitle: 'Valle de Los Chillos, Rumiñahui' },
  { name: 'Nayón', lat: -0.1710, lng: -78.4410, subtitle: 'Parroquia Nayón, Quito' },
  { name: 'Villa Flora / El Recreo', lat: -0.2450, lng: -78.5200, subtitle: 'Quito Sur, Pichincha' },
  { name: 'Colegio San Gabriel (Mariana de Jesús)', lat: -0.1872, lng: -78.4975, subtitle: 'Av. América y Mariana de Jesús, Quito' },
  { name: 'Miravalle / Vía Interoceánica', lat: -0.1980, lng: -78.4480, subtitle: 'Cumbayá / Quito' },
  { name: 'Av. República del Salvador', lat: -0.1810, lng: -78.4795, subtitle: 'Iñaquito, Quito' },
  { name: 'Quicentro Shopping / Naciones Unidas', lat: -0.1750, lng: -78.4780, subtitle: 'Av. Naciones Unidas y Shyris, Quito' }
];

export const LocationPicker: React.FC<LocationPickerProps> = ({
  lat,
  lng,
  onChange,
  pinType = 'student',
  currentAddress = '',
  height = '240px'
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const debounceTimerRef = useRef<any>(null);

  const [searchQuery, setSearchQuery] = useState(currentAddress || '');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isOpenDropdown, setIsOpenDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [detectedAddress, setDetectedAddress] = useState<string | null>(null);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Icon setup based on pin type
  const getIcon = () => {
    const isSchool = pinType === 'school';
    const isOrigin = pinType === 'origin';
    const bgClass = isSchool
      ? 'bg-primary text-white border-white'
      : isOrigin
      ? 'bg-sky-500 text-white border-white'
      : 'bg-emerald-500 text-white border-white';
    const iconEmoji = isSchool ? '🏫' : isOrigin ? '🏁' : '📍';
    const labelText = isSchool ? 'Sede Colegio' : isOrigin ? 'Punto de Salida' : 'Punto Recogida';

    return L.divIcon({
      className: 'custom-picker-pin',
      html: `
        <div class="relative flex flex-col items-center group cursor-grab active:cursor-grabbing">
          <div class="w-10 h-10 ${bgClass} border-2 rounded-full shadow-2xl flex items-center justify-center text-base font-black transform -translate-y-2 animate-bounce transition-transform">
            ${iconEmoji}
          </div>
          <div class="w-3 h-1.5 bg-ink/40 rounded-full blur-[1px] -mt-1.5"></div>
          <span class="absolute -bottom-5 bg-surface/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow border border-line whitespace-nowrap">
            ${labelText}
          </span>
        </div>
      `,
      iconSize: [40, 44],
      iconAnchor: [20, 36]
    });
  };

  // Reverse geocode to get human-friendly address from coordinates
  const reverseGeocode = async (latitude: number, longitude: number) => {
    try {
      setIsReverseGeocoding(true);
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
      const res = await fetch(url, {
        headers: {
          'Accept-Language': 'es,en'
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          const road = data.address?.road || data.address?.neighbourhood || data.address?.suburb || '';
          const city = data.address?.city || data.address?.town || data.address?.state || '';
          const cleanAddr = road ? `${road}, ${city}` : data.display_name.split(',').slice(0, 3).join(',');
          setDetectedAddress(cleanAddr);
        }
      }
    } catch (e) {
      console.warn('Reverse geocoding unavailable', e);
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  // Move marker and map dynamically to new coordinates
  const moveToCoordinates = (newLat: number, newLng: number, zoomLevel: number = 16, addressLabel?: string) => {
    if (mapInstanceRef.current && markerRef.current) {
      markerRef.current.setLatLng([newLat, newLng]);
      mapInstanceRef.current.flyTo([newLat, newLng], zoomLevel, {
        animate: true,
        duration: 0.8
      });
    }
    onChange(newLat, newLng, addressLabel);
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = Number(lat) || -0.1807;
    const initialLng = Number(lng) || -78.4678;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 15,
      zoomControl: false
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; CARTO &copy; OpenStreetMap',
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Draggable marker
    const marker = L.marker([initialLat, initialLng], {
      icon: getIcon(),
      draggable: true,
      autoPan: true
    }).addTo(map);

    // Marker drag event
    marker.on('dragend', () => {
      const position = marker.getLatLng();
      const roundedLat = Number(position.lat.toFixed(6));
      const roundedLng = Number(position.lng.toFixed(6));
      onChange(roundedLat, roundedLng);
      reverseGeocode(roundedLat, roundedLng);
    });

    // Map click event to place marker
    map.on('click', (e: L.LeafletMouseEvent) => {
      const newLat = Number(e.latlng.lat.toFixed(6));
      const newLng = Number(e.latlng.lng.toFixed(6));
      marker.setLatLng([newLat, newLng]);
      onChange(newLat, newLng);
      reverseGeocode(newLat, newLng);
    });

    mapInstanceRef.current = map;
    markerRef.current = marker;

    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Update marker position if external lat/lng changes
  useEffect(() => {
    if (!markerRef.current || !mapInstanceRef.current) return;
    const currentMarkerPos = markerRef.current.getLatLng();
    const targetLat = Number(lat) || -0.1807;
    const targetLng = Number(lng) || -78.4678;

    if (
      Math.abs(currentMarkerPos.lat - targetLat) > 0.0001 ||
      Math.abs(currentMarkerPos.lng - targetLng) > 0.0001
    ) {
      markerRef.current.setLatLng([targetLat, targetLng]);
      mapInstanceRef.current.panTo([targetLat, targetLng], { animate: true });
    }
  }, [lat, lng]);

  // Execute Search against Presets + OpenStreetMap Nominatim
  const executeSearch = useCallback(async (query: string) => {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) {
      setSearchResults([]);
      setIsOpenDropdown(false);
      return;
    }

    // 1. Instant match from Quito presets
    const localMatches = QUICK_PRESETS.filter(
      (p) =>
        p.name.toLowerCase().includes(cleanQuery) ||
        p.subtitle.toLowerCase().includes(cleanQuery)
    ).map((p) => ({
      display_name: `${p.name}, ${p.subtitle}`,
      short_name: p.name,
      subtitle: p.subtitle,
      lat: p.lat,
      lon: p.lng,
      isLocal: true
    }));

    // If strong local matches found, display immediately
    setSearchResults(localMatches);
    setIsOpenDropdown(true);

    // 2. Fetch live results from Nominatim for streets, buildings, exact locations
    try {
      setIsSearching(true);
      const queryWithContext = cleanQuery.includes('quito') || cleanQuery.includes('ecuador')
        ? cleanQuery
        : `${cleanQuery}, Quito, Ecuador`;

      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        queryWithContext
      )}&limit=6&addressdetails=1`;

      const res = await fetch(url, {
        headers: { 'Accept-Language': 'es,en' }
      });

      if (res.ok) {
        const nominatimResults = await res.json();
        const formattedNominatim = nominatimResults.map((r: any) => {
          const parts = r.display_name.split(',').map((s: string) => s.trim());
          const shortName = parts.slice(0, 2).join(', ');
          const subtitle = parts.slice(2, 5).join(', ') || r.type || 'Lugar';

          return {
            display_name: r.display_name,
            short_name: shortName,
            subtitle: subtitle,
            lat: parseFloat(r.lat),
            lon: parseFloat(r.lon),
            isLocal: false
          };
        });

        // Combine unique results (deduplicate by proximity)
        const combined = [...localMatches];
        for (const nr of formattedNominatim) {
          const alreadyExists = combined.some(
            (c) => Math.abs(c.lat - nr.lat) < 0.002 && Math.abs(c.lon - nr.lon) < 0.002
          );
          if (!alreadyExists) {
            combined.push(nr);
          }
        }

        setSearchResults(combined);
        setIsOpenDropdown(combined.length > 0);
      }
    } catch (err) {
      console.warn('Geocoding search warning:', err);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Handle Input Changes with Real-Time Debounce
  const handleInputChange = (value: string) => {
    setSearchQuery(value);
    setSelectedIndex(-1);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (value.trim().length >= 2) {
      debounceTimerRef.current = setTimeout(() => {
        executeSearch(value);
      }, 300);
    } else {
      setSearchResults([]);
      setIsOpenDropdown(false);
    }
  };

  // Select item from suggestions list -> Move pin dynamically!
  const selectSearchResult = (item: any) => {
    const newLat = Number(Number(item.lat).toFixed(6));
    const newLng = Number(Number(item.lon || item.lng).toFixed(6));
    const addressName = item.short_name || item.display_name.split(',').slice(0, 3).join(',').trim();

    moveToCoordinates(newLat, newLng, 16, addressName);
    setSearchQuery(addressName);
    setDetectedAddress(addressName);
    setIsOpenDropdown(false);
    setSearchResults([]);
  };

  // Keyboard navigation support in search suggestions
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpenDropdown || searchResults.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeSearch(searchQuery);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
        selectSearchResult(searchResults[selectedIndex]);
      } else if (searchResults.length > 0) {
        selectSearchResult(searchResults[0]);
      }
    } else if (e.key === 'Escape') {
      setIsOpenDropdown(false);
    }
  };

  // GPS Device Geolocation
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('La geolocalización no está disponible en tu navegador');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const userLat = Number(pos.coords.latitude.toFixed(6));
        const userLng = Number(pos.coords.longitude.toFixed(6));

        moveToCoordinates(userLat, userLng, 16);
        reverseGeocode(userLat, userLng);
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation error:', err.message);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface p-2.5">
      {/* Real-time Search & Location Input Bar */}
      <div className="relative">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => {
                if (searchResults.length > 0) setIsOpenDropdown(true);
                else if (searchQuery.trim().length >= 2) executeSearch(searchQuery);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Buscar dirección en tiempo real (ej: La Carolina, Cumbayá, Av. Shyris, González Suárez...)"
              className="w-full rounded-lg bg-canvas border border-line py-1.5 pl-8 pr-8 text-xs text-ink placeholder:text-muted focus:border-primary/40 focus:outline-none shadow-inner"
            />
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-primary/80" />

            {/* Clear or loading indicator inside input */}
            <div className="absolute right-2 top-2 flex items-center gap-1">
              {isSearching ? (
                <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
              ) : searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                    setIsOpenDropdown(false);
                  }}
                  className="text-muted hover:text-ink cursor-pointer p-0.5"
                  title="Limpiar búsqueda"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={isLocating}
            className="rounded-lg bg-sky-950/80 px-2.5 py-1.5 text-xs font-semibold text-sky-400 hover:bg-sky-900 border border-sky-800/80 flex items-center gap-1 cursor-pointer disabled:opacity-50 shrink-0"
            title="Usar mi ubicación GPS actual"
          >
            {isLocating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Navigation className="h-3 w-3" />}
            <span className="hidden sm:inline">GPS</span>
          </button>
        </div>

        {/* Real-time Autocomplete Dropdown List */}
        {isOpenDropdown && searchResults.length > 0 && (
          <div className="absolute z-[1000] left-0 right-0 top-full mt-1 rounded-xl bg-surface backdrop-blur-md border border-line shadow-soft overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-800">
            <div className="bg-soft-gray px-3 py-1.5 flex items-center justify-between text-[10px] text-muted font-bold">
              <span>📍 Selecciona una ubicación para mover el pin:</span>
              <span className="text-primary">{searchResults.length} resultados</span>
            </div>

            {searchResults.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => selectSearchResult(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-primary/10 text-primary border-l-2 border-primary/40'
                      : 'text-ink hover:bg-line'
                  }`}
                >
                  <div className="flex items-start gap-2 truncate min-w-0">
                    <MapPin className={`h-4 w-4 shrink-0 mt-0.5 ${item.isLocal ? 'text-primary' : 'text-emerald-600'}`} />
                    <div className="truncate">
                      <div className="font-bold text-[11px] text-ink truncate">
                        {item.short_name || item.display_name.split(',')[0]}
                      </div>
                      <div className="text-[10px] text-muted truncate">
                        {item.subtitle || item.display_name}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 text-muted">
                    <span className="text-[9px] font-mono opacity-70">
                      {Number(item.lat).toFixed(3)}, {Number(item.lon || item.lng).toFixed(3)}
                    </span>
                    <ChevronRight className="h-3 w-3 text-muted" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Map Container */}
      <div className="relative overflow-hidden rounded-lg border border-line shadow-inner">
        <div ref={mapContainerRef} style={{ height }} className="w-full z-0" />

        {/* Map instruction badge */}
        <div className="absolute top-2 left-2 z-[400] pointer-events-none rounded-lg bg-canvas backdrop-blur-xs px-2.5 py-1 text-[10px] font-semibold text-primary border border-line shadow flex items-center gap-1.5">
          <Compass className="h-3 w-3 text-primary" />
          <span>El pin se mueve en tiempo real al buscar o hacer clic</span>
        </div>

        {/* Live coordinate badge */}
        <div className="absolute bottom-2 left-2 z-[400] rounded-lg bg-canvas px-2 py-1 text-[10px] font-mono text-ink border border-line shadow flex items-center gap-2">
          <span className="text-primary font-bold">GPS:</span>
          <span>{Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}</span>
        </div>
      </div>

      {/* Reverse Geocoding Auto-fill Banner if address detected */}
      {detectedAddress && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-primary/10 border border-primary/25 p-2 text-xs text-primary">
          <div className="flex items-start gap-1.5 min-w-0">
            <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            <div className="truncate">
              <span className="text-[10px] text-primary font-bold block">Ubicación exacta del pin:</span>
              <span className="truncate block text-ink text-[11px] font-medium">{detectedAddress}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onChange(lat, lng, detectedAddress);
              setSearchQuery(detectedAddress);
            }}
            className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-[11px] font-black text-slate-950 hover:bg-blue-400 transition-all flex items-center gap-1 cursor-pointer shadow"
            title="Copiar esta dirección al campo de texto del formulario"
          >
            <Check className="h-3 w-3" />
            <span>Usar Dirección</span>
          </button>
        </div>
      )}
    </div>
  );
};
