import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  SFClock,
  SFChevronLeft,
  SFChevronRight,
  SFWandAndSparkles,
  SFCheckmark,
} from '@/components/ui/AppleIcon';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';

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

  // Quick Presets
  const handleApplyPreset = (minutesFromNow: number) => {
    const target = new Date(Date.now() + minutesFromNow * 60 * 1000);
    setNavMonth(target.getMonth());
    setNavYear(target.getFullYear());
    onChange(toDatetimeLocalString(target));
  };

  const handleApplyPresetTime = (targetHours: number, targetMinutes: number, nextDay = false) => {
    const target = new Date(currentDate);
    if (nextDay) target.setDate(target.getDate() + 1);
    target.setHours(targetHours, targetMinutes, 0, 0);
    if (!nextDay && target.getTime() <= Date.now()) {
      target.setDate(target.getDate() + 1);
    }
    setNavMonth(target.getMonth());
    setNavYear(target.getFullYear());
    onChange(toDatetimeLocalString(target));
  };

  const handleApplyNextMonday = () => {
    const target = new Date();
    const day = target.getDay();
    const diff = (7 - day + 1) % 7 || 7;
    target.setDate(target.getDate() + diff);
    target.setHours(8, 30, 0, 0);
    setNavMonth(target.getMonth());
    setNavYear(target.getFullYear());
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

  const jumpToToday = () => {
    const now = new Date();
    setNavYear(now.getFullYear());
    setNavMonth(now.getMonth());
    const newDate = new Date(now);
    newDate.setHours(hours, minutes, 0, 0);
    onChange(toDatetimeLocalString(newDate));
    setViewMode('calendar');
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

  // Render the core compact picker panel
  const renderPickerBody = () => (
    <div className="w-full max-w-[340px] mx-auto p-3 rounded-2xl bg-white/95 dark:bg-[#1c1c24]/95 backdrop-blur-2xl border border-black/[0.08] dark:border-white/12 shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.5)] space-y-2.5 select-none font-sans">
      {/* 1. Compact Apple Quick Date Presets Row */}
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => {
            const d = new Date();
            d.setHours(hours, minutes, 0, 0);
            setNavMonth(d.getMonth());
            setNavYear(d.getFullYear());
            onChange(toDatetimeLocalString(d));
            setViewMode('calendar');
          }}
          className={cn(
            'px-2.5 py-0.5 rounded-full text-[11px] font-medium shrink-0 transition-all cursor-pointer border shadow-2xs active:scale-95',
            isToday(currentDate)
              ? 'bg-[#0071e3] text-white border-[#0071e3]'
              : 'bg-black/[0.03] dark:bg-white/[0.06] text-[#1d1d1f] dark:text-[#f5f5f7] border-black/[0.06] dark:border-white/10 hover:bg-black/[0.06]'
          )}
        >
          Hôm nay
        </button>

        <button
          type="button"
          onClick={() => {
            const d = new Date();
            d.setDate(d.getDate() + 1);
            d.setHours(hours, minutes, 0, 0);
            setNavMonth(d.getMonth());
            setNavYear(d.getFullYear());
            onChange(toDatetimeLocalString(d));
            setViewMode('calendar');
          }}
          className="px-2.5 py-0.5 rounded-full text-[11px] font-medium shrink-0 transition-all cursor-pointer border border-black/[0.06] dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.06] text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/[0.06] active:scale-95 shadow-2xs"
        >
          Ngày mai
        </button>

        <button
          type="button"
          onClick={() => handleApplyPreset(30)}
          className="px-2.5 py-0.5 rounded-full text-[11px] font-medium shrink-0 transition-all cursor-pointer border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 active:scale-95 shadow-2xs"
        >
          ⚡ Sau 30p
        </button>

        <button
          type="button"
          onClick={handleApplyNextMonday}
          className="px-2.5 py-0.5 rounded-full text-[11px] font-medium shrink-0 transition-all cursor-pointer border border-black/[0.06] dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.06] text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/[0.06] active:scale-95 shadow-2xs"
        >
          Thứ Hai tới
        </button>
      </div>

      {/* 2. Apple Calendar Month Header with Quick Month/Year Selector Toggle */}
      <div className="flex items-center justify-between pb-1 border-b border-black/[0.06] dark:border-white/10">
        <button
          type="button"
          onClick={() => setViewMode(viewMode === 'calendar' ? 'monthYearPicker' : 'calendar')}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer group"
          title="Nhấp để chọn nhanh tháng và năm"
        >
          <span className="text-[13px] font-bold text-[#1d1d1f] dark:text-white tracking-tight">
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

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={jumpToToday}
            className="px-2 py-0.5 rounded-full text-[10.5px] font-medium text-[#0071e3] dark:text-[#2997ff] hover:bg-[#0071e3]/10 transition-colors cursor-pointer"
          >
            Hôm nay
          </button>
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

      {/* 3. Conditional: Month & Year Quick Picker View OR Calendar Days View */}
      {viewMode === 'monthYearPicker' ? (
        <div className="space-y-2 py-1 animate-in fade-in zoom-in-95 duration-200">
          {/* Year Stepper Bar */}
          <div className="flex items-center justify-between px-3 py-1 bg-black/[0.03] dark:bg-white/[0.06] rounded-xl">
            <button
              type="button"
              onClick={() => setNavYear((y) => y - 1)}
              className="p-1 rounded text-[#86868b] hover:text-[#0071e3] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              <SFChevronLeft size={12} />
            </button>
            <span className="text-[13px] font-bold text-[#1d1d1f] dark:text-white font-mono">
              Năm {navYear}
            </span>
            <button
              type="button"
              onClick={() => setNavYear((y) => y + 1)}
              className="p-1 rounded text-[#86868b] hover:text-[#0071e3] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
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
                    'py-1.5 rounded-xl text-[11.5px] font-medium transition-all cursor-pointer',
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
        <div className="space-y-1 animate-in fade-in duration-150">
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
                    'h-7 w-7 mx-auto rounded-full text-[11.5px] font-medium flex items-center justify-center transition-all cursor-pointer relative',
                    item.isCurrentMonth
                      ? 'text-[#1d1d1f] dark:text-[#f5f5f7]'
                      : 'text-[#86868b]/30 dark:text-[#a1a1a6]/25',
                    selected
                      ? 'bg-[#0071e3] text-white font-semibold shadow-[0_2px_6px_rgba(0,113,227,0.4)] scale-105'
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

      {/* 4. Apple Time Picker - Clean, Compact & Perfectly Aligned */}
      <div className="pt-2 border-t border-black/[0.06] dark:border-white/10 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11.5px] font-semibold text-[#1d1d1f] dark:text-white flex items-center gap-1.5">
            <SFClock size={12} className="text-[#0071e3]" />
            <span>Giờ nhắc</span>
          </span>

          {/* Quick hour pills */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleApplyPresetTime(9, 0)}
              className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-black/[0.03] dark:bg-white/[0.06] hover:bg-[#0071e3]/10 text-[#555] dark:text-[#a1a1a6] hover:text-[#0071e3] transition-colors cursor-pointer"
            >
              09:00
            </button>
            <button
              type="button"
              onClick={() => handleApplyPresetTime(15, 0)}
              className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-black/[0.03] dark:bg-white/[0.06] hover:bg-[#0071e3]/10 text-[#555] dark:text-[#a1a1a6] hover:text-[#0071e3] transition-colors cursor-pointer"
            >
              15:00
            </button>
            <button
              type="button"
              onClick={() => handleApplyPresetTime(20, 0)}
              className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-black/[0.03] dark:bg-white/[0.06] hover:bg-[#0071e3]/10 text-[#555] dark:text-[#a1a1a6] hover:text-[#0071e3] transition-colors cursor-pointer"
            >
              20:00
            </button>
          </div>
        </div>

        {/* Stepper capsule: Compact, sleek, no broken borders */}
        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-black/[0.025] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/10">
          <div className="flex items-center gap-1.5">
            {/* Hours stepper */}
            <div className="flex items-center bg-white dark:bg-[#252530] rounded-lg border border-black/10 dark:border-white/10 shadow-2xs px-1 py-0.5">
              <button
                type="button"
                onClick={() => handleStepHour(-1)}
                className="w-5 h-5 flex items-center justify-center text-[#86868b] hover:text-[#0071e3] transition-colors cursor-pointer text-[12px] font-bold select-none"
                title="Giảm 1 giờ"
              >
                −
              </button>
              <span className="w-6 text-center text-[13px] font-bold font-mono text-[#1d1d1f] dark:text-white select-none">
                {pad(hours)}
              </span>
              <button
                type="button"
                onClick={() => handleStepHour(1)}
                className="w-5 h-5 flex items-center justify-center text-[#86868b] hover:text-[#0071e3] transition-colors cursor-pointer text-[12px] font-bold select-none"
                title="Tăng 1 giờ"
              >
                +
              </button>
            </div>

            <span className="font-bold text-[#86868b] text-[13px]">:</span>

            {/* Minutes stepper */}
            <div className="flex items-center bg-white dark:bg-[#252530] rounded-lg border border-black/10 dark:border-white/10 shadow-2xs px-1 py-0.5">
              <button
                type="button"
                onClick={() => handleStepMinute(-5)}
                className="w-5 h-5 flex items-center justify-center text-[#86868b] hover:text-[#0071e3] transition-colors cursor-pointer text-[12px] font-bold select-none"
                title="Giảm 5 phút"
              >
                −
              </button>
              <span className="w-6 text-center text-[13px] font-bold font-mono text-[#1d1d1f] dark:text-white select-none">
                {pad(minutes)}
              </span>
              <button
                type="button"
                onClick={() => handleStepMinute(5)}
                className="w-5 h-5 flex items-center justify-center text-[#86868b] hover:text-[#0071e3] transition-colors cursor-pointer text-[12px] font-bold select-none"
                title="Tăng 5 phút"
              >
                +
              </button>
            </div>
          </div>

          {/* Quick step chips */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleStepMinute(15)}
              className="px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-black/[0.04] dark:bg-white/[0.08] hover:bg-[#0071e3]/15 text-[#333] dark:text-[#ddd] hover:text-[#0071e3] transition-colors cursor-pointer"
            >
              +15p
            </button>
            <button
              type="button"
              onClick={() => handleStepMinute(30)}
              className="px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-black/[0.04] dark:bg-white/[0.08] hover:bg-[#0071e3]/15 text-[#333] dark:text-[#ddd] hover:text-[#0071e3] transition-colors cursor-pointer"
            >
              +30p
            </button>
          </div>
        </div>
      </div>

      {/* 5. Non-embedded Done button */}
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

  // Dropdown / Expandable Trigger Mode (with 120 FPS Apple Liquid Spring Animation)
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
      <div
        className={cn(
          'overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
          isOpen
            ? 'max-h-[500px] opacity-100 mt-2 transform-none'
            : 'max-h-0 opacity-0 mt-0 pointer-events-none -translate-y-2'
        )}
      >
        {renderPickerBody()}
      </div>
    </div>
  );
};
