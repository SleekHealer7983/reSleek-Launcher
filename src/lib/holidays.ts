const FIXED_HOLIDAYS: Record<string, string> = {
  "1-1": "元旦",
  "3-8": "妇女节",
  "3-12": "植树节",
  "5-1": "劳动节",
  "5-4": "青年节",
  "6-1": "儿童节",
  "7-1": "建党节",
  "8-1": "建军节",
  "9-10": "教师节",
  "10-1": "国庆节",
};

const LUNAR_HOLIDAYS: Record<string, string> = {
  "1-1": "春节",
  "1-15": "元宵节",
  "5-5": "端午节",
  "7-7": "七夕",
  "8-15": "中秋节",
  "9-9": "重阳节",
  "12-8": "腊八节",
};

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const holidayCache = new Map<string, string>();

const chineseCalendar = (() => {
  try {
    return new Intl.DateTimeFormat("zh-CN-u-ca-chinese", {
      month: "numeric",
      day: "numeric",
    });
  } catch {
    return null;
  }
})();

function lunarMonthDay(date: Date) {
  if (!chineseCalendar) return null;
  try {
    const parts = chineseCalendar.formatToParts(
      new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12),
    );
    const month = Number(parts.find((part) => part.type === "month")?.value);
    const day = Number(parts.find((part) => part.type === "day")?.value);
    if (!Number.isFinite(month) || !Number.isFinite(day)) return null;
    return { month, day };
  } catch {
    return null;
  }
}

export function weekdayLabel(date: Date) {
  return WEEKDAYS[date.getDay()] ?? "";
}

export function dateLabel(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export function holidayLabel(date: Date) {
  const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  const cached = holidayCache.get(key);
  if (cached !== undefined) return cached;

  let label = FIXED_HOLIDAYS[`${date.getMonth() + 1}-${date.getDate()}`] ?? "";
  if (!label) {
    const lunar = lunarMonthDay(date);
    if (lunar) {
      label = LUNAR_HOLIDAYS[`${lunar.month}-${lunar.day}`] ?? "";
    }
  }
  if (!label && (date.getDay() === 0 || date.getDay() === 6)) {
    label = "周末";
  }

  holidayCache.set(key, label);
  return label;
}
