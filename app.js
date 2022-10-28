'use strict';

const Homey = require('homey');

class MyApp extends Homey.App {

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('NUT has been initialized');

    this.batteryRuntimeLowerThanTrigger = this.homey.flow.getDeviceTriggerCard('battery_runtime_lower_than');
    this.batteryRuntimeLowerThanTrigger.registerRunListener(async (args, state) => {
      return args.value > state.runtime;
    });

    this.batteryRuntimeBiggerThanTrigger = this.homey.flow.getDeviceTriggerCard('battery_runtime_bigger_than');
    this.batteryRuntimeBiggerThanTrigger.registerRunListener(async (args, state) => {
      return args.value < state.runtime;
    });
  }

}

module.exports = MyApp;
