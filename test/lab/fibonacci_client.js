'use strict';

var app = require('../app');
var lodash = devebot.require('lodash');

app.server.start().then(function() {
  app.server.invoke(function(injektor) {
    var sandboxManager = injektor.lookup('sandboxManager');
    var invoker = sandboxManager.getSandboxService('application/invoker');
    var total = 60000;
    var cards = lodash.map(lodash.range(total), function(idx) {
      return lodash.padStart(idx, 8, '0');
    });
    for(var k=0; k<total; k++) {
      var item = {};
      item.number = lodash.random(10, 50);
      item.actionId = lodash.padStart(k, 8, '0');
      invoker.calc(item.number, item.actionId).then(function(result) {
        var actionId = result.actionId;
        console.log('Result of (%s): %s', actionId, JSON.stringify(result));
        var actionIndex = cards.indexOf(actionId);
        if (actionIndex >= 0) cards.splice(actionIndex, 1);
      }).catch(function(err) {
        console.error('Error: %s', JSON.stringify(err));
      }).finally(function() {
        if (cards.length < 10) {
          console.log('Remain: %s', JSON.stringify(cards));
        }
      })
    }
  })
});
