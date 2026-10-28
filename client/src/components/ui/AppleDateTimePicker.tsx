import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import {
  SFClock,
  SFChevronLeft,
  SFChevronRight,
  SFCheckmark,
} from '@/components/ui/AppleIcon';
import { Calendar as CalendarIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { useAnimatedPresence } from '@/hooks/useAnimatedPresence';

export interface AppleDateTimePickerProps {
  value?: string; // Format: YYYY-MM-DDTHH:mm
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  embedded?: boolean; // When true, renders directly inside card without collapsible trigger
  defaultOpen?: boolean;
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const MONTH_NAMES = [
  'Tháng 1',
  'Tháng 2',
  'Tháng 3',
  'Tháng 4',
  'Tháng 5',
  'Tháng 6',
  'Tháng 7',
  'Tháng 8',
  'Tháng 9',
  'Tháng 10',
  'Tháng 11',
  'Tháng 12',
];

const pad = (n: number) => n.toString().padStart(2, '0');

export const toDatetimeLocalString = (date: Date): string => {
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
};

export const parseDatetimeLocal = (val?: string): Date => {
  if (!val) return new Date(Date.now() + 30 * 60 * 1000);
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? new Date(Date.now() + 30 * 60 * 1000) : parsed;
};

export const formatVietnameseDateDisplay = (date: Date): string => {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  const isTomorrow =
    date.getDate() === tomorrow.getDate() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getFullYear() === tomorrow.getFullYear();

  const daysOfWeek = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const dayName = daysOfWeek[date.getDay()];

  if (isToday) return `Hôm nay (${pad(date.getDate())}/${pad(date.getMonth() + 1)})`;
  if (isTomorrow) return `Ngày mai (${pad(date.getDate())}/${pad(date.getMonth() + 1)})`;
  return `${dayName}, ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
};

export const AppleDateTimePicker: React.FC<AppleDateTimePickerProps> = ({
  value,
  onChange,
  className,
  placeholder = 'Chọn ngày giờ nhắc hẹn...',
  embedded = false,
  defaultOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(embedded || defaultOpen);
  const { shouldRender: shouldRenderDropdown, isExiting: isDropdownExiting } = useAnimatedPresence(isOpen, 220);

  // View mode: 'calendar' | 'monthPicker' | 'yearPicker'
  const [viewMode, setViewMode] = useState<'calendar' | 'monthPicker' | 'yearPicker'>('calendar');

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const currentDate = useMemo(() => parseDatetimeLocal(value), [value]);

  // Floating Popover positioning
  const [popoverCoords, setPopoverCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    placement: 'bottom' | 'top';
  } | null>(null);

  const calculateCoords = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const pickerWidth = 288;
    const pickerHeight = 310;
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;

    // Check if on compact mobile viewport
    const isMobileViewport = viewportW < 480 || viewportH < 560;
    if (isMobileViewport) {
      setPopoverCoords(null); // Centered modal pop-up
      return;
    }

    const spaceBelow = viewportH - rect.bottom;
    const spaceAbove = rect.top;

    let placement: 'bottom' | 'top' = 'bottom';

    if (spaceBelow < pickerHeight && spaceAbove > spaceBelow) {
      placement = 'top';
    }

    let left = rect.left + (rect.width - pickerWidth) / 2;
    left = Math.max(12, Math.min(viewportW - pickerWidth - 12, left));

    setPopoverCoords({
      top: placement === 'bottom' ? rect.bottom + 6 : undefined,
      bottom: placement === 'top' ? viewportH - rect.top + 6 : undefined,
      left,
      placement,
    });
  }, []);

  useEffect(() => {
    if (isOpen && !embedded) {
      calculateCoords();
      window.addEventListener('resize', calculateCoords);
      window.addEventListener('scroll', calculateCoords, true);
      return () => {
        window.removeEventListener('resize', calculateCoords);
        window.removeEventListener('scroll', calculateCoords, true);
      };
    }
  }, [isOpen, embedded, calculateCoords]);

  // Calendar navigation state (month & year)
  const [navYear, setNavYear] = useState(currentDate.getFullYear());
  const [navMonth, setNavMonth] = useState(currentDate.getMonth());
  const [yearInputStr, setYearInputStr] = useState(() => String(currentDate.getFullYear()));

  useEffect(() => {
    setYearInputStr(String(navYear));
  }, [navYear]);

  // Local hours & minutes
  const [hours, setHours] = useState(currentDate.getHours());
  const [minutes, setMinutes] = useState(currentDate.getMinutes());

  // Local input string states for smooth typing
  const [hourInputStr, setHourInputStr] = useState(pad(currentDate.getHours()));
  const [minInputStr, setMinInputStr] = useState(pad(currentDate.getMinutes()));

  // Sync internal state when external value changes
  useEffect(() => {
    const d = parseDatetimeLocal(value);
    setNavYear(d.getFullYear());
    setNavMonth(d.getMonth());
    setHours(d.getHours());
    setMinutes(d.getMinutes());
    setHourInputStr(pad(d.getHours()));
    setMinInputStr(pad(d.getMinutes()));
  }, [value]);

  // Calendar day calculation
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(navYear, navMonth, 1);
    const lastDayOfMonth = new Date(navYear, navMonth + 1, 0);

    let startingDay = firstDayOfMonth.getDay() - 1;
    if (startingDay === -1) startingDay = 6;

    const days = [];
    const prevMonthLastDay = new Date(navYear, navMonth, 0).getDate();

    // Previous month filler days
    for (let i = startingDay - 1; i >= 0; i--) {
      days.push({
        date: new Date(navYear, navMonth - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      days.push({
        date: new Date(navYear, navMonth, i),
        isCurrentMonth: true,
      });
    }

    // Next month filler days (fill up to complete weeks)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(navYear, navMonth + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [navYear, navMonth]);

  const handleSelectDay = (targetDate: Date) => {
    const newDate = new Date(targetDate);
    newDate.setHours(hours, minutes, 0, 0);
    if (newDate.getMonth() !== navMonth) {
      setNavMonth(newDate.getMonth());
      setNavYear(newDate.getFullYear());
    }
    onChange(toDatetimeLocalString(newDate));
  };

  const handleApplyPresetTime = (targetHours: number, targetMinutes: number) => {
    const clampedH = Math.max(0, Math.min(23, targetHours));
    const clampedM = Math.max(0, Math.min(59, targetMinutes));
    const target = new Date(currentDate);
    target.setHours(clampedH, clampedM, 0, 0);
    setHours(clampedH);
    setMinutes(clampedM);
    setHourInputStr(pad(clampedH));
    setMinInputStr(pad(clampedM));
    onChange(toDatetimeLocalString(target));
  };

  const handleStepMinute = (delta: number) => {
    const totalMinutes = (hours * 60 + minutes + delta + 1440) % 1440;
    const newH = Math.floor(totalMinutes / 60);
    const newM = totalMinutes % 60;
    handleApplyPresetTime(newH, newM);
  };

  const handleHourBlur = () => {
    let parsed = parseInt(hourInputStr, 10);
    if (isNaN(parsed)) parsed = hours;
    parsed = Math.max(0, Math.min(23, parsed));
    handleApplyPresetTime(parsed, minutes);
  };

  const handleMinuteBlur = () => {
    let parsed = parseInt(minInputStr, 10);
    if (isNaN(parsed)) parsed = minutes;
    parsed = Math.max(0, Math.min(59, parsed));
    handleApplyPresetTime(hours, parsed);
  };

  const prevMonth = () => {
    if (navMonth === 0) {
      setNavMonth(11);
      setNavYear((y) => y - 1);
    } else {
      setNavMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (navMonth === 11) {
      setNavMonth(0);
      setNavYear((y) => y + 1);
    } else {
      setNavMonth((m) => m + 1);
    }
  };

  const prevYear = () => {
    setNavYear((y) => Math.max(0, y - 1));
  };

  const nextYear = () => {
    setNavYear((y) => Math.min(9999, y + 1));
  };

  const isToday = (d: Date) => {
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  };

  const isSelected = (d: Date) => {
    return (
      d.getDate() === currentDate.getDate() &&
      d.getMonth() === currentDate.getMonth() &&
      d.getFullYear() === currentDate.getFullYear()
    );
  };

  // Render the petite, ultra-compact square Apple picker panel
  const renderPickerBody = () => (
    <div className="w-[288px] mx-auto p-3.5 rounded-2xl bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl border border-black/[0.08] dark:border-white/[0.12] shadow-[0_20px_50px_rgba(0,0,0,0.18)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.65)] space-y-2.5 select-none font-sans text-left">
      {/* 1. Month & Year Navigation Header: Separated Month & Year controls */}
      <div className="flex items-center justify-between gap-1.5 px-0.5">
        {/* Month Selector Capsule */}
        <div className="flex items-center bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/10 rounded-xl p-0.5">
          <button
            type="button"
            onClick={prevMonth}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer active:scale-90"
            title="Tháng trước"
          >
            <SFChevronLeft size={11} />
          </button>

          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'monthPicker' ? 'calendar' : 'monthPicker')}
            className={cn(
              'px-2.5 py-0.5 rounded-lg text-[12.5px] font-semibold transition-all cursor-pointer select-none',
              viewMode === 'monthPicker'
                ? 'bg-[#0071e3]/12 text-[#0071e3] dark:text-[#2997ff] ring-1 ring-[#0071e3]/30 shadow-2xs'
                : 'text-[#1d1d1f] dark:text-white hover:text-[#0071e3]'
            )}
            title="Nhấp để mở bảng chọn 12 tháng"
          >
            <span>{MONTH_NAMES[navMonth]}</span>
          </button>

          <button
            type="button"
            onClick={nextMonth}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer active:scale-90"
            title="Tháng sau"
          >
            <SFChevronRight size={11} />
          </button>
        </div>

        {/* Year Navigator Capsule with dedicated Left / Right navigation & interactive Click */}
        <div className="flex items-center bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/10 rounded-xl p-0.5">
          <button
            type="button"
            onClick={prevYear}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-[#86868b] hover:text-[#0071e3] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer active:scale-90"
            title="Năm trước"
          >
            <SFChevronLeft size={11} />
          </button>

          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'yearPicker' ? 'calendar' : 'yearPicker')}
            className={cn(
              'px-2.5 py-0.5 rounded-lg text-[12.5px] font-semibold transition-all cursor-pointer select-none tabular-nums',
              viewMode === 'yearPicker'
                ? 'bg-[#0071e3]/12 text-[#0071e3] dark:text-[#2997ff] ring-1 ring-[#0071e3]/30 shadow-2xs'
                : 'text-[#1d1d1f] dark:text-white hover:text-[#0071e3]'
            )}
            title="Nhấp để mở bảng chọn năm (0 - 9999)"
          >
            <span>{navYear}</span>
          </button>

          <button
            type="button"
            onClick={nextYear}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-[#86868b] hover:text-[#0071e3] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer active:scale-90"
            title="Năm sau"
          >
            <SFChevronRight size={11} />
          </button>
        </div>
      </div>

      {/* 2. Calendar Body */}
      {viewMode === 'monthPicker' ? (
        <div className="grid grid-cols-3 gap-1.5 py-1 animate-in fade-in zoom-in-95 duration-150 ease-out">
          {MONTH_NAMES.map((mName, mIdx) => {
            const isCurrMonth = mIdx === navMonth;
            return (
              <button
                key={mName}
                type="button"
                onClick={() => {
                  setNavMonth(mIdx);
                  const newD = new Date(currentDate);
                  newD.setFullYear(navYear);
                  newD.setMonth(mIdx);
                  onChange(toDatetimeLocalString(newD));
                  setViewMode('calendar');
                }}
                className={cn(
                  'py-2 rounded-xl text-[11px] font-medium transition-all cursor-pointer',
                  isCurrMonth
                    ? 'bg-[#0071e3] text-white font-semibold shadow-2xs'
                    : 'hover:bg-black/5 dark:hover:bg-white/10 text-[#1d1d1f] dark:text-[#f5f5f7]'
                )}
              >
                {mName}
              </button>
            );
          })}
        </div>
      ) : viewMode === 'yearPicker' ? (
        <div className="space-y-2 py-1 animate-in fade-in zoom-in-95 duration-150 ease-out">
          {/* Quick Year Jump Input & Decade Steppers */}
          <div className="flex items-center gap-1 px-1.5 py-1 bg-black/[0.03] dark:bg-white/[0.05] rounded-xl border border-black/5 dark:border-white/10">
            <button
              type="button"
              onClick={() => setNavYear((y) => Math.max(0, y - 10))}
              className="px-1.5 py-0.5 rounded-lg text-[10.5px] font-semibold text-[#86868b] hover:text-[#0071e3] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title="Lùi 10 năm"
            >
              -10
            </button>
            <input
              type="number"
              min={0}
              max={9999}
              value={yearInputStr}
              onChange={(e) => {
                const val = e.target.value;
                setYearInputStr(val);
                const parsed = parseInt(val, 10);
                if (!isNaN(parsed) && parsed >= 0 && parsed <= 9999) {
                  setNavYear(parsed);
                  const newD = new Date(currentDate);
                  newD.setFullYear(parsed);
                  newD.setMonth(navMonth);
                  onChange(toDatetimeLocalString(newD));
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setViewMode('calendar');
                }
              }}
              placeholder="0 - 9999"
              className="flex-1 bg-transparent text-center font-bold text-[13px] text-[#1d1d1f] dark:text-white outline-none tabular-nums"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setNavYear((y) => Math.min(9999, y + 10))}
              className="px-1.5 py-0.5 rounded-lg text-[10.5px] font-semibold text-[#86868b] hover:text-[#0071e3] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title="Tiến 10 năm"
            >
              +10
            </button>
          </div>

          {/* Quick Select Grid around current year */}
          <div className="grid grid-cols-3 gap-1.5 max-h-[140px] overflow-y-auto scrollbar-thin pr-0.5">
            {Array.from({ length: 15 }, (_, i) => Math.max(0, Math.min(9999, navYear - 7 + i))).map((y) => {
              const isCurrYear = y === navYear;
              return (
                <button
                  key={y}
                  type="button"
                  onClick={() => {
                    setNavYear(y);
                    const newD = new Date(currentDate);
                    newD.setFullYear(y);
                    newD.setMonth(navMonth);
                    onChange(toDatetimeLocalString(newD));
                    setViewMode('calendar');
                  }}
                  className={cn(
                    'py-1.5 rounded-xl text-[12px] font-medium transition-all cursor-pointer tabular-nums',
                    isCurrYear
                      ? 'bg-[#0071e3] text-white font-semibold shadow-2xs'
                      : 'hover:bg-black/5 dark:hover:bg-white/10 text-[#1d1d1f] dark:text-[#f5f5f7]'
                  )}
                >
                  {y}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-1 animate-in fade-in duration-150 ease-out">
          {/* Weekday Row */}
          <div className="grid grid-cols-7 gap-1 text-center py-0.5">
            {WEEKDAYS.map((wd) => (
              <span key={wd} className="text-[10px] font-semibold text-[#86868b] dark:text-[#a1a1a6]">
                {wd}
              </span>
            ))}
          </div>

          {/* Days Grid: Uniform 30px Circular Hit Targets */}
          <div className="grid grid-cols-7 gap-1 place-items-center">
            {calendarDays.map((item, index) => {
              const selected = isSelected(item.date);
              const today = isToday(item.date);
              const dayNum = item.date.getDate();

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSelectDay(item.date)}
                  className={cn(
                    'w-[30px] h-[30px] rounded-full text-[12px] font-medium flex items-center justify-center transition-all cursor-pointer relative',
                    item.isCurrentMonth
                      ? 'text-[#1d1d1f] dark:text-[#f5f5f7]'
                      : 'text-[#86868b]/30 dark:text-[#a1a1a6]/25',
                    selected &&
                      'bg-[#0071e3] text-white font-semibold shadow-[0_2px_8px_rgba(0,113,227,0.4)] ring-0',
                    today &&
                      !selected &&
                      'font-bold text-[#0071e3] dark:text-[#2997ff] bg-[#0071e3]/12 ring-1 ring-[#0071e3]/30',
                    !selected && 'hover:bg-black/5 dark:hover:bg-white/10 active:scale-95'
                  )}
                >
                  <span className="tabular-nums leading-none">{dayNum}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Detailed Time Capsule & Done Action Bar */}
      <div className="pt-2 border-t border-black/[0.06] dark:border-white/10 flex items-center justify-between gap-2">
        {/* Detailed Time Capsule [ ⏰ HH : MM ▲/▼ ] */}
        <div className="flex items-center bg-black/[0.03] dark:bg-white/[0.05] border border-black/10 dark:border-white/15 rounded-xl px-2.5 py-1 shadow-2xs">
          <SFClock size={13} className="text-[#0071e3] dark:text-[#2997ff] mr-1.5 shrink-0" />
          
          <input
            type="text"
            inputMode="numeric"
            maxLength={2}
            value={hourInputStr}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '');
              setHourInputStr(val);
              if (val.length === 2) {
                const h = Math.min(23, parseInt(val, 10));
                handleApplyPresetTime(h, minutes);
              }
            }}
            onBlur={handleHourBlur}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                handleApplyPresetTime((hours + 1) % 24, minutes);
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                handleApplyPresetTime((hours + 23) % 24, minutes);
              }
            }}
            className="w-6 text-center font-semibold text-[13px] tabular-nums bg-transparent text-[#1d1d1f] dark:text-white border-0 p-0 focus:ring-0 focus:outline-none"
            title="Giờ (Gõ số hoặc phím Mũi tên Lên/Xuống)"
          />

          <span className="font-bold text-[#86868b] dark:text-[#a1a1a6] text-[13px] px-0.5">:</span>

          <input
            type="text"
            inputMode="numeric"
            maxLength={2}
            value={minInputStr}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '');
              setMinInputStr(val);
              if (val.length === 2) {
                const m = Math.min(59, parseInt(val, 10));
                handleApplyPresetTime(hours, m);
              }
            }}
            onBlur={handleMinuteBlur}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                handleStepMinute(5);
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                handleStepMinute(-5);
              }
            }}
            className="w-6 text-center font-semibold text-[13px] tabular-nums bg-transparent text-[#1d1d1f] dark:text-white border-0 p-0 focus:ring-0 focus:outline-none"
            title="Phút (Gõ số hoặc phím Mũi tên Lên/Xuống)"
          />

          {/* Up / Down Stepper Buttons */}
          <div className="flex flex-col ml-1.5 pl-1.5 border-l border-black/10 dark:border-white/10 gap-0.5">
            <button
              type="button"
              onClick={() => handleStepMinute(5)}
              className="w-3.5 h-2.5 flex items-center justify-center text-[#86868b] hover:text-[#0071e3] transition-colors cursor-pointer"
              title="Tăng 5 phút"
            >
              <ChevronUp size={10} />
            </button>
            <button
              type="button"
              onClick={() => handleStepMinute(-5)}
              className="w-3.5 h-2.5 flex items-center justify-center text-[#86868b] hover:text-[#0071e3] transition-colors cursor-pointer"
              title="Giảm 5 phút"
            >
              <ChevronDown size={10} />
            </button>
          </div>
        </div>

        {/* Done / Confirm button */}
        {!embedded && (
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-4 py-1.5 rounded-xl text-[12px] font-semibold bg-[#0071e3] text-white hover:bg-[#0077ed] transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0"
          >
            Xong
          </button>
        )}
      </div>
    </div>
  );

  // If embedded mode is active, render picker directly
  if (embedded) {
    return (
      <div ref={containerRef} className={cn('relative w-full', className)}>
        {renderPickerBody()}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn('relative w-full select-none font-sans', className)}>
      {/* ─────────────────── Apple Liquid Glass Trigger Capsule ─────────────────── */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          calculateCoords();
          setIsOpen(!isOpen);
        }}
        className={cn(
          'w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-[12.5px] font-medium transition-all cursor-pointer shadow-2xs',
          'bg-black/[0.02] dark:bg-white/[0.04] border border-black/15 dark:border-white/20',
          'text-[#1d1d1f] dark:text-[#f5f5f7] hover:border-[#0071e3]/60 dark:hover:border-[#0071e3]/60',
          isOpen && 'border-[#0071e3] ring-2 ring-[#0071e3]/20 dark:border-[#2997ff]'
        )}
      >
        <span className="flex items-center gap-2 truncate">
          <CalendarIcon size={14} className="text-[#0071e3] dark:text-[#2997ff] shrink-0" />
          <span className="truncate font-semibold">
            {formatVietnameseDateDisplay(currentDate)}
          </span>
          <span className="text-[#86868b] dark:text-[#a1a1a6]">•</span>
          <SFClock size={13} className="text-[#0071e3] dark:text-[#2997ff] shrink-0" />
          <span className="font-semibold text-[#0071e3] dark:text-[#2997ff] tabular-nums">
            {pad(hours)}:{pad(minutes)}
          </span>
        </span>

        <ChevronDown
          size={14}
          className={cn(
            'text-[#86868b] transition-transform duration-200 shrink-0 ml-2',
            isOpen && 'rotate-180 text-[#0071e3] dark:text-[#2997ff]'
          )}
        />
      </button>

      {/* ─────────────────── Floating Apple Spring Popover (Portal-based) ─────────────────── */}
      {shouldRenderDropdown &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Chọn thời gian nhắc việc"
            className={cn(
              'fixed inset-0 z-[10030] pointer-events-auto select-none',
              popoverCoords
                ? 'overflow-visible'
                : 'flex items-center justify-center p-4 bg-black/25 dark:bg-black/50 backdrop-blur-xs'
            )}
            onClick={() => setIsOpen(false)}
          >
            {/* Click-outside backdrop in anchored mode */}
            {popoverCoords && (
              <div
                className="fixed inset-0 bg-transparent pointer-events-auto"
                onClick={() => setIsOpen(false)}
              />
            )}

            <div
              style={
                popoverCoords
                  ? {
                      position: 'fixed',
                      top: popoverCoords.placement === 'bottom' ? `${popoverCoords.top}px` : 'auto',
                      bottom: popoverCoords.placement === 'top' ? `${popoverCoords.bottom}px` : 'auto',
                      left: `${popoverCoords.left}px`,
                      transformOrigin: popoverCoords.placement === 'top' ? 'bottom center' : 'top center',
                    }
                  : undefined
              }
              className={cn(
                'relative z-10',
                isDropdownExiting
                  ? popoverCoords?.placement === 'top'
                    ? 'apple-picker-close-up pointer-events-none'
                    : 'apple-picker-close pointer-events-none'
                  : popoverCoords?.placement === 'top'
                  ? 'apple-picker-open-up pointer-events-auto'
                  : 'apple-picker-open pointer-events-auto'
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {renderPickerBody()}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
