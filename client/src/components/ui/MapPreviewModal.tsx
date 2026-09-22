import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, ExternalLink, Copy, Check, X, Navigation, Store, Layers } from 'lucide-react';
import { StoreItem } from '@/types/workspace';
import toast from 'react-hot-toast';

export interface MapPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  store: StoreItem | null;
}

/**
 * Extracts the best query for Google Maps embed.
 * Handles coordinates, googleMaps URL queries, and raw address string.
 */
export function getMapEmbedUrl(address: string, googleMaps?: string): string {
  let query = address?.trim() || '';

  if (googleMaps && googleMaps.trim()) {
    const trimmed = googleMaps.trim();
    // Case 1: Coordinates in URL: @10.768,106.689
    const coordsMatch = trimmed.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (coordsMatch) {
      query = `${coordsMatch[1]},${coordsMatch[2]}`;
    } else {
      // Case 2: Query param q=...
      const qMatch = trimmed.match(/[?&]q=([^&]+)/);
      if (qMatch) {
        query = decodeURIComponent(qMatch[1]);
      } else if (!query) {
        query = trimmed;
      }
    }
  }

  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&t=&z=16&ie=UTF8&iwloc=&output=embed`;
}

/**
 * Fallback external Google Maps link
 */
export function getExternalMapUrl(address: string, googleMaps?: string): string {
  if (googleMaps && googleMaps.trim()) {
    return googleMaps.trim();
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address?.trim() || '')}`;
}

export const MapPreviewModal: React.FC<MapPreviewModalProps> = ({
  isOpen,
  onClose,
  store,
}) => {
  const [copied, setCopied] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset loading state when store changes
  useEffect(() => {
    if (isOpen) {
      setIframeLoading(true);
      setCopied(false);
    }
  }, [isOpen, store]);

  if (!isOpen || !store) return null;

  const embedUrl = getMapEmbedUrl(store.address, store.googleMaps);
  const externalUrl = getExternalMapUrl(store.address, store.googleMaps);

  const handleCopyAddress = () => {
    if (!store.address) return;
    navigator.clipboard.writeText(store.address);
    setCopied(true);
    toast.success('Đã sao chép địa chỉ cửa hàng!');
    setTimeout(() => setCopied(false), 2000);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 md:p-8 animate-fadeIn">
      {/* Dynamic backdrop with Apple visionOS refraction blur */}
      <div
        className="fixed inset-0 bg-black/45 dark:bg-black/70 backdrop-blur-xl transition-opacity"
        onClick={onClose}
      />

      {/* Liquid Glass Modal Window */}
      <div
        className="relative w-full max-w-4xl bg-white/80 dark:bg-[#141419]/80 backdrop-blur-3xl rounded-3xl border border-white/80 dark:border-white/15 shadow-[0_24px_80px_rgba(0,0,0,0.25),inset_0_1.5px_1px_rgba(255,255,255,0.95),inset_0_-1px_1.5px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col z-10 transition-all duration-300 scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-5 sm:px-6 py-4 border-b border-black/[0.06] dark:border-white/10 flex items-center justify-between gap-4 bg-white/40 dark:bg-white/[0.04] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* Store Icon Lens Badge */}
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white shadow-md shadow-amber-500/30 border border-white/40 shrink-0">
              <Store className="w-5 h-5" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[17px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight truncate">
                  {store.storeCode}
                </h3>
                {store.type && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                    {store.type}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-black/5 dark:bg-white/10 text-[#76767b] dark:text-[#a1a1a6]">
                  Google Maps Preview
                </span>
              </div>
              <p className="text-[12.5px] text-[#76767b] dark:text-[#a1a1a6] truncate max-w-md sm:max-w-xl">
                {store.address}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {/* 1-Click Copy Address */}
            <button
              type="button"
              onClick={handleCopyAddress}
              className="liquid-lens-pill px-3 py-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] active:scale-95 transition-transform cursor-pointer"
              title="Sao chép địa chỉ"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400">Đã chép</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#76767b]" />
                  <span className="hidden sm:inline">Chép địa chỉ</span>
                </>
              )}
            </button>

            {/* Open Outside on Google Maps */}
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="liquid-lens-pill px-3 py-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#0066cc] dark:text-[#2997ff] active:scale-95 transition-transform cursor-pointer"
              title="Mở trên trang Google Maps"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mở ngoài</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-[#1d1d1f] dark:text-white transition-colors cursor-pointer active:scale-90"
              title="Đóng cửa sổ"
              aria-label="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Map Viewport */}
        <div className="relative w-full h-[420px] sm:h-[480px] md:h-[540px] bg-[#f0f0f2] dark:bg-[#1a1a20] overflow-hidden">
          {/* Loading Skeleton */}
          {iframeLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/70 dark:bg-black/60 backdrop-blur-md">
              <div className="w-10 h-10 rounded-full border-3 border-amber-500/20 border-t-amber-500 animate-spin" />
              <p className="text-xs font-semibold text-[#76767b] dark:text-[#a1a1a6]">
                Đang nạp Google Maps trực tiếp...
              </p>
            </div>
          )}

          {/* Google Maps Interactive Iframe */}
          <iframe
            title={`Bản đồ ${store.storeCode}`}
            src={embedUrl}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            onLoad={() => setIframeLoading(false)}
            className="w-full h-full"
          />
        </div>

        {/* Footer Info Bar */}
        <div className="px-5 sm:px-6 py-3 border-t border-black/[0.06] dark:border-white/10 flex items-center justify-between text-xs text-[#76767b] dark:text-[#a1a1a6] bg-white/40 dark:bg-white/[0.04]">
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="truncate font-medium">{store.address}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline font-mono text-[11px] opacity-70">
              Tương tác: Kéo, cuộn để thu phóng map
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
