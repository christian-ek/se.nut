'use strict';

const Homey = require('homey');

class MyApp extends Homey.App {

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('NUT has been initialized');
    const runAnimationAction = this.homey.flow.getActionCard('battery_runtime_lower_than');

    runAnimationAction.registerRunListener(async (args, state) => {
      if (args.duration != null) {
        // do something with the duration
        // (e.g. run an animation for duration milliseconds)

      }
    });
  }

}

module.exports = MyApp;
