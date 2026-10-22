import React, { useState, useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  SFClock,
  SFChevronLeft,
  SFChevronRight,
  SFCheckmark,
} from '@/components/ui/AppleIcon';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
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

// Pre-generated 30-minute time slots for the Time Listbox
const TIME_SLOTS: Array<{ h: number; m: number; label: string }> = [];
for (let h = 6; h <= 23; h++) {
  TIME_SLOTS.push({ h, m: 0, label: `${h.toString().padStart(2, '0')}:00` });
  TIME_SLOTS.push({ h, m: 30, label: `${h.toString().padStart(2, '0')}:30` });
}

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
  const { shouldRender: shouldRenderDropdown, isExiting: isDropdownExiting } = useAnimatedPresence(isOpen, 200);

  // View mode: 'calendar' | 'monthYearPicker'
  const [viewMode, setViewMode] = useState<'calendar' | 'monthYearPicker'>('calendar');

  // Toggle for Time Listbox dropdown inside picker
  const [isTimeListOpen, setIsTimeListOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const currentDate = useMemo(() => parseDatetimeLocal(value), [value]);

  // Calendar navigation state (month & year)
  const [navYear, setNavYear] = useState(currentDate.getFullYear());
  const [navMonth, setNavMonth] = useState(currentDate.getMonth());

  // Local hours & minutes
  const [hours, setHours] = useState(currentDate.getHours());
  const [minutes, setMinutes] = useState(currentDate.getMinutes());

  // Click outside listener to dismiss floating listbox
  useEffect(() => {
    if (!isOpen || embedded) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsTimeListOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, embedded]);

  // Sync internal state when external value changes
  useEffect(() => {
    const d = parseDatetimeLocal(value);
    setNavYear(d.getFullYear());
    setNavMonth(d.getMonth());
    setHours(d.getHours());
    setMinutes(d.getMinutes());
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
    const target = new Date(currentDate);
    target.setHours(targetHours, targetMinutes, 0, 0);
    setHours(targetHours);
    setMinutes(targetMinutes);
    onChange(toDatetimeLocalString(target));
  };

  const handleStepMinute = (delta: number) => {
    const totalMinutes = (hours * 60 + minutes + delta + 1440) % 1440;
    const newH = Math.floor(totalMinutes / 60);
    const newM = totalMinutes % 60;
    handleApplyPresetTime(newH, newM);
  };

  // Quick Date Presets
  const handleApplyToday = () => {
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    setNavMonth(d.getMonth());
    setNavYear(d.getFullYear());
    onChange(toDatetimeLocalString(d));
    setViewMode('calendar');
  };

  const handleApplyTomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    setHours(9);
    setMinutes(0);
    setNavMonth(d.getMonth());
    setNavYear(d.getFullYear());
    onChange(toDatetimeLocalString(d));
    setViewMode('calendar');
  };

  const handleApplyPlus1Hour = () => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    setHours(d.getHours());
    setMinutes(d.getMinutes());
    setNavMonth(d.getMonth());
    setNavYear(d.getFullYear());
    onChange(toDatetimeLocalString(d));
    setViewMode('calendar');
  };

  const handleApplyNextMonday = () => {
    const target = new Date();
    const day = target.getDay();
    const diff = (7 - day + 1) % 7 || 7;
    target.setDate(target.getDate() + diff);
    target.setHours(9, 0, 0, 0);
    setHours(9);
    setMinutes(0);
    setNavMonth(target.getMonth());
    setNavYear(target.getFullYear());
    onChange(toDatetimeLocalString(target));
    setViewMode('calendar');
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

  // Render the petite, ultra-compact Apple picker panel (270px)
  const renderPickerBody = () => (
    <div className="w-[272px] mx-auto p-2.5 rounded-2xl bg-white/95 dark:bg-[#1e1e24]/95 backdrop-blur-3xl border border-black/10 dark:border-white/12 shadow-[0_16px_40px_rgba(0,0,0,0.18)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.7)] space-y-2 select-none font-sans text-left">
      {/* 1. Petite Quick Date Pills */}
      <div className="grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-black/[0.04] dark:bg-white/[0.06]">
        <button
          type="button"
          onClick={handleApplyToday}
          className={cn(
            'py-1 rounded-md text-[10px] font-medium transition-all cursor-pointer text-center truncate',
            isToday(currentDate)
              ? 'bg-white dark:bg-[#2c2c36] text-[#0071e3] dark:text-[#2997ff] font-semibold shadow-2xs'
              : 'text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white'
          )}
        >
          Hôm nay
        </button>

        <button
          type="button"
          onClick={handleApplyTomorrow}
          className="py-1 rounded-md text-[10px] font-medium transition-all cursor-pointer text-center truncate text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 active:scale-95"
        >
          Ngày mai
        </button>

        <button
          type="button"
          onClick={handleApplyPlus1Hour}
          className="py-1 rounded-md text-[10px] font-medium transition-all cursor-pointer text-center truncate text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 active:scale-95"
        >
          Sau 1h
        </button>

        <button
          type="button"
          onClick={handleApplyNextMonday}
          className="py-1 rounded-md text-[10px] font-medium transition-all cursor-pointer text-center truncate text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 active:scale-95"
        >
          Thứ 2
        </button>
      </div>

      {/* 2. Compact Month Header */}
      <div className="flex items-center justify-between px-1 pt-0.5">
        <button
          type="button"
          onClick={() => setViewMode(viewMode === 'calendar' ? 'monthYearPicker' : 'calendar')}
          className="flex items-center gap-1 text-[12px] font-semibold text-[#1d1d1f] dark:text-white hover:text-[#0071e3] transition-colors cursor-pointer group"
          title="Nhấp để đổi tháng / năm"
        >
          <span>{MONTH_NAMES[navMonth]}, {navYear}</span>
          <ChevronDown
            size={11}
            className={cn(
              'text-[#86868b] transition-transform duration-200',
              viewMode === 'monthYearPicker' && 'rotate-180 text-[#0071e3]'
            )}
          />
        </button>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={prevMonth}
            className="w-5.5 h-5.5 rounded flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer active:scale-90"
            title="Tháng trước"
          >
            <SFChevronLeft size={10} />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="w-5.5 h-5.5 rounded flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer active:scale-90"
            title="Tháng sau"
          >
            <SFChevronRight size={10} />
          </button>
        </div>
      </div>

      {/* 3. Compact Calendar / Month Grid */}
      {viewMode === 'monthYearPicker' ? (
        <div className="grid grid-cols-3 gap-1 py-1">
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
                  'py-1.5 rounded-lg text-[10.5px] font-medium transition-all cursor-pointer',
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
      ) : (
        <div className="space-y-0.5">
          {/* Weekday Row */}
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {WEEKDAYS.map((wd) => (
              <span key={wd} className="text-[9.5px] font-medium text-[#86868b] dark:text-[#a1a1a6] py-0.5">
                {wd}
              </span>
            ))}
          </div>

          {/* Days Grid: Petite 26px cells */}
          <div className="grid grid-cols-7 gap-0.5">
            {calendarDays.map((item, index) => {
              const selected = isSelected(item.date);
              const today = isToday(item.date);

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSelectDay(item.date)}
                  className={cn(
                    'h-6.5 w-6.5 mx-auto rounded-full text-[10.5px] font-medium flex items-center justify-center transition-all cursor-pointer relative',
                    item.isCurrentMonth
                      ? 'text-[#1d1d1f] dark:text-[#f5f5f7]'
                      : 'text-[#86868b]/30 dark:text-[#a1a1a6]/25',
                    selected
                      ? 'bg-[#0071e3] text-white font-bold shadow-xs scale-105'
                      : 'hover:bg-black/5 dark:hover:bg-white/10 active:scale-95',
                    today && !selected && 'font-bold text-[#0071e3] dark:text-[#2997ff]'
                  )}
                >
                  <span>{item.date.getDate()}</span>
                  {today && !selected && (
                    <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-[#0071e3] dark:bg-[#2997ff]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Apple Time Listbox Section (Smooth Listbox / Dropdown Selection) */}
      <div className="pt-2 border-t border-black/[0.06] dark:border-white/10 space-y-1.5">
        <div className="flex items-center justify-between gap-1">
          {/* Time Capsule Trigger Button: Click to pop open the Time Listbox */}
          <button
            type="button"
            onClick={() => setIsTimeListOpen(!isTimeListOpen)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[12px] font-mono font-semibold transition-all cursor-pointer shadow-2xs border',
              isTimeListOpen
                ? 'bg-[#0071e3] text-white border-[#0071e3] shadow-xs'
                : 'bg-black/[0.035] dark:bg-white/[0.08] text-[#1d1d1f] dark:text-white border-black/10 dark:border-white/15 hover:border-[#0071e3] hover:text-[#0071e3]'
            )}
            title="Nhấp để mở danh sách chọn giờ nhanh"
          >
            <SFClock size={11} className={isTimeListOpen ? 'text-white' : 'text-[#0071e3]'} />
            <span>{`${pad(hours)}:${pad(minutes)}`}</span>
            <ChevronDown
              size={11}
              className={cn(
                'transition-transform duration-200',
                isTimeListOpen ? 'rotate-180 text-white' : 'text-[#86868b]'
              )}
            />
          </button>

          {/* Quick Preset Buttons (09:00, 14:00, 20:00) */}
          <div className="flex items-center gap-1">
            {[
              { h: 9, m: 0, label: '09:00' },
              { h: 14, m: 0, label: '14:00' },
              { h: 20, m: 0, label: '20:00' },
            ].map((p) => {
              const active = hours === p.h && minutes === p.m;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    handleApplyPresetTime(p.h, p.m);
                    setIsTimeListOpen(false);
                  }}
                  className={cn(
                    'px-1.5 py-0.5 rounded-md text-[10px] font-mono font-medium transition-all cursor-pointer',
                    active
                      ? 'bg-[#0071e3] text-white font-semibold shadow-2xs'
                      : 'bg-black/[0.03] dark:bg-white/[0.05] hover:bg-[#0071e3]/10 text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#0071e3]'
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Smooth Expandable Time Listbox (Animated Dropdown with Full Motion) */}
        {isTimeListOpen && (
          <div className="p-1.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/10 space-y-1 animate-in fade-in-0 zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-1 text-[9.5px] font-semibold text-[#86868b] uppercase tracking-wider">
              <span>Chọn giờ trong ngày</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleStepMinute(-15)}
                  className="px-1 py-0.5 rounded bg-black/5 dark:bg-white/10 hover:text-[#0071e3]"
                  title="Giảm 15 phút"
                >
                  -15m
                </button>
                <button
                  type="button"
                  onClick={() => handleStepMinute(15)}
                  className="px-1 py-0.5 rounded bg-black/5 dark:bg-white/10 hover:text-[#0071e3]"
                  title="Tăng 15 phút"
                >
                  +15m
                </button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1 max-h-32 overflow-y-auto pr-0.5 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-black/15 [&::-webkit-scrollbar-thumb]:rounded-full">
              {TIME_SLOTS.map((slot) => {
                const isSlotActive = hours === slot.h && minutes === slot.m;
                return (
                  <button
                    key={slot.label}
                    type="button"
                    onClick={() => {
                      handleApplyPresetTime(slot.h, slot.m);
                      setIsTimeListOpen(false);
                    }}
                    className={cn(
                      'py-1 rounded-md text-[10px] font-mono font-medium transition-all cursor-pointer text-center',
                      isSlotActive
                        ? 'bg-[#0071e3] text-white font-semibold shadow-2xs'
                        : 'bg-white dark:bg-[#252530] text-[#1d1d1f] dark:text-white hover:bg-[#0071e3]/10 hover:text-[#0071e3] border border-black/5 dark:border-white/5'
                    )}
                  >
                    {slot.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 5. Minimal Footer: Summary & Clean Small Done Button */}
      {!embedded && (
        <div className="pt-1.5 border-t border-black/[0.06] dark:border-white/10 flex items-center justify-between">
          <span className="text-[10px] text-[#86868b] dark:text-[#a1a1a6] font-medium truncate">
            {`${pad(currentDate.getDate())}/${pad(currentDate.getMonth() + 1)} lúc ${pad(hours)}:${pad(minutes)}`}
          </span>

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setIsTimeListOpen(false);
            }}
            className="px-3.5 py-1 rounded-full text-[11px] font-semibold bg-[#0071e3] text-white hover:bg-[#0077ed] transition-all cursor-pointer shadow-2xs active:scale-95"
          >
            Xong
          </button>
        </div>
      )}
    </div>
  );

  // If embedded, render directly in-flow
  if (embedded) {
    return (
      <div className={cn('w-full select-none font-sans', className)}>
        {renderPickerBody()}
      </div>
    );
  }

  // Dropdown / Popover Listbox Mode (Floats over content with Apple Fluid Spring Animation)
  return (
    <div ref={containerRef} className={cn('relative w-full select-none font-sans', className)}>
      {/* ─────────────────── Apple Liquid Glass Trigger Capsule ─────────────────── */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-[12.5px] font-medium transition-all cursor-pointer shadow-2xs',
          'bg-black/[0.02] dark:bg-white/[0.04] border border-black/15 dark:border-white/20',
          'hover:bg-black/[0.04] dark:hover:bg-white/[0.08] hover:border-[#0071e3]/40 dark:hover:border-[#2997ff]/40',
          isOpen && 'ring-2 ring-[#0071e3]/25 border-[#0071e3] dark:border-[#2997ff] bg-white dark:bg-[#1f1f28]'
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5.5 h-5.5 rounded-lg bg-[#0071e3]/10 text-[#0071e3] dark:text-[#2997ff] flex items-center justify-center shrink-0">
            <CalendarIcon size={12} />
          </div>
          <span className="font-semibold text-[#1d1d1f] dark:text-white truncate">
            {formatVietnameseDateDisplay(currentDate)}
          </span>
          <span className="text-[#86868b] dark:text-[#a1a1a6] font-mono text-[10px]">•</span>
          <div className="flex items-center gap-1 text-[#0071e3] dark:text-[#2997ff] font-semibold font-mono text-[12px]">
            <SFClock size={11} />
            <span>{`${pad(hours)}:${pad(minutes)}`}</span>
          </div>
        </div>

        <ChevronDown
          size={13}
          className={cn(
            'text-[#86868b] transition-transform duration-200 shrink-0 ml-1.5',
            isOpen && 'rotate-180 text-[#0071e3]'
          )}
        />
      </button>

      {/* ─────────────────── Floating Apple Spring Listbox Popover (120 FPS Physics) ─────────────────── */}
      {shouldRenderDropdown && (
        <div
          className={cn(
            'absolute top-full left-0 right-0 z-50 mt-2 flex justify-center pointer-events-auto',
            'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] origin-top',
            isDropdownExiting
              ? 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
              : 'opacity-100 scale-100 translate-y-0'
          )}
        >
          {renderPickerBody()}
        </div>
      )}
    </div>
  );
};
