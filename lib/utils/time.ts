/**
 * Time formatting utilities for 12-hour display
 */

/**
 * Format a Date object or ISO string to 12-hour time format (e.g., "2:30 PM")
 */
export const formatTime12h = (time?: string | Date): string => {
  if (!time) return "--:--";
  const date = typeof time === "string" ? new Date(time) : time;
  if (isNaN(date.getTime())) return "--:--";

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

/**
 * Format a shift time string (HH:MM:SS or HH:MM) to 12-hour format
 * Input: "14:00:00" or "14:00"
 * Output: "2:00 PM"
 */
export const formatShiftTime12h = (timeStr?: string): string => {
  if (!timeStr) return "--:--";

  const [hours, minutes] = timeStr.split(":");
  const hour = parseInt(hours, 10);
  const minute = minutes || "00";

  if (isNaN(hour)) return "--:--";

  const isPM = hour >= 12;
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const suffix = isPM ? "PM" : "AM";

  return `${hour12}:${minute} ${suffix}`;
};

/**
 * Parse a 12-hour time string to 24-hour format for storage
 * Input: "2:00 PM" or "2:00PM"
 * Output: "14:00"
 */
export const parse12hTo24h = (time12h: string): string => {
  const match = time12h.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return time12h; // Return as-is if already in 24h or invalid

  let [, hours, minutes, period] = match;
  let hour = parseInt(hours, 10);

  if (period) {
    const isPM = period.toUpperCase() === "PM";
    if (isPM && hour !== 12) {
      hour += 12;
    } else if (!isPM && hour === 12) {
      hour = 0;
    }
  }

  return `${hour.toString().padStart(2, "0")}:${minutes}`;
};

/**
 * Format duration in hours and minutes
 */
export const formatDuration = (startTime?: string, endTime?: string): string | null => {
  if (!startTime || !endTime) return null;

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

  const diff = end.getTime() - start.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours}h ${minutes}m`;
};
