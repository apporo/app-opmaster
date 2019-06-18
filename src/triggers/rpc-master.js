'use strict';

const Devebot = require('devebot');
const Promise = Devebot.require('bluebird');
const chores = Devebot.require('chores');
const lodash = Devebot.require('lodash');
const opflow = require('opflow');

function Service(params = {}) {
  let LX = params.loggingFactory.getLogger();
  let LT = params.loggingFactory.getTracer();
  let packageName = params.packageName || 'app-opmaster';
  let blockRef = chores.getBlockRef(__filename, packageName);

  let pluginCfg = lodash.get(params, ['sandboxConfig'], {});

  let _rpcMasters = {};

  let init = function() {
    LX.has('debug') && LX.log('debug', LT.add({
      enabled: pluginCfg.enabled,
      rpcNames: lodash.keys(pluginCfg.rpcMasters)
    }).toMessage({
      tags: [ blockRef, 'init-rpcMasters' ],
      text: ' - Initialize RPC Masters: ${rpcNames}, enabled: ${enabled}'
    }));
    if (pluginCfg.enabled === false) return;
    lodash.forOwn(pluginCfg.rpcMasters, function(rpcInfo, rpcName) {
      let rpcEnabled = rpcInfo && lodash.isObject(rpcInfo) && rpcInfo.enabled !== false;
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

  this.get = function(rpcName) {
    return _rpcMasters[rpcName];
  }

  this.start = function() {
    return Promise.mapSeries(lodash.values(_rpcMasters), function(rpc) {
      return rpc.ready();
    });
  };

  this.stop = function() {
    return Promise.mapSeries(lodash.values(_rpcMasters), function(rpc) {
      return rpc.close();
    });
  };
};

module.exports = Service;
