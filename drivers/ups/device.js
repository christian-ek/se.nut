'use strict';

const { Device } = require('homey');
const { parseUPSStatus } = require('../../lib/Utils');
const Nut = require('../../lib/node-nut');

class UPSDevice extends Device {

  nut;

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.initNut();

    this.device = this.getData();
    const updateInterval = Number(this.getSetting('interval')) * 1000;
    const { device } = this;
    this.log(`[${this.getName()}][${device.id}]`, `Update Interval: ${updateInterval}`);
    this.log(`[${this.getName()}][${device.id}]`, 'Connected to device');
    this.interval = setInterval(async () => {
      await this.getDeviceData();
    }, updateInterval);

    this.log('UPS device has been initialized');
  }

  async getDeviceData() {
    const { device } = this;
    this.log(`[${this.getName()}][${device.id}]`, 'Refresh device');

    await this.nut.start()
      .then(() => this.nut.SetUsername(this.getSetting.username))
      .then(() => this.nut.SetPassword(this.getSetting.password))
      .then(() => this.nut.GetUPSVars(device.name))
      .then((res) => {
        this.log(res);
        return parseUPSStatus(res);
      })
      .then((res) => {
        this.log(res);
        this.setCapabilities(res);
      })
      .catch((err) => this.log(err))
      .finally(() => {
        this.nut.close();
      });
  }

  initNut() {
    this.nut = new Nut(parseInt(this.getSetting('port'), 10), this.getSetting('ip'));

    this.nut.on('error', (err) => {
      this.log(`There was an error: ${err}`);
    });

    this.nut.on('close', () => {
      this.log('Connection closed.');
    });
  }

  setCapabilities(status) {
    const firstRun = this.getStoreValue('first_run');
    const deviceCapabilities = this.getStoreValue('capabilities');

    if (firstRun != null && firstRun) {
      /*
      * Go through all capabilities on the driver and remove those not supported by device.
      */
      this.log('Running setCapabilities for the first time');
      const allCapabilities = this.getCapabilities();
      allCapabilities.forEach((capability) => {
        if (!deviceCapabilities.includes(capability)) {
          this.removeCapability(capability);
          this.log(`Removing capability not supported by device [${capability}]`);
        }
      });
      this.setStoreValue('first_run', false);
    }

    const capabilityList = deviceCapabilities == null ? status.capabilities : deviceCapabilities;
    capabilityList.forEach((capability) => {
      const isSubCapability = capability.split('.').length > 1;
      if (isSubCapability) {
        const capabilityName = capability.split('.')[0];
        const subCapabilityName = capability.split('.').pop();
        this.updateValue(`${[capabilityName]}.${[subCapabilityName]}`, status.values[capabilityName][subCapabilityName]);
      } else {
        this.updateValue(capability, status.values[capability]);
      }
    });
  }

  updateValue(capability, value) {
    this.log(`Setting capability [${capability}] value to: ${value}`);
    this.setCapabilityValue(capability, value)
      .catch(this.error);
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('device added');
    this.log('name:', this.getName());
    this.log('class:', this.getClass());
    this.log('data', this.getData());
    this.log('capabilities', this.getStoreValue('capabilities'));
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({
    oldSettings,
    newSettings,
    changedKeys,
  }) {
    const { interval } = this;
    for (const name of changedKeys) {
      /* Log setting changes except for password */
      if (name !== 'password') {
        this.log(`Setting '${name}' set '${oldSettings[name]}' => '${newSettings[name]}'`);
      }
    }
    if (oldSettings.interval !== newSettings.interval) {
      this.log(`Delete old interval of ${oldSettings.interval}s and creating new ${newSettings.interval}s`);
      clearInterval(interval);
      this.setUpdateInterval(newSettings.interval);
    }
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
    this.log(`${name} renamed`);
  }

  setUpdateInterval(newInterval) {
    const updateInterval = Number(newInterval) * 1000;
    this.log(`Creating update interval with ${updateInterval}`);
    this.interval = setInterval(async () => {
      await this.getDeviceData();
    }, updateInterval);
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    const {
      interval,
      device,
    } = this;
    this.log(`${device.name} deleted`);
    clearInterval(interval);
  }

}

module.exports = UPSDevice;
