// Dev and test data for the schedule page. /schedule?fixture=<key> renders
// ScheduleFront from these (SchedulePage strips the lookup from production
// builds). Every fixture freezes the clock, so the countdowns hold still.

// The live settings/schedule doc as of 2026-10-04.
export const LIVE_SCHEDULE = [
  { day: 'MONDAY', time: '11:00 AM AZ', status: 'on', content: 'Slots', gameName: 'Bonus Hunt Time!' },
  { day: 'TUESDAY', time: '5:00 PM AZ', status: 'on', content: 'Slots', gameName: 'Freestyle Chilling' },
  { day: 'WEDNESDAY', time: '5:00 PM EST', status: 'off', content: 'Gaming - Contraband Police', gameName: 'Contraband Police' },
  { day: 'THURSDAY', time: '11:00 AM AZ', status: 'on', content: 'Slots', gameName: 'Group Bonus Hunt' },
  { day: 'FRY-DAY', time: '11:00 AM AZ', status: 'on', content: 'Slots', gameName: '5 Scat Hunt' },
  { day: 'SATURDAY', time: '9:30 AM MST', status: 'off', content: '', gameName: '' },
  { day: 'SUNDAY', time: '2:30 PM AZ', status: 'off', content: '', gameName: '' },
];

const SUNDAY_NOON_AZ = Date.parse('2026-10-04T19:00:00Z');
const MONDAY_LATE = Date.parse('2026-10-05T19:30:00Z');
const MONDAY_AFTERNOON = Date.parse('2026-10-05T22:00:00Z');

const GAMING_WEEK = LIVE_SCHEDULE.map((e) =>
  e.day === 'MONDAY'
    ? { ...e, time: '4:20 PM - 9:00 PM EST', content: 'Gaming', gameName: 'Contraband Police', status: 'special' }
    : e
);

export const SCHEDULE_FIXTURES = {
  upcoming: { schedule: LIVE_SCHEDULE, now: SUNDAY_NOON_AZ },
  cover: {
    schedule: GAMING_WEEK,
    now: SUNDAY_NOON_AZ,
    covers: { 'Contraband Police': 'https://images.igdb.com/igdb/image/upload/t_cover_big/co696g.jpg' },
  },
  late: { schedule: LIVE_SCHEDULE, now: MONDAY_LATE },
  live: {
    schedule: LIVE_SCHEDULE,
    now: MONDAY_LATE,
    isLive: true,
    stream: { title: 'Bonus hunt time, forty deep and climbing', game_name: 'Slots', thumbnail_url: null },
  },
  // Live past the three hour grace, and live on a day that's off.
  livelong: {
    schedule: LIVE_SCHEDULE,
    now: MONDAY_AFTERNOON,
    isLive: true,
    stream: { title: 'Still hunting, send help', game_name: 'Slots', thumbnail_url: null },
  },
  liveoffday: {
    schedule: LIVE_SCHEDULE,
    now: SUNDAY_NOON_AZ,
    isLive: true,
    stream: { title: 'Surprise Sunday stream', game_name: 'Just Chatting', thumbnail_url: null },
  },
  aired: { schedule: LIVE_SCHEDULE, now: MONDAY_AFTERNOON },
  tba: {
    schedule: LIVE_SCHEDULE.map((e) => (e.day === 'MONDAY' ? { ...e, time: 'After lunch' } : e)),
    now: SUNDAY_NOON_AZ,
  },
  dark: { schedule: LIVE_SCHEDULE.map((e) => ({ ...e, status: 'off' })), now: SUNDAY_NOON_AZ },
  loading: { schedule: [], loading: true, now: SUNDAY_NOON_AZ },
};
