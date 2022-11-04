# Network UPS Tools (NUT)

This app adds Network UPS Tools (NUT) support for Homey Pro.
It allows you to monitor a UPS (battery backup) by using data from a [NUT](https://networkupstools.org/) server.


# What is NUT?
The primary goal of the Network UPS Tools (NUT) project is to provide support for Power Devices, such as Uninterruptible Power Supplies, Power Distribution Units, Automatic Transfer Switches, Power Supply Units and Solar Controllers. NUT provides a common protocol and set of tools to monitor and manage such devices, and to consistently name equivalent features and data points, across a vast range of vendor-specific protocols and connection media types.

NUT provides many control and monitoring [features](https://networkupstools.org/features.html), with a uniform control and management interface. If you are just getting acquainted with NUT, [that page](https://networkupstools.org/features.html) also explains the technical design and some possible set-ups.

More than 170 different manufacturers, and several thousands of models are [compatible](https://networkupstools.org/stable-hcl.html).


# Supported UPS variables

At the moment this app supports and adds capabilities for the following UPS variables: 

* **ups.model** - UPS Name.
* **battery.charge**  - Current battery level.
* **battery.runtime** - How many seconds battery runtime is left.
* **battery.temperature** - Battery temperature.
* **ups.status** - Current status.
* **input.voltage** - Input voltage.
* **output.voltage** - Output voltage.

You can request more capabilities to be added but these where the ones interesting on my UPS.

# ToDo

* Add discovery through ZeroConf.
* Add Energy usage for the UPSes that support that.