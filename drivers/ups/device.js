'use strict';

const { Device } = require('homey');
const Nut = require('node-nut');
const { parseUPSStatus } = require('../../lib/Utils');

class UPSDevice extends Device {

  static once(fn) {
    let called = false;
    return (...args) => {
      if (called) return;
      called = true;
      fn(...args);
    };
  }

  normalizeError(err) {
    if (err instanceof Error && err.message) {
      return err.message;
    }

    if (typeof err === 'string') {
      return err;
    }

    if (err == null) {
      return 'Unknown error';
    }

    try {
      return JSON.stringify(err);
    } catch (e) {
      return String(err);
    }
  }

  async refreshDeviceData() {
    const { device } = this;

    if (this.refreshInProgress) {
      this.log(`[${this.getName()}][${device.id}]`, 'Previous refresh still in progress, skipping tick');
      return;
    }

    this.refreshInProgress = true;
    try {
      await this.getDeviceData();
      if (!this.getAvailable()) {
        this.setAvailable().catch(this.error);
      }
    } catch (err) {
      const message = this.normalizeError(err);
      this.log('Failed to refresh device data:', message);
      this.setUnavailable(`Connection failed: ${message}`).catch(this.error);
    } finally {
      this.refreshInProgress = false;
    }
  }

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.device = this.getData();
    const updateInterval = Number(this.getSetting('interval')) * 1000;
    const { device } = this;
    this.log(`[${this.getName()}][${device.id}]`, `Update Interval: ${updateInterval}`);
    this.log(`[${this.getName()}][${device.id}]`, 'Connected to device');
    this.refreshInProgress = false;
    this.interval = setInterval(async () => {
      await this.refreshDeviceData();
    }, updateInterval);

    this.log('UPS device has been initialized');
  }

  async getDeviceData() {
    const { device } = this;
    this.log(`[${this.getName()}][${device.id}]`, 'Refresh device');

    // Create a new Nut connection for each data fetch
    const nut = new Nut(parseInt(this.getSetting('port'), 10), this.getSetting('ip'));

    return new Promise((resolve, reject) => {
      const rejectWithNormalizedError = (err) => {
        reject(new Error(this.normalizeError(err)));
      };

      const closeConnection = UPSDevice.once(() => {
        nut.close();
      });

      const isBusyError = (err) => this.normalizeError(err).includes('Other communication still running');

      const delay = (ms) => new Promise((next) => setTimeout(next, ms));

      const runWithBusyRetry = async (operationName, operation, maxRetries = 2) => {
        for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
          try {
            return await operation();
          } catch (err) {
            if (isBusyError(err) && attempt < maxRetries) {
              this.log(`${operationName} busy, retrying`);
              await delay(50);
              continue;
            }
            throw err;
          }
        }

        throw new Error(`${operationName} failed after retry`);
      };

      const setUsername = () => new Promise((resolveSetUsername, rejectSetUsername) => {
        nut.SetUsername(
          this.getSetting('username'),
          UPSDevice.once((err) => {
            if (err) {
              rejectSetUsername(err);
              return;
            }

            resolveSetUsername();
          }),
        );
      });

      const setPassword = () => new Promise((resolveSetPassword, rejectSetPassword) => {
        nut.SetPassword(
          this.getSetting('password'),
          UPSDevice.once((err) => {
            if (err) {
              rejectSetPassword(err);
              return;
            }

            resolveSetPassword();
          }),
        );
      });

      const getUPSVars = () => new Promise((resolveGetVars, rejectGetVars) => {
        nut.GetUPSVars(
          device.name,
          UPSDevice.once((vars, err) => {
            if (err) {
              rejectGetVars(err);
              return;
            }

            resolveGetVars(vars);
          }),
        );
      });

      const onReady = () => {
        (async () => {
          try {
            await runWithBusyRetry('SetUsername', setUsername);
            await runWithBusyRetry('SetPassword', setPassword);
            const vars = await runWithBusyRetry('GetUPSVars', getUPSVars);

            this.log(vars);
            const estimatePower = this.getSetting('estimate_power');
            const wattNominal = estimatePower === true ? this.getSetting('watt_nominal') : null;
            const status = parseUPSStatus(vars, estimatePower, wattNominal);
            this.log(status);
            this.setCapabilities(status);
            closeConnection();
            resolve();
          } catch (err) {
            closeConnection();
            rejectWithNormalizedError(err);
          }
        })();
      };

      const onError = (err) => {
        this.log('Connection error:', err);
        closeConnection();
        rejectWithNormalizedError(err);
      };

      nut.on('ready', onReady);
      nut.on('error', onError);
      nut.start();
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
      this.log(`Updating capability [${capability}]`);
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
    this.setCapabilityValue(capability, value).catch(this.error);
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
  async onSettings({ oldSettings, newSettings, changedKeys }) {
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
      await this.refreshDeviceData();
    }, updateInterval);
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    const { interval, device } = this;
    this.log(`${device.name} deleted`);
    clearInterval(interval);
  }

}

module.exports = UPSDevice;
