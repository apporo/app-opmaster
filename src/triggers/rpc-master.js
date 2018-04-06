'use strict';

var Devebot = require('devebot');
var Promise = Devebot.require('bluebird');
var chores = Devebot.require('chores');
var lodash = Devebot.require('lodash');
var opflow = require('opflow');

var Service = function(params) {
  params = params || {};
  var self = this;

  var LX = params.loggingFactory.getLogger();
  var LT = params.loggingFactory.getTracer();
  var packageName = params.packageName || 'app-opmaster';
  var blockRef = chores.getBlockRef(__filename, packageName);

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor begin ...'
  }));

  var pluginCfg = lodash.get(params, ['sandboxConfig'], {});

  var _rpcMasters = {};

  var init = function() {
    LX.has('debug') && LX.log('debug', LT.add({
      enabled: pluginCfg.enabled,
      rpcNames: lodash.keys(pluginCfg.rpcMasters)
    }).toMessage({
      tags: [ blockRef, 'init-rpcMasters' ],
      text: ' - Initialize RPC Masters: ${rpcNames}, enabled: ${enabled}'
    }));
    if (pluginCfg.enabled === false) return;
    lodash.forOwn(pluginCfg.rpcMasters, function(rpcInfo, rpcName) {
      var rpcEnabled = rpcInfo && lodash.isObject(rpcInfo) && rpcInfo.enabled !== false;
      LX.has('debug') && LX.log('debug', LT.add({
        enabled: rpcEnabled,
        rpcName: rpcName,
        rpcInfo: rpcInfo
      }).toMessage({
        tags: [ blockRef, 'init-rpcMaster' ],
        text: ' - Initialize RPC Master: ${rpcName} with parameters: ${rpcInfo}'
      }));
      if (rpcEnabled) {
        _rpcMasters[rpcName] = new opflow.RpcMaster(rpcInfo);
      }
    });
  }

  init();

  self.get = function(rpcName) {
    return _rpcMasters[rpcName];
  }

  self.start = function() {
    return Promise.mapSeries(lodash.values(_rpcMasters), function(rpc) {
      return rpc.ready();
    });
  };

  self.stop = function() {
    return Promise.mapSeries(lodash.values(_rpcMasters), function(rpc) {
      return rpc.close();
    });
  };

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor end!'
  }));
};

module.exports = Service;
