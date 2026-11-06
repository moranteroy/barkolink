<template>
  <section class="sailing-calendar" aria-labelledby="schedule-calendar-heading">
    <header class="calendar-heading">
      <span class="calendar-icon"><CalendarDays :size="22" aria-hidden="true" /></span>
      <div>
        <h2 id="schedule-calendar-heading">Find a sailing date</h2>
        <p>{{ routeLabel || 'All routes' }} &middot; Philippine time</p>
      </div>
    </header>
    <div class="calendar-modes" role="group" aria-label="Calendar date type">
      <button
        v-for="mode in modes"
        :key="mode.value"
        type="button"
        :aria-pressed="event === mode.value"
        @click="emit('update:event', mode.value)"
      >
        <component
          :is="mode.value === 'departure' ? ArrowUpRight : ArrowDownLeft"
          :size="16"
          aria-hidden="true"
        />{{ mode.label }}
      </button>
    </div>
    <div class="calendar-layout">
      <div class="calendar-panel">
        <label class="month-picker">
          <CalendarDays :size="21" aria-hidden="true" /><span>{{ shortMonthLabel }}</span
          ><ChevronDown :size="18" aria-hidden="true" />
          <input
            type="month"
            aria-label="Choose calendar month"
            :value="month"
            :min="today.slice(0, 7)"
            @change="chooseMonth"
          />
        </label>
        <div class="calendar-sheet">
          <div class="month-controls">
            <button
              type="button"
              aria-label="Previous month"
              :disabled="month <= today.slice(0, 7)"
              @click="moveMonth(-1)"
            >
              <ChevronLeft :size="21" aria-hidden="true" />
            </button>
            <h3 aria-live="polite">{{ monthLabel }}</h3>
            <button type="button" aria-label="Next month" @click="moveMonth(1)">
              <ChevronRight :size="21" aria-hidden="true" />
            </button>
          </div>
          <div class="week-labels" aria-hidden="true">
            <span v-for="day in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']" :key="day">{{
              day
            }}</span>
          </div>
          <div class="calendar-days" role="group" :aria-label="`${monthLabel} sailing dates`">
            <template v-for="(date, index) in cells" :key="date || `blank-${index}`">
              <span v-if="!date" class="calendar-blank" aria-hidden="true"></span>
              <button
                v-else
                type="button"
                class="calendar-day"
                :class="{
                  available: date >= today && days.has(date),
                  selected: date === selectedDate,
                  today: date === today,
                  past: date < today,
                }"
                :disabled="date < today"
                :aria-pressed="date === selectedDate"
                :aria-current="date === today ? 'date' : undefined"
                :aria-label="dayLabel(date)"
                @click="emit('select', date)"
              >
                <strong>{{ Number(date.slice(-2)) }}</strong>
                <small v-if="date < today" class="day-status" aria-hidden="true">Past</small>
                <small v-else-if="days.has(date)" class="trip-count" aria-hidden="true">{{
                  days.get(date)!.length
                }}</small>
                <small v-else class="day-status" aria-hidden="true">No trips</small>
              </button>
            </template>
          </div>
        </div>
        <p class="calendar-legend">
          <span class="legend-dot" aria-hidden="true"></span>Trip counts match your route and
          passenger count.
        </p>
      </div>
      <div class="calendar-details">
        <div class="calendar-preview" aria-live="polite">
          <template v-if="selectedDate">
            <p class="preview-eyebrow">YOUR TRAVEL DATE</p>
            <h3>{{ label(selectedDate) }}</h3>
            <p class="preview-count">
              {{ selectedSailings.length }} {{ eventName(selectedSailings.length) }} with seats for
              your group
            </p>
            <p v-if="!selectedSailings.length">
              No listed {{ event === 'arrival' ? 'arrivals' : 'departures' }} for this day. Choose a
              day with a trip count{{
                nextDate ? ' or jump to the next listed date' : ', or try another route'
              }}.
            </p>
            <ul v-else>
              <li v-for="sailing in selectedSailings.slice(0, 3)" :key="sailing.code">
                <strong
                  >{{ sailing.origin.city }} <ArrowRight :size="13" aria-hidden="true" />
                  {{ sailing.destination.city }}</strong
                >
                <small>{{ sailing.vessel.name }} &middot; {{ sailing.code }}</small>
                <dl>
                  <div>
                    <dt>Departure</dt>
                    <dd>{{ timestamp(sailing.departureAt) }}</dd>
                  </div>
                  <div>
                    <dt>Arrival</dt>
                    <dd>{{ timestamp(sailing.arrivalAt) }}</dd>
                  </div>
                </dl>
              </li>
            </ul>
            <p v-if="selectedSailings.length > 3">
              See all sailings in the results below. Use the departure-time filters to narrow your
              choices.
            </p>
          </template>
          <template v-else>
            <span class="preview-icon"><CalendarDays :size="26" aria-hidden="true" /></span>
            <h3>Choose a travel date</h3>
            <p>
              {{
                days.size
                  ? 'The number on each date shows how many sailings are available for your group. Select a date to see departure and arrival times.'
                  : 'No upcoming schedules are listed for this route and passenger count. Try another route or check again later.'
              }}
            </p>
          </template>
        </div>
        <div class="calendar-actions">
          <button
            v-if="nextDate && (!hasMonthSailings || (selectedDate && !selectedSailings.length))"
            type="button"
            class="next-date"
            @click="jumpToAvailable"
          >
            Jump to listed date: {{ label(nextDate) }}<ArrowRight :size="16" aria-hidden="true" />
          </button>
          <button v-if="selectedDate" type="button" class="all-dates" @click="emit('select', '')">
            Show all dates
          </button>
        </div>
        <p class="calendar-note">
          Based on published schedules. Operator updates may change times.
        </p>
      </div>
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  CalendarDays,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowRight,
} from '@lucide/vue';
import {
  sailingDays,
  calendarMonth,
  type CalendarSailing,
  type ScheduleEvent,
} from '../../data/sailingCalendar';
import { philippineDateKey } from '../../data/travelDate';
const props = defineProps<{
  sailings: CalendarSailing[];
  selectedDate: string;
  event: ScheduleEvent;
  routeLabel: string;
}>();
const emit = defineEmits<{ select: [date: string]; 'update:event': [event: ScheduleEvent] }>();
const modes = [
  { value: 'departure', label: 'Departures' },
  { value: 'arrival', label: 'Arrivals' },
] as const;
const today = philippineDateKey();
const days = computed(() => sailingDays(props.sailings, props.event));
const nextDate = computed(() => {
  const dates = [...days.value.keys()].filter((date) => date >= today).sort();
  return dates.find((date) => date >= (props.selectedDate || today)) || dates[0] || '';
});
const month = ref(today.slice(0, 7));
watch(
  () => [props.selectedDate, nextDate.value],
  () => {
    const date = props.selectedDate >= today ? props.selectedDate : nextDate.value || today;
    month.value = date.slice(0, 7);
  },
  { immediate: true },
);
const cells = computed(() => calendarMonth(month.value));
const monthLabel = computed(() =>
  new Date(`${month.value}-01T00:00:00+08:00`).toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'long',
    year: 'numeric',
  }),
);
const shortMonthLabel = computed(() =>
  new Date(`${month.value}-01T00:00:00+08:00`).toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    year: 'numeric',
  }),
);
const hasMonthSailings = computed(() => cells.value.some((date) => date && days.value.has(date)));
const selectedSailings = computed(() => days.value.get(props.selectedDate) || []);
function label(date: string) {
  return new Date(`${date}T00:00:00+08:00`).toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
function timestamp(at: string) {
  return new Date(at).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
function eventName(count: number) {
  return props.event === 'arrival'
    ? count === 1
      ? 'arrival'
      : 'arrivals'
    : count === 1
      ? 'departure'
      : 'departures';
}
function dayLabel(date: string) {
  if (date < today) return `${label(date)}: Past date`;
  return `${label(date)}: ${days.value.get(date)?.length || 0} ${eventName(days.value.get(date)?.length || 0)}`;
}
function chooseMonth(event: Event) {
  const input = event.target as HTMLInputElement;
  const value = input.value;
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value) && value >= today.slice(0, 7)) month.value = value;
  else input.value = month.value;
}
function moveMonth(step: number) {
  const [year, index] = month.value.split('-').map(Number);
  const date = new Date(Date.UTC(year, index - 1 + step, 1));
  month.value = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
function jumpToAvailable() {
  if (nextDate.value) {
    month.value = nextDate.value.slice(0, 7);
    emit('select', nextDate.value);
  }
}
</script>
<style scoped>
.sailing-calendar {
  padding: 24px;
  margin: 18px 0;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: var(--surface);
}
.calendar-heading {
  display: flex;
  align-items: center;
  gap: 12px;
}
.calendar-heading h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--ink);
}
.calendar-heading p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: var(--text-caption);
  line-height: 1.6;
}
.calendar-icon,
.preview-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  color: var(--ocean);
  background: var(--light-blue);
}
.calendar-icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
}
button {
  font: inherit;
  cursor: pointer;
}
button:disabled {
  cursor: default;
}
button:focus-visible,
.month-picker:focus-within {
  outline: 2px solid var(--ocean);
  outline-offset: 3px;
}
.calendar-modes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  max-width: 360px;
  margin: 18px 0 24px;
  padding: 4px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface-soft);
}
.calendar-modes button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  border: 0;
  border-radius: 8px;
  color: var(--muted);
  background: transparent;
  font-size: var(--text-caption);
  font-weight: 650;
}
.calendar-modes button[aria-pressed='true'] {
  background: var(--surface);
  color: var(--ocean);
  box-shadow: 0 1px 4px #0000000a;
}
.calendar-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 28px;
  align-items: start;
}
.calendar-panel,
.calendar-details {
  min-width: 0;
}
.month-picker {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: fit-content;
  min-height: 48px;
  margin: 0 auto 20px;
  padding: 10px 20px;
  border: 1px solid var(--line);
  border-radius: 28px;
  color: var(--ocean);
  background: var(--surface);
  box-shadow: 0 3px 8px #0000000d;
  font-size: 17px;
  font-weight: 700;
  cursor: pointer;
}
.month-picker input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}
.month-picker input::-webkit-calendar-picker-indicator {
  position: absolute;
  inset: 0;
  width: auto;
  height: auto;
  cursor: pointer;
}
.calendar-sheet {
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: var(--surface-soft);
}
.month-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  margin-bottom: 12px;
}
.month-controls h3 {
  margin: 0;
  color: var(--ink);
  font-size: 18px;
  font-weight: 750;
  text-transform: uppercase;
  text-align: center;
}
.month-controls button {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 12px;
  color: var(--ocean);
  background: transparent;
}
.month-controls button:hover:not(:disabled) {
  background: var(--light-blue);
}
.month-controls button:disabled {
  opacity: 0.35;
}
.week-labels,
.calendar-days {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
}
.week-labels {
  margin-bottom: 10px;
  text-align: center;
  color: var(--muted);
  font-size: 11px;
  font-weight: 650;
  text-transform: uppercase;
}
.calendar-day,
.calendar-blank {
  min-width: 0;
  min-height: 76px;
  border: 1px solid var(--line);
  border-radius: 13px;
}
.calendar-blank {
  border-style: dashed;
  opacity: 0.45;
}
.calendar-day {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  gap: 6px;
  padding: 9px 7px;
  color: var(--muted);
  background: var(--surface);
  text-align: left;
  transition:
    background 0.15s,
    border-color 0.15s;
}
.calendar-day strong {
  font-size: 18px;
  line-height: 1;
  font-weight: 700;
}
.calendar-day .day-status {
  font-size: 10px;
  line-height: 1.15;
}
.trip-count {
  display: grid;
  place-items: center;
  min-width: 25px;
  min-height: 25px;
  padding: 3px 6px;
  border-radius: 20px;
  color: var(--ocean);
  background: var(--light-blue);
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
}
.calendar-day.available {
  color: var(--ink);
  border-color: color-mix(in srgb, var(--ocean) 30%, var(--line));
}
.calendar-day:hover:not(:disabled) {
  border-color: var(--ocean);
  background: var(--light-blue);
}
.calendar-day.past {
  background: transparent;
  color: var(--muted);
  opacity: 0.55;
}
.calendar-day.selected {
  border-color: var(--action);
  color: #fff;
  background: var(--action);
  box-shadow: 0 2px 6px #00000015;
}
.calendar-day.selected:hover {
  background: var(--action);
}
.calendar-day.selected .trip-count {
  color: #fff;
  background: #ffffff25;
}
.calendar-day.today::after {
  content: '';
  position: absolute;
  top: 9px;
  right: 6px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--ocean);
}
.calendar-day.today.selected::after {
  background: #fff;
}
.calendar-legend {
  display: flex;
  align-items: baseline;
  gap: 7px;
  margin: 12px 0 0;
  font-size: var(--text-caption);
  line-height: 1.6;
  color: var(--muted);
}
.legend-dot {
  width: 7px;
  height: 7px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--ocean);
}
.calendar-details {
  padding: 12px 0 0 24px;
  border-left: 1px solid var(--line);
}
.calendar-preview h3 {
  margin: 8px 0;
  font-size: 20px;
  color: var(--ink);
}
.calendar-preview p,
.calendar-note {
  margin: 8px 0;
  color: var(--muted);
  font-size: var(--text-caption);
  line-height: 1.8;
}
.calendar-preview .preview-eyebrow {
  margin-top: 0;
  color: var(--ocean);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.1em;
}
.preview-icon {
  width: 52px;
  height: 52px;
  margin-bottom: 18px;
  border-radius: 16px;
}
.calendar-preview .preview-count {
  margin-bottom: 16px;
}
ul {
  display: grid;
  gap: 10px;
  list-style: none;
  padding: 0;
  margin: 0;
}
li {
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface-soft);
}
li > strong {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: var(--text-label);
  color: var(--ink);
}
li > small {
  display: block;
  margin-top: 5px;
  font-size: var(--text-caption);
  color: var(--muted);
  overflow-wrap: anywhere;
}
dl {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin: 12px 0 0;
}
dt {
  color: var(--muted);
  font-size: var(--text-caption);
}
dd {
  margin: 4px 0 0;
  font-size: var(--text-caption);
  font-weight: 600;
  line-height: 1.6;
  color: var(--ink);
}
.calendar-actions {
  display: grid;
  gap: 10px;
  margin-top: 16px;
}
.next-date,
.all-dates {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 44px;
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  color: var(--ocean);
  background: var(--surface);
  font-size: var(--text-caption);
  font-weight: 650;
  text-align: left;
}
.next-date {
  background: var(--light-blue);
}
.calendar-note {
  margin-top: 16px;
}
@container passenger (max-width: 740px) {
  .calendar-layout {
    grid-template-columns: 1fr;
    gap: 20px;
  }
  .calendar-details {
    padding: 18px 0 0;
    border-left: 0;
    border-top: 1px solid var(--line);
  }
  .calendar-modes {
    max-width: none;
  }
}
@container passenger (max-width: 420px) {
  .sailing-calendar {
    padding: 18px 12px;
  }
  .calendar-sheet {
    padding: 10px 8px;
    border-radius: 16px;
  }
  .calendar-heading h2 {
    font-size: 16px;
  }
  .month-controls h3 {
    font-size: 17px;
  }
  .week-labels,
  .calendar-days {
    gap: 4px;
  }
  .calendar-day,
  .calendar-blank {
    min-height: 66px;
    border-radius: 11px;
  }
  .calendar-day {
    padding: 8px 5px;
  }
  .calendar-day strong {
    font-size: 16px;
  }
  .trip-count {
    min-width: 22px;
    min-height: 22px;
    padding: 3px 4px;
    font-size: 11px;
  }
}
@container passenger (max-width: 340px) {
  .sailing-calendar {
    padding: 16px 8px;
  }
  .calendar-sheet {
    padding: 8px 5px;
  }
  .week-labels,
  .calendar-days {
    gap: 3px;
  }
  .week-labels {
    font-size: 9px;
  }
  .month-controls h3 {
    font-size: 15px;
  }
  .calendar-day {
    padding: 7px 3px;
  }
  .calendar-day .day-status {
    font-size: 9px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .calendar-day {
    transition: none;
  }
}
</style>
