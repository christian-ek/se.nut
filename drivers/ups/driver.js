'use strict';

const { Driver } = require('homey');
const Nut = require('../../lib/node-nut');
const { parseUPSStatus } = require('../../lib/Utils');

class UPSDriver extends Driver {

  nut;

  // Pairing
  onPair(session) {
    this.log('Pairing started');

    session.setHandler('getSettings', async () => {
      return {
        ip: this.homey.settings.get('ip'),
        port: this.homey.settings.get('port'),
        interval: this.homey.settings.get('interval'),
        username: this.homey.settings.get('username'),
        password: this.homey.settings.get('password'),
        watt_nominal: this.homey.settings.get('watt_nominal'),
      };
    });

    const foundDevices = [];

    session.setHandler('connect', async (data) => {
      this.log('Connecting to server');

      try {
        const settings = data;

        this.nut = new Nut(parseInt(settings.port, 10), settings.ip);

        this.nut.on('error', (err) => {
          this.log(`There was an error: ${err}`);
        });

        this.nut.on('close', () => {
          this.log('Connection closed.');
        });

        this.log('Requesting list of active devices..');

        await this.nut.start()
          .then(() => this.nut.SetUsername(settings.username))
          .then(() => this.nut.SetPassword(settings.password))
          .then(() => this.nut.GetUPSList())
          .then(async (list) => {
            for (const ups of Object.keys(list)) {
              foundDevices.push(await this.getDeviceData(ups, settings));
            }
          })
          .then(() => this.saveSettings(data))
          .catch((err) => this.log(err))
          .finally(() => {
            this.nut.close();
          });
      } catch (err) {
        this.log(`There was an error: ${err.message}`);
      }
    });

    session.setHandler('list_devices', async () => {
      return Promise.resolve(foundDevices);
    });
  }

  saveSettings(data) {
    this.homey.settings.set('ip', data.ip);
    this.homey.settings.set('port', data.port);
    this.homey.settings.set('interval', data.interval);
    this.homey.settings.set('username', data.username);
    this.homey.settings.set('password', data.password);
    this.homey.settings.set('watt_nominal', data.watt_nominal);
  }

  async getDeviceData(name, settings) {
    let device = {};
    this.log('Requesting UPS data for:', name);
    const result = await this.nut.GetUPSVars(name)
      .then((res) => res)
      .catch((err) => this.log(err));

    if (result) {
      this.log('Response:', result);

      const status = parseUPSStatus(result, settings.watt_nominal);
      device = {
        name: status.values.name,
        data: {
          name,
          id: status.values.id,
        },
        settings: {
          ip: settings.ip,
          port: Number(settings.port) || 3493,
          interval: settings.interval,
          username: settings.username,
          password: settings.password,
          watt_nominal: settings.watt_nominal,
        },
        store: {
          capabilities: status.capabilities,
          first_run: true,
        },
      };
    }
    return device;
  }

}

module.exports = UPSDriver;
