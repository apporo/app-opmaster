'use strict';

var Devebot = require('devebot');
var Promise = Devebot.require('bluebird');
var lodash = Devebot.require('lodash');
var opflow = require('opflow');

var Service = function(params) {
  params = params || {};
  var self = this;

  var LX = params.loggingFactory.getLogger();
  var LT = params.loggingFactory.getTracer();

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ 'constructor-begin' ],
    text: ' + constructor begin ...'
  }));

  var pluginCfg = lodash.get(params, ['sandboxConfig'], {});

  var _rpcMasters = {};

  var init = function() {
    if (pluginCfg.enabled === false) return;
    lodash.forOwn(pluginCfg.rpcMasters, function(rpcInfo, rpcName) {
      if (lodash.isObject(rpcInfo) && !lodash.isEmpty(rpcInfo) && rpcInfo.enabled != false) {
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
    tags: [ 'constructor-end' ],
    text: ' - constructor end!'
  }));
};

module.exports = Service;
