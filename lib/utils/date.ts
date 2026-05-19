import { format } from "date-fns";

// Local YYYY-MM-DD. Per §6, completion `date` is always local-time so
// "did I tick this today" doesn't drift across timezones.
export function toLocalDateString(d: Date = new Date()): string {
  return format(d, "yyyy-MM-dd");
}
