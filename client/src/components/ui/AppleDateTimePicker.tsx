import React, { useState, useEffect, useMemo, useRef } from 'react';
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

  // View mode: 'calendar' | 'monthYearPicker'
  const [viewMode, setViewMode] = useState<'calendar' | 'monthYearPicker'>('calendar');

  const containerRef = useRef<HTMLDivElement>(null);
  const currentDate = useMemo(() => parseDatetimeLocal(value), [value]);

  // Calendar navigation state (month & year)
  const [navYear, setNavYear] = useState(currentDate.getFullYear());
  const [navMonth, setNavMonth] = useState(currentDate.getMonth());

  // Local hours & minutes
  const [hours, setHours] = useState(currentDate.getHours());
  const [minutes, setMinutes] = useState(currentDate.getMinutes());

  // Local input string states for smooth typing
  const [hourInputStr, setHourInputStr] = useState(pad(currentDate.getHours()));
  const [minInputStr, setMinInputStr] = useState(pad(currentDate.getMinutes()));

  // Click outside listener to dismiss floating popover
  useEffect(() => {
    if (!isOpen || embedded) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
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
    d.setHours(hours, minutes, 0, 0);
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
    target.setHours(hours, minutes, 0, 0);
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

  // Render the petite, ultra-compact Apple picker panel
  const renderPickerBody = () => (
    <div className="w-[316px] mx-auto p-3.5 rounded-2xl bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl border border-black/[0.08] dark:border-white/[0.12] shadow-[0_20px_50px_rgba(0,0,0,0.18)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.65)] space-y-3 select-none font-sans text-left">
      {/* 1. Quick Date Segmented Chips */}
      <div className="grid grid-cols-4 gap-1 p-0.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.06]">
        <button
          type="button"
          onClick={handleApplyToday}
          className={cn(
            'py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer text-center truncate',
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
          className="py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer text-center truncate text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 active:scale-95"
        >
          Ngày mai
        </button>

        <button
          type="button"
          onClick={handleApplyPlus1Hour}
          className="py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer text-center truncate text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 active:scale-95"
        >
          Sau 1h
        </button>

        <button
          type="button"
          onClick={handleApplyNextMonday}
          className="py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer text-center truncate text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 active:scale-95"
        >
          Thứ 2
        </button>
      </div>

      {/* 2. Month & Year Navigation Header */}
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => setViewMode(viewMode === 'calendar' ? 'monthYearPicker' : 'calendar')}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-[#1d1d1f] dark:text-white hover:text-[#0071e3] transition-colors cursor-pointer group"
          title="Nhấp để đổi tháng / năm"
        >
          <span className="tabular-nums">{MONTH_NAMES[navMonth]}, {navYear}</span>
          <ChevronDown
            size={12}
            className={cn(
              'text-[#86868b] transition-transform duration-200',
              viewMode === 'monthYearPicker' && 'rotate-180 text-[#0071e3]'
            )}
          />
        </button>

        <div className="flex items-center gap-1">
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
            onClick={nextMonth}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer active:scale-90"
            title="Tháng sau"
          >
            <SFChevronRight size={11} />
          </button>
        </div>
      </div>

      {/* 3. Calendar Body */}
      {viewMode === 'monthYearPicker' ? (
        <div className="grid grid-cols-3 gap-1.5 py-1">
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
      ) : (
        <div className="space-y-1">
          {/* Weekday Row */}
          <div className="grid grid-cols-7 gap-1 text-center py-0.5">
            {WEEKDAYS.map((wd) => (
              <span key={wd} className="text-[10px] font-semibold text-[#86868b] dark:text-[#a1a1a6]">
                {wd}
              </span>
            ))}
          </div>

          {/* Days Grid: Uniform 32px Circular Hit Targets */}
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
                    'w-8 h-8 rounded-full text-[12px] font-medium flex items-center justify-center transition-all cursor-pointer relative',
                    item.isCurrentMonth
                      ? 'text-[#1d1d1f] dark:text-[#f5f5f7]'
                      : 'text-[#86868b]/30 dark:text-[#a1a1a6]/25',
                    // Selected: Apple solid vibrant blue filled circle with white font
                    selected &&
                      'bg-[#0071e3] text-white font-semibold shadow-[0_2px_8px_rgba(0,113,227,0.4)] ring-0',
                    // Today (when not selected): Soft circular blue badge
                    today &&
                      !selected &&
                      'font-bold text-[#0071e3] dark:text-[#2997ff] bg-[#0071e3]/12 ring-1 ring-[#0071e3]/30',
                    // Hover state
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

      {/* 4. Apple Liquid Glass Time Section: Clean Breathable Capsule + Quick Adjustment Row */}
      <div className="pt-2.5 border-t border-black/[0.06] dark:border-white/10 space-y-2">
        {/* Row 1: Time Label on the left, Apple Time Capsule on the far right (generous breathing room) */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/10">
          <div className="flex items-center gap-2 text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] shrink-0 whitespace-nowrap">
            <SFClock size={14} className="text-[#0071e3] dark:text-[#2997ff]" />
            <span>Thời gian</span>
          </div>

          {/* Apple Unified Time Capsule [ HH : MM  ▲/▼ ] */}
          <div className="flex items-center bg-white dark:bg-[#2c2c36] border border-black/10 dark:border-white/15 rounded-xl px-2 py-1 shadow-2xs shrink-0">
            {/* Hour Input: Direct typing, up/down arrows */}
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
              className="w-7 text-center font-semibold text-[13.5px] tabular-nums bg-transparent text-[#1d1d1f] dark:text-white border-0 p-0 focus:ring-0 focus:outline-none"
              style={{ width: '28px' }}
              title="Giờ (Dùng phím mũi tên Lên/Xuống hoặc gõ số)"
            />

            <span className="font-bold text-[#86868b] dark:text-[#a1a1a6] text-[13px] px-0.5">:</span>

            {/* Minute Input: Direct typing, up/down arrows */}
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
              className="w-7 text-center font-semibold text-[13.5px] tabular-nums bg-transparent text-[#1d1d1f] dark:text-white border-0 p-0 focus:ring-0 focus:outline-none"
              style={{ width: '28px' }}
              title="Phút (Dùng phím mũi tên Lên/Xuống hoặc gõ số)"
            />

            {/* Up / Down Stepper Buttons */}
            <div className="flex flex-col ml-1 pl-1 border-l border-black/10 dark:border-white/10 gap-0.5">
              <button
                type="button"
                onClick={() => handleStepMinute(15)}
                className="w-4 h-3 flex items-center justify-center text-[#86868b] hover:text-[#0071e3] transition-colors cursor-pointer"
                title="Tăng 15 phút"
              >
                <ChevronUp size={11} />
              </button>
              <button
                type="button"
                onClick={() => handleStepMinute(-15)}
                className="w-4 h-3 flex items-center justify-center text-[#86868b] hover:text-[#0071e3] transition-colors cursor-pointer"
                title="Giảm 15 phút"
              >
                <ChevronDown size={11} />
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Quick Steppers [-15p] [+15p] + 3 Presets (Sáng, Chiều, Tối) in a balanced 5-column grid */}
        <div className="grid grid-cols-5 gap-1 pt-0.5">
          <button
            type="button"
            onClick={() => handleStepMinute(-15)}
            className="flex items-center justify-center py-1.5 rounded-xl text-[11px] font-semibold bg-black/[0.03] dark:bg-white/[0.05] hover:bg-[#0071e3]/10 hover:text-[#0071e3] text-[#6e6e73] dark:text-[#a1a1a6] border border-black/5 dark:border-white/5 transition-all text-center tabular-nums active:scale-95 cursor-pointer"
            title="Lùi 15 phút"
          >
            -15p
          </button>
          <button
            type="button"
            onClick={() => handleStepMinute(15)}
            className="flex items-center justify-center py-1.5 rounded-xl text-[11px] font-semibold bg-black/[0.03] dark:bg-white/[0.05] hover:bg-[#0071e3]/10 hover:text-[#0071e3] text-[#6e6e73] dark:text-[#a1a1a6] border border-black/5 dark:border-white/5 transition-all text-center tabular-nums active:scale-95 cursor-pointer"
            title="Tiến 15 phút"
          >
            +15p
          </button>
          {[
            { h: 9, m: 0, label: '09:00', desc: 'Sáng' },
            { h: 14, m: 0, label: '14:00', desc: 'Chiều' },
            { h: 20, m: 0, label: '20:00', desc: 'Tối' },
          ].map((p) => {
            const active = hours === p.h && minutes === p.m;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => handleApplyPresetTime(p.h, p.m)}
                className={cn(
                  'flex flex-col items-center justify-center py-1 rounded-xl text-center transition-all cursor-pointer border',
                  active
                    ? 'bg-[#0071e3] text-white border-[#0071e3] shadow-xs font-semibold'
                    : 'bg-black/[0.02] dark:bg-white/[0.04] text-[#1d1d1f] dark:text-[#f5f5f7] border-black/5 dark:border-white/5 hover:border-[#0071e3]/40 hover:bg-[#0071e3]/5 font-medium'
                )}
              >
                <span className="text-[11px] tabular-nums font-semibold leading-tight">{p.label}</span>
                <span className={cn('text-[9px] leading-tight', active ? 'text-white/80' : 'text-[#86868b] dark:text-[#a1a1a6]')}>
                  {p.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Minimal Footer: Summary & Clean Done Button */}
      {!embedded && (
        <div className="pt-2 border-t border-black/[0.06] dark:border-white/10 flex items-center justify-between">
          <span className="text-[11px] text-[#86868b] dark:text-[#a1a1a6] font-medium truncate tabular-nums">
            {`${pad(currentDate.getDate())}/${pad(currentDate.getMonth() + 1)} lúc ${pad(hours)}:${pad(minutes)}`}
          </span>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-4 py-1.5 rounded-full text-[11.5px] font-semibold bg-[#0071e3] text-white hover:bg-[#0077ed] transition-all cursor-pointer shadow-2xs active:scale-95"
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
          <span className="text-[#86868b] dark:text-[#a1a1a6] text-[10px]">•</span>
          <div className="flex items-center gap-1 text-[#0071e3] dark:text-[#2997ff] font-semibold tabular-nums text-[12.5px]">
            <SFClock size={12} />
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

      {/* ─────────────────── Floating Apple Spring Popover with 120 FPS Keyframe Animation ─────────────────── */}
      {shouldRenderDropdown && (
        <div
          className={cn(
            'absolute top-full left-0 right-0 z-50 mt-2 flex justify-center pointer-events-auto',
            isDropdownExiting ? 'apple-picker-close' : 'apple-picker-open'
          )}
        >
          {renderPickerBody()}
        </div>
      )}
    </div>
  );
};
