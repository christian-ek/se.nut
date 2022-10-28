'use strict';

module.exports.parseUPSStatus = (body) => {
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

  const result = {};

  result.name = body['ups.model'];
  result.battery = parseInt(body['battery.charge'], 10);
  result.battery_runtime = parseInt(body['battery.runtime'], 10);
  result.battery_temperature = parseFloat(body['battery.temperature']);

  result.id = body['device.serial'];
  result.status = body['ups.status'];

  result.status_readable = '';
  // eslint-disable-next-line no-return-assign
  body['ups.status'].split(' ').forEach((word) => result.status_readable += `${STATE_TYPES[word]}, `);
  result.status_readable = result.status_readable.replace(/,\s*$/, '');

  result.alarm_status = !result.status.startsWith('OL');
  result.input_voltage = parseInt(body['input.voltage'], 10);
  result.output_voltage = parseInt(body['output.voltage'], 10);

  return result;
};
