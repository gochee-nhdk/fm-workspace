import React, { useState, useEffect, useMemo } from 'react';
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
  const { shouldRender: shouldRenderDropdown, isExiting: isDropdownExiting } = useAnimatedPresence(isOpen, 200);

  // View mode: 'calendar' or 'monthYearPicker'
  const [viewMode, setViewMode] = useState<'calendar' | 'monthYearPicker'>('calendar');

  const currentDate = useMemo(() => parseDatetimeLocal(value), [value]);

  // Calendar navigation state (month & year)
  const [navYear, setNavYear] = useState(currentDate.getFullYear());
  const [navMonth, setNavMonth] = useState(currentDate.getMonth());

  // Local hours & minutes
  const [hours, setHours] = useState(currentDate.getHours());
  const [minutes, setMinutes] = useState(currentDate.getMinutes());

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

    // Monday as first day: Monday is 1, Sunday is 0 -> adjust so Monday is 0, Sunday is 6
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
    const newDate = new Date(currentDate);
    newDate.setHours(clamped, minutes, 0, 0);
    onChange(toDatetimeLocalString(newDate));
  };

  const handleMinuteChange = (newMin: number) => {
    const clamped = Math.max(0, Math.min(59, newMin));
    setMinutes(clamped);
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
    d.setHours(9, 0, 0, 0); // Apple standard default: 09:00 AM next day
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
    target.setHours(8, 30, 0, 0);
    setHours(8);
    setMinutes(30);
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

  // Render the core compact Apple picker panel
  const renderPickerBody = () => (
    <div className="w-full max-w-[325px] mx-auto p-3 rounded-[22px] bg-white/95 dark:bg-[#1c1c24]/95 backdrop-blur-3xl border border-black/[0.08] dark:border-white/12 shadow-[0_16px_40px_rgba(0,0,0,0.08)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.55)] space-y-2.5 select-none font-sans text-left">
      {/* 1. Apple Quick Date Segmented Bar */}
      <div className="grid grid-cols-4 gap-1 p-0.5 rounded-xl bg-black/[0.035] dark:bg-white/[0.05]">
        <button
          type="button"
          onClick={handleApplyToday}
          className={cn(
            'py-1 rounded-lg text-[10.5px] font-medium transition-all cursor-pointer text-center truncate',
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
          className="py-1 rounded-lg text-[10.5px] font-medium transition-all cursor-pointer text-center truncate text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 active:scale-95"
        >
          Ngày mai
        </button>

        <button
          type="button"
          onClick={handleApplyPlus1Hour}
          className="py-1 rounded-lg text-[10.5px] font-medium transition-all cursor-pointer text-center truncate text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 active:scale-95"
        >
          Sau 1h
        </button>

        <button
          type="button"
          onClick={handleApplyNextMonday}
          className="py-1 rounded-lg text-[10.5px] font-medium transition-all cursor-pointer text-center truncate text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 active:scale-95"
        >
          Thứ Hai
        </button>
      </div>

      {/* 2. Apple Calendar Month Header */}
      <div className="flex items-center justify-between px-1 pb-1 border-b border-black/[0.06] dark:border-white/10">
        <button
          type="button"
          onClick={() => setViewMode(viewMode === 'calendar' ? 'monthYearPicker' : 'calendar')}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer group"
          title="Nhấp để chuyển xem tháng và năm"
        >
          <span className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white tracking-tight">
            {MONTH_NAMES[navMonth]}, {navYear}
          </span>
          <ChevronDown
            size={12}
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
            className="w-6 h-6 rounded-lg flex items-center justify-center text-[#1d1d1f] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer active:scale-90"
            title="Tháng trước"
          >
            <SFChevronLeft size={11} />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-[#1d1d1f] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer active:scale-90"
            title="Tháng sau"
          >
            <SFChevronRight size={11} />
          </button>
        </div>
      </div>

      {/* 3. Month & Year Quick Picker View OR Calendar Days View */}
      {viewMode === 'monthYearPicker' ? (
        <div className="space-y-2 py-1">
          {/* Year Stepper Bar */}
          <div className="flex items-center justify-between px-3 py-1 bg-black/[0.03] dark:bg-white/[0.06] rounded-xl">
            <button
              type="button"
              onClick={() => setNavYear((y) => y - 1)}
              className="p-1 rounded text-[#86868b] hover:text-[#0071e3] transition-colors"
            >
              <SFChevronLeft size={12} />
            </button>
            <span className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-white font-mono">
              Năm {navYear}
            </span>
            <button
              type="button"
              onClick={() => setNavYear((y) => y + 1)}
              className="p-1 rounded text-[#86868b] hover:text-[#0071e3] transition-colors"
            >
              <SFChevronRight size={12} />
            </button>
          </div>

          {/* 12 Months Grid */}
          <div className="grid grid-cols-3 gap-1">
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
                    'py-1.5 rounded-xl text-[11px] font-medium transition-all cursor-pointer',
                    isCurrMonth
                      ? 'bg-[#0071e3] text-white font-semibold shadow-xs'
                      : 'hover:bg-black/5 dark:hover:bg-white/10 text-[#1d1d1f] dark:text-[#f5f5f7]'
                  )}
                >
                  {mName}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          {/* Weekday Row */}
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {WEEKDAYS.map((wd, i) => (
              <span
                key={wd}
                className={cn(
                  'text-[10px] font-semibold py-0.5',
                  i >= 5 ? 'text-amber-500/90 dark:text-amber-400/90' : 'text-[#86868b] dark:text-[#a1a1a6]'
                )}
              >
                {wd}
              </span>
            ))}
          </div>

          {/* Calendar Days 7xN Grid */}
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
                    'h-7 w-7 mx-auto rounded-full text-[11px] font-medium flex items-center justify-center transition-all cursor-pointer relative',
                    item.isCurrentMonth
                      ? 'text-[#1d1d1f] dark:text-[#f5f5f7]'
                      : 'text-[#86868b]/30 dark:text-[#a1a1a6]/25',
                    selected
                      ? 'bg-[#0071e3] text-white font-semibold shadow-[0_2px_8px_rgba(0,113,227,0.4)] scale-105'
                      : 'hover:bg-black/[0.05] dark:hover:bg-white/[0.08]',
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

      {/* 4. Apple Time Picker - Clean Digital Time Capsule & Smart Minute Chips */}
      <div className="pt-2 border-t border-black/[0.06] dark:border-white/10 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11.5px] font-semibold text-[#1d1d1f] dark:text-white flex items-center gap-1.5">
            <SFClock size={12} className="text-[#0071e3]" />
            <span>Giờ nhắc hẹn</span>
          </span>

          {/* Quick period hour chips: 09:00, 14:00, 20:00 */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleApplyPresetTime(9, 0)}
              className={cn(
                'px-1.5 py-0.5 rounded-md text-[10px] font-medium transition-colors cursor-pointer',
                hours === 9 && minutes === 0
                  ? 'bg-[#0071e3] text-white font-semibold shadow-2xs'
                  : 'bg-black/[0.035] dark:bg-white/[0.06] hover:bg-[#0071e3]/10 text-[#555] dark:text-[#a1a1a6] hover:text-[#0071e3]'
              )}
            >
              09:00
            </button>
            <button
              type="button"
              onClick={() => handleApplyPresetTime(14, 0)}
              className={cn(
                'px-1.5 py-0.5 rounded-md text-[10px] font-medium transition-colors cursor-pointer',
                hours === 14 && minutes === 0
                  ? 'bg-[#0071e3] text-white font-semibold shadow-2xs'
                  : 'bg-black/[0.035] dark:bg-white/[0.06] hover:bg-[#0071e3]/10 text-[#555] dark:text-[#a1a1a6] hover:text-[#0071e3]'
              )}
            >
              14:00
            </button>
            <button
              type="button"
              onClick={() => handleApplyPresetTime(20, 0)}
              className={cn(
                'px-1.5 py-0.5 rounded-md text-[10px] font-medium transition-colors cursor-pointer',
                hours === 20 && minutes === 0
                  ? 'bg-[#0071e3] text-white font-semibold shadow-2xs'
                  : 'bg-black/[0.035] dark:bg-white/[0.06] hover:bg-[#0071e3]/10 text-[#555] dark:text-[#a1a1a6] hover:text-[#0071e3]'
              )}
            >
              20:00
            </button>
          </div>
        </div>

        {/* Unified Apple Digital Time Capsule: Clean, Elegant, No visual clutter */}
        <div className="flex items-center justify-between p-1.5 rounded-xl bg-black/[0.025] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/10">
          {/* Digital Time display with micro steppers */}
          <div className="flex items-center gap-1 bg-white dark:bg-[#252530] px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/15 shadow-2xs">
            {/* Hour */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleStepHour(-1)}
                className="w-4 h-4 rounded flex items-center justify-center text-[#86868b] hover:text-[#0071e3] hover:bg-black/5 dark:hover:bg-white/10 text-[10px] cursor-pointer"
                title="Giảm 1 giờ"
              >
                −
              </button>
              <span className="w-5 text-center text-[14px] font-bold font-mono text-[#1d1d1f] dark:text-white select-none">
                {pad(hours)}
              </span>
              <button
                type="button"
                onClick={() => handleStepHour(1)}
                className="w-4 h-4 rounded flex items-center justify-center text-[#86868b] hover:text-[#0071e3] hover:bg-black/5 dark:hover:bg-white/10 text-[10px] cursor-pointer"
                title="Tăng 1 giờ"
              >
                +
              </button>
            </div>

            <span className="font-bold text-[#86868b] text-[13px] px-0.5">:</span>

            {/* Minute */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleStepMinute(-5)}
                className="w-4 h-4 rounded flex items-center justify-center text-[#86868b] hover:text-[#0071e3] hover:bg-black/5 dark:hover:bg-white/10 text-[10px] cursor-pointer"
                title="Giảm 5 phút"
              >
                −
              </button>
              <span className="w-5 text-center text-[14px] font-bold font-mono text-[#1d1d1f] dark:text-white select-none">
                {pad(minutes)}
              </span>
              <button
                type="button"
                onClick={() => handleStepMinute(5)}
                className="w-4 h-4 rounded flex items-center justify-center text-[#86868b] hover:text-[#0071e3] hover:bg-black/5 dark:hover:bg-white/10 text-[10px] cursor-pointer"
                title="Tăng 5 phút"
              >
                +
              </button>
            </div>
          </div>

          {/* Quick 15-minute intervals: :00, :15, :30, :45 */}
          <div className="flex items-center gap-1">
            {[0, 15, 30, 45].map((m) => {
              const active = minutes === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleMinuteChange(m)}
                  className={cn(
                    'px-1.5 py-1 rounded-md text-[10px] font-mono font-semibold transition-all cursor-pointer',
                    active
                      ? 'bg-[#0071e3] text-white shadow-2xs'
                      : 'bg-black/[0.035] dark:bg-white/[0.06] hover:bg-black/[0.06] text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white'
                  )}
                >
                  :{pad(m)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 5. Done button (for non-embedded dropdowns) */}
      {!embedded && (
        <div className="pt-1.5 border-t border-black/[0.06] dark:border-white/10 flex justify-end">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-3.5 py-1 rounded-full text-[11.5px] font-semibold bg-[#0071e3] text-white hover:bg-[#0077ed] transition-all cursor-pointer shadow-xs active:scale-95"
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
      {/* ─────────────────── Apple Liquid Glass Trigger Capsule ─────────────────── */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2 rounded-2xl text-[12.5px] font-medium transition-all cursor-pointer shadow-2xs',
          'bg-black/[0.02] dark:bg-white/[0.04] border border-black/15 dark:border-white/20',
          'hover:bg-black/[0.04] dark:hover:bg-white/[0.08] hover:border-[#0071e3]/40 dark:hover:border-[#2997ff]/40',
          isOpen && 'ring-2 ring-[#0071e3]/20 border-[#0071e3] dark:border-[#2997ff] bg-white dark:bg-[#1f1f28]'
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
            'text-[#86868b] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] shrink-0 ml-1.5',
            isOpen && 'rotate-180 text-[#0071e3]'
          )}
        />
      </button>

      {/* ─────────────────── Smooth Apple Spring Expand/Collapse Container (120 FPS) ─────────────────── */}
      {shouldRenderDropdown && (
        <div
          className={cn(
            'overflow-hidden transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] mt-2',
            isDropdownExiting
              ? 'opacity-0 scale-95 pointer-events-none -translate-y-2'
              : 'opacity-100 scale-100 transform-none'
          )}
        >
          {renderPickerBody()}
        </div>
      )}
    </div>
  );
};
