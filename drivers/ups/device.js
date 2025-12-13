'use strict';

const { Device } = require('homey');
const { parseUPSStatus } = require('../../lib/Utils');
const Nut = require('node-nut');

class UPSDevice extends Device {

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.device = this.getData();
    const updateInterval = Number(this.getSetting('interval')) * 1000;
    const { device } = this;
    this.log(`[${this.getName()}][${device.id}]`, `Update Interval: ${updateInterval}`);
    this.log(`[${this.getName()}][${device.id}]`, 'Connected to device');
    this.interval = setInterval(async () => {
      try {
        await this.getDeviceData();
        if (!this.getAvailable()) {
          this.setAvailable().catch(this.error);
        }
      } catch (err) {
        this.log('Failed to refresh device data:', err.message);
        this.setUnavailable(`Connection failed: ${err.message}`).catch(this.error);
      }
    }, updateInterval);

    this.log('UPS device has been initialized');
  }

  async getDeviceData() {
    const { device } = this;
    this.log(`[${this.getName()}][${device.id}]`, 'Refresh device');

    // Create a new Nut connection for each data fetch
    const nut = new Nut(parseInt(this.getSetting('port'), 10), this.getSetting('ip'));

    return new Promise((resolve, reject) => {
      const onReady = () => {
        nut.SetUsername(this.getSetting('username'), (err) => {
          if (err) {
            this.log('SetUsername error:', err);
          }
          nut.SetPassword(this.getSetting('password'), (err2) => {
            if (err2) {
              this.log('SetPassword error:', err2);
            }
            nut.GetUPSVars(device.name, (vars, err3) => {
              if (err3) {
                this.log('GetUPSVars error:', err3);
                nut.close();
                reject(err3);
                return;
              }
              this.log(vars);
              const estimatePower = this.getSetting('estimate_power');
              const wattNominal = estimatePower === true ? this.getSetting('watt_nominal') : null;
              const status = parseUPSStatus(vars, estimatePower, wattNominal);
              this.log(status);
              this.setCapabilities(status)
                .then(() => {
                  nut.close();
                  resolve();
                })
                .catch((capabilityErr) => {
                  nut.close();
                  reject(capabilityErr);
                });
            });
          });
        });
      };

      const onError = (err) => {
        this.log('Connection error:', err);
        reject(err);
      };

      nut.on('ready', onReady);
      nut.on('error', onError);
      nut.start();
    });
  }

  async setCapabilities(status) {
    const firstRun = this.getStoreValue('first_run');
    const storedCapabilitiesRaw = this.getStoreValue('capabilities');
    const storedCapabilities = Array.isArray(storedCapabilitiesRaw) ? storedCapabilitiesRaw : [];
    const statusCapabilities = status && Array.isArray(status.capabilities) ? status.capabilities : [];

    const desiredCapabilities = Array.from(new Set([...storedCapabilities, ...statusCapabilities]));

    const shouldUpdateStoredCapabilities = !Array.isArray(storedCapabilitiesRaw)
      || storedCapabilities.length !== desiredCapabilities.length
      || storedCapabilities.some((capability) => !desiredCapabilities.includes(capability));

    if (shouldUpdateStoredCapabilities) {
      await this.setStoreValue('capabilities', desiredCapabilities);
    }

    const currentCapabilities = this.getCapabilities();
    const desiredSet = new Set(desiredCapabilities);
    const missingCapabilities = desiredCapabilities.filter((capability) => !currentCapabilities.includes(capability));
    const unsupportedCapabilities = currentCapabilities.filter((capability) => !desiredSet.has(capability));

    if (firstRun === true) {
      this.log('Running setCapabilities for the first time');
    }

    if (missingCapabilities.length > 0 || unsupportedCapabilities.length > 0) {
      for (const capability of missingCapabilities) {
        this.log(`Adding capability supported by device [${capability}]`);
        // eslint-disable-next-line no-await-in-loop
        await this.addCapability(capability).catch(this.error);
      }

      for (const capability of unsupportedCapabilities) {
        this.log(`Removing capability not supported by device [${capability}]`);
        // eslint-disable-next-line no-await-in-loop
        await this.removeCapability(capability).catch(this.error);
      }
    }

    if (firstRun === true) {
      await this.setStoreValue('first_run', false);
    }

    desiredCapabilities.forEach((capability) => {
      const isSubCapability = capability.split('.').length > 1;
      this.log(`Updating capability [${capability}]`);
      if (isSubCapability) {
        const capabilityName = capability.split('.')[0];
        const subCapabilityName = capability.split('.').pop();
        const value = status && status.values && status.values[capabilityName]
          ? status.values[capabilityName][subCapabilityName]
          : null;
        if (value == null) return;
        this.updateValue(`${[capabilityName]}.${[subCapabilityName]}`, value);
      } else {
        const value = status && status.values ? status.values[capability] : null;
        if (value == null) return;
        this.updateValue(capability, value);
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
