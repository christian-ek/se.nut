// eslint-disable-next-line strict
const STATE_TYPES = {
  OL: 'Online',
  OB: 'On Battery',
  LB: 'Low Battery',
  HB: 'High Battery',
  RB: 'Battery Needs Replaced',
  CHRG: 'Battery Charging',
  DISCHRG: 'Battery Discharging',
  BYPASS: 'Bypass Active',
  CAL: 'Runtime Calibration',
  OFF: 'Offline',
  OVER: 'Overloaded',
  TRIM: 'Trimming Voltage',
  BOOST: 'Boosting Voltage',
  FSD: 'Forced Shutdown',
  ALARM: 'Alarm',
};
status_readable = '';
console.log(status_readable);

// eslint-disable-next-line no-return-assign
'OB DISCHRG'.split(' ').forEach((word) => status_readable += `${STATE_TYPES[word]}, `);

console.log('OB DISCHRG'.split());

status_readable = status_readable.replace(/,\s*$/, '');
console.log(status_readable);
