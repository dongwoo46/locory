'use client';

import { useEffect, useRef } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { CITY_CENTERS, RATING_COLORS } from './map.constants';
import type { Place } from './map.types';

export function PinMarker({
  color,
  selected,
  order,
  photoUrl,
  name,
  categoryLabel,
  rating,
  ratingLabel,
}: {
  color: string;
  selected: boolean;
  order?: number;
  photoUrl?: string | null;
  name: string;
  categoryLabel: string;
  rating?: string | null;
  ratingLabel?: string;
}) {
  if (order !== undefined) {
    return (
      <div
        className="flex items-center justify-center rounded-full text-white font-bold shadow-lg border-2 border-white"
        style={{ width: 28, height: 28, backgroundColor: color, fontSize: 11 }}
      >
        {order}
      </div>
    );
  }

  if (photoUrl) {
    const width = selected ? 72 : 60;
    return (
      <div style={{ position: 'relative', width, display: 'inline-block' }}>
        <div
          style={{
            width,
            borderRadius: 8,
            overflow: 'hidden',
            border: `2px solid ${selected ? '#111' : 'white'}`,
            boxShadow: selected
              ? '0 4px 12px rgba(0,0,0,0.4)'
              : '0 2px 8px rgba(0,0,0,0.25)',
            backgroundColor: 'white',
            transition: 'all 0.15s',
          }}
        >
          <div style={{ width: '100%', aspectRatio: '4/3', overflow: 'hidden' }}>
            <img
              src={photoUrl}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          </div>
          <div style={{ padding: '2px 4px 3px', backgroundColor: 'white' }}>
            <p
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: '#111',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: 1.3,
                marginBottom: 1,
              }}
            >
              {name}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  backgroundColor: color,
                  flexShrink: 0,
                  display: 'inline-block',
                }}
              />
              <span
                style={{
                  fontSize: 8,
                  color: '#888',
                  lineHeight: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {categoryLabel}
              </span>
            </div>
            {rating && ratingLabel && RATING_COLORS[rating] && (
              <div
                style={{
                  marginTop: 2,
                  display: 'inline-block',
                  padding: '1px 4px',
                  borderRadius: 4,
                  backgroundColor: RATING_COLORS[rating],
                  color: 'white',
                  fontSize: 8,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {ratingLabel}
              </div>
            )}
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: -5,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: `5px solid ${selected ? '#111' : 'white'}`,
            filter: selected
              ? 'none'
              : 'drop-shadow(0 2px 2px rgba(0,0,0,0.15))',
          }}
        />
      </div>
    );
  }

  return (
    <svg
      width={selected ? 22 : 16}
      height={selected ? 30 : 22}
      viewBox="0 0 16 22"
      style={{
        transition: 'all 0.15s',
        filter: selected
          ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))'
          : 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
      }}
    >
      <path
        d="M8 0C3.6 0 0 3.6 0 8c0 5.4 8 14 8 14s8-8.6 8-14C16 3.6 12.4 0 8 0z"
        fill={color}
      />
      <circle cx="8" cy="8" r="3" fill="white" opacity="0.9" />
    </svg>
  );
}

export function CityNavigator({ city }: { city: string | null }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    if (!city) {
      map.panTo({ lat: 36.5, lng: 127.8 });
      map.setZoom(7);
    } else {
      const c = CITY_CENTERS[city];
      if (c) {
        map.panTo({ lat: c.lat, lng: c.lng });
        map.setZoom(c.zoom);
      }
    }
  }, [map, city]);
  return null;
}

export function PlacePanner({ place }: { place: Place | null }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !place) return;
    map.panTo({ lat: place.lat, lng: place.lng });
  }, [map, place]);
  return null;
}

export function RoutePolyline({
  points,
  color = '#1a1a1a',
  onActivate,
}: {
  points: { lat: number; lng: number }[];
  color?: string;
  onActivate?: () => void;
}) {
  const map = useMap();
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map || !points.length) return;
    if (polylineRef.current) polylineRef.current.setMap(null);
    polylineRef.current = new window.google.maps.Polyline({
      path: points,
      geodesic: true,
      strokeColor: color,
      strokeOpacity: 0.85,
      strokeWeight: 5,
    });
    polylineRef.current.setMap(map);
    if (onActivate) {
      polylineRef.current.addListener('click', onActivate);
      polylineRef.current.addListener('mouseover', onActivate);
    }
    return () => {
      if (polylineRef.current) polylineRef.current.setMap(null);
    };
  }, [map, points, color, onActivate]);

  return null;
}
