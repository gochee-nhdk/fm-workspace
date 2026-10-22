import React, { useState, useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  SFClock,
  SFChevronLeft,
  SFChevronRight,
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
  const { shouldRender: shouldRenderDropdown, isExiting: isDropdownExiting } = useAnimatedPresence(isOpen, 180);

  // View mode: 'calendar' or 'monthYearPicker'
  const [viewMode, setViewMode] = useState<'calendar' | 'monthYearPicker'>('calendar');

  const currentDate = useMemo(() => parseDatetimeLocal(value), [value]);

  // Calendar navigation state (month & year)
  const [navYear, setNavYear] = useState(currentDate.getFullYear());
  const [navMonth, setNavMonth] = useState(currentDate.getMonth());

  // Local hours & minutes
  const [hours, setHours] = useState(currentDate.getHours());
  const [minutes, setMinutes] = useState(currentDate.getMinutes());

  // Direct numeric input strings
  const [hourStr, setHourStr] = useState(pad(currentDate.getHours()));
  const [minStr, setMinStr] = useState(pad(currentDate.getMinutes()));

  const hourInputRef = useRef<HTMLInputElement>(null);
  const minuteInputRef = useRef<HTMLInputElement>(null);

  // Sync internal state when external value changes
  useEffect(() => {
    const d = parseDatetimeLocal(value);
    setNavYear(d.getFullYear());
    setNavMonth(d.getMonth());
    setHours(d.getHours());
    setMinutes(d.getMinutes());
    setHourStr(pad(d.getHours()));
    setMinStr(pad(d.getMinutes()));
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

  const handleHourChange = (newHour: number) => {
    const clamped = Math.max(0, Math.min(23, newHour));
    setHours(clamped);
    setHourStr(pad(clamped));
    const newDate = new Date(currentDate);
    newDate.setHours(clamped, minutes, 0, 0);
    onChange(toDatetimeLocalString(newDate));
  };

  const handleMinuteChange = (newMin: number) => {
    const clamped = Math.max(0, Math.min(59, newMin));
    setMinutes(clamped);
    setMinStr(pad(clamped));
    const newDate = new Date(currentDate);
    newDate.setHours(hours, clamped, 0, 0);
    onChange(toDatetimeLocalString(newDate));
  };

  const handleStepHour = (step: number) => {
    const nextHour = (hours + step + 24) % 24;
    handleHourChange(nextHour);
  };

  const handleStepMinute = (step: number) => {
    const nextMin = (minutes + step + 60) % 60;
    handleMinuteChange(nextMin);
  };

  // Direct typing handlers
  const onHourInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      handleStepHour(1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleStepHour(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      minuteInputRef.current?.focus();
      minuteInputRef.current?.select();
    }
  };

  const onMinuteInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      handleStepMinute(5);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleStepMinute(-5);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!embedded) setIsOpen(false);
    }
  };

  const onHourInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 2);
    setHourStr(val);
    if (val.length === 2 || (val.length === 1 && parseInt(val, 10) >= 3)) {
      const num = parseInt(val, 10);
      handleHourChange(num);
      minuteInputRef.current?.focus();
      minuteInputRef.current?.select();
    }
  };

  const onMinuteInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 2);
    setMinStr(val);
    if (val.length === 2) {
      const num = parseInt(val, 10);
      handleMinuteChange(num);
    }
  };

  const onHourBlur = () => {
    const num = parseInt(hourStr, 10);
    handleHourChange(isNaN(num) ? hours : num);
  };

  const onMinuteBlur = () => {
    const num = parseInt(minStr, 10);
    handleMinuteChange(isNaN(num) ? minutes : num);
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
    setHourStr('09');
    setMinStr('00');
    setNavMonth(d.getMonth());
    setNavYear(d.getFullYear());
    onChange(toDatetimeLocalString(d));
    setViewMode('calendar');
  };

  const handleApplyPlus1Hour = () => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    setHours(d.getHours());
    setMinutes(d.getMinutes());
    setHourStr(pad(d.getHours()));
    setMinStr(pad(d.getMinutes()));
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
    setHourStr('09');
    setMinStr('00');
    setNavMonth(target.getMonth());
    setNavYear(target.getFullYear());
    onChange(toDatetimeLocalString(target));
    setViewMode('calendar');
  };

  const handleApplyPresetTime = (targetHours: number, targetMinutes: number) => {
    const target = new Date(currentDate);
    target.setHours(targetHours, targetMinutes, 0, 0);
    setHours(targetHours);
    setMinutes(targetMinutes);
    setHourStr(pad(targetHours));
    setMinStr(pad(targetMinutes));
    onChange(toDatetimeLocalString(target));
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

  // Render the petite, ultra-compact Apple picker panel (265px)
  const renderPickerBody = () => (
    <div className="w-[268px] mx-auto p-2.5 rounded-2xl bg-white dark:bg-[#1e1e24] border border-black/10 dark:border-white/12 shadow-[0_12px_36px_rgba(0,0,0,0.14)] dark:shadow-[0_16px_45px_rgba(0,0,0,0.6)] space-y-2 select-none font-sans text-left">
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

      {/* 4. Single Unified Clean Time Row (Zero Clutter, 1 Line) */}
      <div className="pt-2 border-t border-black/[0.06] dark:border-white/10 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          <SFClock size={12} className="text-[#0071e3] shrink-0" />
          {/* Compact Keyboard Input Pill */}
          <div className="flex items-center bg-black/[0.035] dark:bg-white/[0.08] px-2 py-0.5 rounded-lg border border-black/10 dark:border-white/10 focus-within:border-[#0071e3] focus-within:ring-1 focus-within:ring-[#0071e3]/30 transition-all">
            <input
              ref={hourInputRef}
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={hourStr}
              onChange={onHourInputChange}
              onKeyDown={onHourInputKeyDown}
              onBlur={onHourBlur}
              className="w-5 text-center text-[12.5px] font-mono font-semibold text-[#1d1d1f] dark:text-white bg-transparent outline-none cursor-text select-all"
              title="Gõ giờ (00-23)"
            />
            <span className="text-[#86868b] font-bold text-[11px] mx-0.5 select-none">:</span>
            <input
              ref={minuteInputRef}
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={minStr}
              onChange={onMinuteInputChange}
              onKeyDown={onMinuteInputKeyDown}
              onBlur={onMinuteBlur}
              className="w-5 text-center text-[12.5px] font-mono font-semibold text-[#1d1d1f] dark:text-white bg-transparent outline-none cursor-text select-all"
              title="Gõ phút (00-59)"
            />
          </div>
        </div>

        {/* 3 Quick Common Time Chips */}
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
                onClick={() => handleApplyPresetTime(p.h, p.m)}
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

      {/* 5. Minimal Footer: Summary & Clean Small Done Button */}
      {!embedded && (
        <div className="pt-1.5 border-t border-black/[0.06] dark:border-white/10 flex items-center justify-between">
          <span className="text-[10px] text-[#86868b] dark:text-[#a1a1a6] font-medium truncate">
            {`${pad(currentDate.getDate())}/${pad(currentDate.getMonth() + 1)} lúc ${pad(hours)}:${pad(minutes)}`}
          </span>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-3 py-1 rounded-full text-[11px] font-semibold bg-[#0071e3] text-white hover:bg-[#0077ed] transition-all cursor-pointer shadow-2xs active:scale-95"
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

  // Dropdown / Expandable Trigger Mode (with Apple Liquid Spring Animation)
  return (
    <div className={cn('w-full select-none font-sans', className)}>
      {/* ─────────────────── Compact Apple Liquid Glass Trigger Capsule ─────────────────── */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12px] font-medium transition-all cursor-pointer shadow-2xs',
          'bg-black/[0.02] dark:bg-white/[0.04] border border-black/15 dark:border-white/20',
          'hover:bg-black/[0.04] dark:hover:bg-white/[0.08] hover:border-[#0071e3]/40 dark:hover:border-[#2997ff]/40',
          isOpen && 'ring-2 ring-[#0071e3]/20 border-[#0071e3] dark:border-[#2997ff] bg-white dark:bg-[#1f1f28]'
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded-md bg-[#0071e3]/10 text-[#0071e3] dark:text-[#2997ff] flex items-center justify-center shrink-0">
            <CalendarIcon size={11} />
          </div>
          <span className="font-semibold text-[#1d1d1f] dark:text-white truncate">
            {formatVietnameseDateDisplay(currentDate)}
          </span>
          <span className="text-[#86868b] dark:text-[#a1a1a6] font-mono text-[9px]">•</span>
          <div className="flex items-center gap-1 text-[#0071e3] dark:text-[#2997ff] font-semibold font-mono text-[11.5px]">
            <SFClock size={10} />
            <span>{`${pad(hours)}:${pad(minutes)}`}</span>
          </div>
        </div>

        <ChevronDown
          size={12}
          className={cn(
            'text-[#86868b] transition-transform duration-200 shrink-0 ml-1',
            isOpen && 'rotate-180 text-[#0071e3]'
          )}
        />
      </button>

      {/* ─────────────────── Smooth Apple Expand/Collapse Container ─────────────────── */}
      {shouldRenderDropdown && (
        <div
          className={cn(
            'overflow-hidden transition-all duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] mt-1.5',
            isDropdownExiting
              ? 'opacity-0 scale-95 pointer-events-none -translate-y-1'
              : 'opacity-100 scale-100 transform-none'
          )}
        >
          {renderPickerBody()}
        </div>
      )}
    </div>
  );
};
