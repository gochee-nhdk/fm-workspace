import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  SFMappinAndEllipse,
  SFArrowUpRightSquare,
  SFSquareOnSquare,
  SFCheckmark,
  SFXmark,
  SFLocationFill,
  SFExclamationmarkCircle
} from 'sf-symbols-lib';
import { StoreItem } from '@/types/workspace';
import toast from 'react-hot-toast';

export interface MapPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  store: StoreItem | null;
}

/**
 * Normalizes and cleans Vietnamese addresses for optimal Google Maps geocoding.
 * Resolves building numbers and drops an exact pin instead of a district-level view.
 */
export function cleanAddressForMap(rawAddress: string, storeCode?: string): string {
  if (!rawAddress) return '';
  let str = rawAddress.trim()
    .replace(/[.;,]+$/, '') // remove trailing punctuation like '.' in 'TP.HCM.'
    .trim();

  // Normalize common Vietnamese abbreviations
  str = str
    .replace(/\bTP\.?HCM\b|\bTPHCM\b|\bTP\.?\s*Hồ\s*Chí\s*Minh\b/gi, 'Hồ Chí Minh')
    .replace(/\bQ\.(\d+)\b/gi, 'Quận $1')
    .replace(/\bQ\.([A-Za-zÀ-ỹ]+)\b/gi, 'Quận $1')
    .replace(/\bP\.(\d+)\b/gi, 'Phường $1')
    .replace(/\bP\.([A-Za-zÀ-ỹ]+)\b/gi, 'Phường $1');

  // Check if any Vietnamese province or city is already present in the address
  const hasKnownProvince = /hồ chí minh|hà nội|đà nẵng|bình dương|đồng nai|cần thơ|hải phòng|vũng tàu|bà rịa|bình thuận|nha trang|khánh hòa|lâm đồng|đà lạt|long an|tiền giang|bến tre|vĩnh long|an giang|kiên giang|tây ninh|huế|quảng ninh/i.test(str);

  // Only default to Ho Chi Minh if no province or major city is mentioned
  if (!hasKnownProvince) {
    str += ', Hồ Chí Minh';
  }
  if (!/việt\s*nam|vietnam/i.test(str)) {
    str += ', Việt Nam';
  }

  return str;
}

/**
 * Extracts GPS coordinates, place queries, or CID from various Google Maps URL formats.
 */
export function extractFromGoogleMapsUrl(url: string): { coords?: string; place?: string } {
  if (!url || !url.trim()) return {};
  const trimmed = url.trim();

  // Pattern 1: @10.768123,106.689123
  const atMatch = trimmed.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    return { coords: `${atMatch[1]},${atMatch[2]}` };
  }

  // Pattern 2: !3d10.768123!4d106.689123 (Google Maps protobuf /data= URL)
  const protoMatch = trimmed.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (protoMatch) {
    return { coords: `${protoMatch[1]},${protoMatch[2]}` };
  }

  // Pattern 3: ll=10.768123,106.689123 or q=10.768123,106.689123
  const llMatch = trimmed.match(/[?&](?:ll|q)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (llMatch) {
    return { coords: `${llMatch[1]},${llMatch[2]}` };
  }

  // Pattern 4: /place/Place+Name/...
  const placeMatch = trimmed.match(/\/maps\/place\/([^/@?]+)/);
  if (placeMatch) {
    const place = decodeURIComponent(placeMatch[1].replace(/\+/g, ' ')).trim();
    if (place && !place.startsWith('http')) {
      return { place };
    }
  }

  // Pattern 5: q=Text+Query
  const qMatch = trimmed.match(/[?&]q=([^&]+)/);
  if (qMatch) {
    const q = decodeURIComponent(qMatch[1].replace(/\+/g, ' ')).trim();
    if (q && !q.startsWith('http')) {
      return { place: q };
    }
  }

  return {};
}

/**
 * Produces the optimal Google Maps embed URL with guaranteed pin marker.
 * Never loads a raw URL into q= to prevent blank maps.
 */
export function getMapEmbedUrl(address: string, googleMaps?: string, storeCode?: string): { url: string; queryUsed: string; isCoordinates: boolean } {
  const extracted = extractFromGoogleMapsUrl(googleMaps || '');

  // 1. Try GPS coordinates first (most precise, always drops red pin)
  if (extracted.coords) {
    return {
      url: `https://maps.google.com/maps?q=${encodeURIComponent(extracted.coords)}&hl=vi&t=m&z=17&output=embed`,
      queryUsed: extracted.coords,
      isCoordinates: true,
    };
  }

  // 2. Try cleaned address with city + Vietnam
  if (address && address.trim()) {
    const cleanAddr = cleanAddressForMap(address, storeCode);
    return {
      url: `https://maps.google.com/maps?q=${encodeURIComponent(cleanAddr)}&hl=vi&t=m&z=17&output=embed`,
      queryUsed: cleanAddr,
      isCoordinates: false,
    };
  }

  // 3. Try extracted place name from URL
  if (extracted.place) {
    const query = `${extracted.place}, Việt Nam`;
    return {
      url: `https://maps.google.com/maps?q=${encodeURIComponent(query)}&hl=vi&t=m&z=17&output=embed`,
      queryUsed: query,
      isCoordinates: false,
    };
  }

  // 4. Fallback: Search by Store Code + Farmers Market
  if (storeCode && storeCode.trim()) {
    const fallbackQuery = `Farmers Market ${storeCode.trim()}, Hồ Chí Minh, Việt Nam`;
    return {
      url: `https://maps.google.com/maps?q=${encodeURIComponent(fallbackQuery)}&hl=vi&t=m&z=16&output=embed`,
      queryUsed: fallbackQuery,
      isCoordinates: false,
    };
  }

  // 5. Ultimate fallback: Center on Ho Chi Minh City
  return {
    url: `https://maps.google.com/maps?q=${encodeURIComponent('Hồ Chí Minh, Việt Nam')}&hl=vi&t=m&z=14&output=embed`,
    queryUsed: 'Hồ Chí Minh, Việt Nam',
    isCoordinates: false,
  };
}

/**
 * Fallback external Google Maps link
 */
export function getExternalMapUrl(address: string, googleMaps?: string, storeCode?: string): string {
  if (googleMaps && googleMaps.trim()) {
    return googleMaps.trim();
  }
  const query = address ? cleanAddressForMap(address, storeCode) : `Farmers Market ${storeCode || ''}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export const MapPreviewModal: React.FC<MapPreviewModalProps> = ({
  isOpen,
  onClose,
  store,
}) => {
  const [copied, setCopied] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [customQuery, setCustomQuery] = useState('');

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

  // Reset loading state and custom query when store changes
  useEffect(() => {
    if (isOpen) {
      setIframeLoading(true);
      setCopied(false);
      setCustomQuery('');
    }
  }, [isOpen, store]);

  const mapData = useMemo(() => {
    if (!store) return null;
    if (customQuery.trim()) {
      return {
        url: `https://maps.google.com/maps?q=${encodeURIComponent(customQuery.trim())}&hl=vi&t=m&z=17&output=embed`,
        queryUsed: customQuery.trim(),
        isCoordinates: false,
      };
    }
    return getMapEmbedUrl(store.address, store.googleMaps, store.storeCode);
  }, [store, customQuery]);

  if (!isOpen || !store) return null;

  const externalUrl = getExternalMapUrl(store.address, store.googleMaps, store.storeCode);
  const hasNoAddress = !store.address?.trim() && !store.googleMaps?.trim();

  const handleCopyAddress = () => {
    const textToCopy = store.address?.trim() || store.googleMaps || '';
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success('Đã sao chép địa chỉ cửa hàng!', { id: 'copy-address' });
    setTimeout(() => setCopied(false), 2000);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 md:p-6 animate-fadeIn select-none font-sans">
      {/* Dynamic ambient backdrop with Apple visionOS deep blur */}
      <div
        className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-2xl transition-opacity"
        onClick={onClose}
      />

      {/* Liquid Glass Modal Window */}
      <div
        className="relative w-full max-w-4xl bg-white dark:bg-[#1c1c22] rounded-[28px] border border-black/10 dark:border-white/15 shadow-[0_24px_80px_rgba(0,0,0,0.25),inset_0_1.5px_1px_rgba(255,255,255,0.95)] overflow-hidden flex flex-col z-10 transition-all duration-300 scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Apple Window Header */}
        <div className="px-5 sm:px-6 py-3.5 border-b border-black/[0.06] dark:border-white/10 flex items-center justify-between gap-4 bg-white/50 dark:bg-white/[0.03] shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Apple Maps App Lens Icon */}
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-b from-[#2997ff] to-[#0066cc] flex items-center justify-center text-white shadow-[0_4px_12px_rgba(0,113,227,0.35),inset_0_1px_1px_rgba(255,255,255,0.7)] border border-white/40 shrink-0">
              <SFMappinAndEllipse size={20} className="drop-shadow-xs" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[17px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
                  {store.storeCode}
                </h3>
                {store.type && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-black/[0.04] dark:bg-white/[0.08] text-[#555558] dark:text-[#a1a1a6] border border-black/[0.05] dark:border-white/10">
                    {store.type}
                  </span>
                )}
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#0071e3]/10 text-[#0066cc] dark:bg-[#2997ff]/15 dark:text-[#2997ff]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0071e3] dark:bg-[#2997ff] animate-pulse" />
                  Bản đồ trực tiếp
                </span>
              </div>
              <p className="text-[12.5px] text-[#76767b] dark:text-[#a1a1a6] truncate max-w-sm sm:max-w-lg">
                {store.address || 'Chưa cập nhật địa chỉ chi tiết'}
              </p>
            </div>
          </div>

          {/* Action Segmented Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Copy Address Button */}
            {store.address && (
              <button
                type="button"
                onClick={handleCopyAddress}
                className="liquid-lens-pill px-3 py-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] active:scale-95 transition-all cursor-pointer"
                title="Sao chép địa chỉ cửa hàng"
              >
                {copied ? (
                  <>
                    <SFCheckmark size={14} className="text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
                    <span className="text-emerald-600 dark:text-emerald-400">Đã chép</span>
                  </>
                ) : (
                  <>
                    <SFSquareOnSquare size={14} className="text-[#76767b]" />
                    <span className="hidden sm:inline">Sao chép</span>
                  </>
                )}
              </button>
            )}

            {/* Open Outside on Google Maps */}
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-semibold text-white bg-gradient-to-b from-[#007aff] to-[#0062cc] shadow-[0_4px_12px_rgba(0,122,255,0.35),inset_0_1px_1px_rgba(255,255,255,0.6)] border border-white/30 active:scale-95 transition-all cursor-pointer"
              title="Mở trên ứng dụng Google Maps ngoài"
            >
              <SFLocationFill size={14} />
              <span>Mở Google Maps</span>
              <SFArrowUpRightSquare size={12} className="opacity-80" />
            </a>

            {/* Apple Glass Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-[#555558] dark:text-white transition-colors cursor-pointer active:scale-90"
              title="Đóng cửa sổ"
              aria-label="Đóng"
            >
              <SFXmark size={16} className="stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Map Viewport Area */}
        <div className="relative w-full h-[440px] sm:h-[490px] md:h-[540px] bg-[#eef0f3] dark:bg-[#121216] overflow-hidden">
          {/* Missing Location Warning Banner */}
          {hasNoAddress ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 p-6 text-center bg-white/80 dark:bg-black/70 backdrop-blur-md">
              <div className="w-12 h-12 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <SFExclamationmarkCircle size={24} />
              </div>
              <h4 className="text-base font-bold text-[#1d1d1f] dark:text-white">
                Chưa có địa chỉ hoặc tọa độ cho {store.storeCode}
              </h4>
              <p className="text-xs text-[#76767b] dark:text-[#a1a1a6] max-w-md">
                Cửa hàng này hiện chưa được nhập địa chỉ chi tiết hoặc link Google Maps. Bạn có thể mở ngoài để tìm kiếm hoặc chỉnh sửa lại thông tin cửa hàng.
              </p>
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#007aff] text-white text-xs font-semibold shadow-md active:scale-95 transition-all"
              >
                <span>Tìm kiếm "{store.storeCode}" trên Google Maps</span>
                <SFArrowUpRightSquare size={14} />
              </a>
            </div>
          ) : (
            <>
              {/* Apple Loading Skeleton with Blur & Pulse */}
              {iframeLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/80 dark:bg-[#121216]/80 backdrop-blur-md transition-opacity duration-300">
                  <div className="w-9 h-9 rounded-full border-3 border-[#0071e3]/20 border-t-[#0071e3] animate-spin" />
                  <p className="text-[12.5px] font-semibold text-[#555558] dark:text-[#a1a1a6]">
                    Đang nạp định vị Google Maps...
                  </p>
                </div>
              )}

              {/* Google Maps Interactive Iframe */}
              {mapData && (
                <iframe
                  title={`Google Maps ${store.storeCode}`}
                  src={mapData.url}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  onLoad={() => setIframeLoading(false)}
                  className="w-full h-full"
                />
              )}
            </>
          )}
        </div>

        {/* Apple Liquid Glass Footer */}
        <div className="px-5 sm:px-6 py-3 border-t border-black/[0.06] dark:border-white/10 flex items-center justify-between text-xs text-[#76767b] dark:text-[#a1a1a6] bg-white/50 dark:bg-white/[0.03]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[#34c759] shadow-[0_0_6px_rgba(52,199,89,0.7)] shrink-0" />
            <span className="truncate font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
              {store.address || mapData?.queryUsed || 'Vị trí đã định vị'}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-3 shrink-0 text-[11px] font-medium opacity-80">
            <span>Cuộn chuột để thu phóng</span>
            <span>•</span>
            <span>Kéo giữ để di chuyển bản đồ</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
