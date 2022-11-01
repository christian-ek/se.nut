'use strict';

const Homey = require('homey');

class MyApp extends Homey.App {

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    const batteryRuntimeIsLessCondition = this.homey.flow.getConditionCard('battery_runtime_is_less');
    batteryRuntimeIsLessCondition.registerRunListener(async (args, state) => {
      const value = args.device.getCapabilityValue('measure_battery_runtime');
      return value < args.value;
    });

    const batteryRuntimeEqualCondition = this.homey.flow.getConditionCard('battery_runtime_equal');
    batteryRuntimeEqualCondition.registerRunListener(async (args, state) => {
      const value = args.device.getCapabilityValue('measure_battery_runtime');
      return value === args.value;
    });

    this.log('NUT has been initialized');
  }

}

module.exports = MyApp;
