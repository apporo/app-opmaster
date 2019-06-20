'use strict';

var path = require('path');

module.exports = {
  plugins: {
    appOpmaster: {
      mappings: {
        "application/example": {
          enabled: true,
          methods: {
            "fibonacci": {
              rpcName: "example",
              routineId: "fibonacci"
            }
          }
        }
      },
      rpcMasters: {
        "example": {
          uri: process.env.DEVEBOT_OPFLOW_URI || 'amqp://localhost',
          exchangeQuota: 20,
          exchangeName: 'app-opflow4x-example',
          routingKey: 'app-opflow4x-fibonacci',
          responseName: 'app-opflow4x-response',
          applicationId: 'FibonacciExample',
          monitorInterval: 50,
          // monitorTimeout: 60000,
          autoinit: false
        }
      },
      throughputQuota: 50,
      ticketDeliveryDelay: 0
    }
  }
};
