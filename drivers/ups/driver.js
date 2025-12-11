'use strict';

const { Driver } = require('homey');
const Nut = require('node-nut');
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
        estimate_power: this.homey.settings.get('estimate_power'),
        watt_nominal: this.homey.settings.get('watt_nominal'),
      };
    });

    const foundDevices = [];

    session.setHandler('connect', async (data) => {
      this.log('Connecting to server');

      const settings = data;

      return new Promise((resolve, reject) => {
        this.nut = new Nut(parseInt(settings.port, 10), settings.ip);

        this.nut.on('error', (err) => {
          this.log(`There was an error: ${err}`);
          reject(err);
        });

        this.nut.on('close', () => {
          this.log('Connection closed.');
        });

        this.nut.on('ready', () => {
          this.log('Requesting list of active devices..');

          this.nut.SetUsername(settings.username, (usernameErr) => {
            if (usernameErr) {
              this.log('SetUsername error:', usernameErr);
            }

            this.nut.SetPassword(settings.password, (passwordErr) => {
              if (passwordErr) {
                this.log('SetPassword error:', passwordErr);
              }

              this.nut.GetUPSList((list, listErr) => {
                if (listErr) {
                  this.log('GetUPSList error:', listErr);
                  this.nut.close();
                  reject(listErr);
                  return;
                }

                this.log('Found UPS devices:', Object.keys(list));

                const processDevices = async () => {
                  for (const ups of Object.keys(list)) {
                    const device = await this.getDeviceData(ups, settings);
                    foundDevices.push(device);
                  }
                  this.saveSettings(data);
                  this.nut.close();
                  resolve();
                };

                processDevices().catch((err) => {
                  this.log('Error processing devices:', err);
                  this.nut.close();
                  reject(err);
                });
              });
            });
          });
        });

        this.nut.start();
      });
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
    this.homey.settings.set('estimate_power', data.estimate_power);
    this.homey.settings.set('watt_nominal', data.watt_nominal);
  }

  getDeviceData(name, settings) {
    return new Promise((resolve, reject) => {
      this.log('Requesting UPS data for:', name);

      this.nut.GetUPSVars(name, (vars, err) => {
        if (err) {
          this.log('GetUPSVars error:', err);
          reject(err);
          return;
        }

        this.log('Response:', vars);

        const status = parseUPSStatus(vars, settings.estimate_power, settings.watt_nominal);
        const device = {
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
            estimate_power: settings.estimate_power,
            watt_nominal: settings.watt_nominal,
          },
          store: {
            capabilities: status.capabilities,
            first_run: true,
          },
        };

        resolve(device);
      });
    });
  }

}

module.exports = UPSDriver;
