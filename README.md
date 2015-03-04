# NodeBB Appcelerator SSO

NodeBB Plugin that allows users to login/register via their Appcelerator account using the [AppC Passport strategy](https://www.npmjs.com/package/passport-appc).

## Pre-requisites for development

NodeBB needs to run under the same primary domain as the Dashboard for SSO.

1. Generate self-signed keys:

        $ openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout keys/local.key -out keys/local.crt

2. Edit NodeBB's `config.js` to use SSL:

        {
          "url": "https://nodebb.appcelerator.com:8443",
          // ..
          "port": 8443,
          "ssl": {
            "key": "keys/local.key",
            "cert": "keys/local.crt"
          }
        }

3. Edit your `/etc/hosts`:

        127.0.0.1       nodebb.appcelerator.com

## Installation

1. Add the NPM package to your NodeBB install

        $ npm install nodebb-plugin-appc --save

2. Activate the plugin via the NodeBB admin
