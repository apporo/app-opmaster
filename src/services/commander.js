'use strict';

var Devebot = require('devebot');
var Promise = Devebot.require('bluebird');
var chores = Devebot.require('chores');
var lodash = Devebot.require('lodash');
var logolite = Devebot.require('logolite');

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
  var mappings = pluginCfg.mappings || {};
  var services = {};

  self.lookupService = function(serviceName) {
    return services[serviceName];
  }

  var init = function() {
    if (pluginCfg.enabled === false) return;
    lodash.forOwn(mappings, function(serviceDescriptor, serviceName) {
      createService(services, serviceName, serviceDescriptor);
    });
  }

  var createService = function(storage, serviceName, descriptor) {
    storage = storage || {};
    storage[serviceName] = storage[serviceName] || {};
    if (descriptor.enabled !== false) {
      var methods = descriptor.methods || {};
      lodash.forOwn(methods, function(methodDescriptor, methodName) {
        registerMethod(storage[serviceName], methodName, methodDescriptor);
      });
    }
    return storage;
  }

  var registerMethod = function(target, methodName, descriptor) {
    target = target || {};

    // TODO: validate descriptor here
    descriptor = descriptor || {};

    if (descriptor.enabled === false) return target;

    var routineId = descriptor.routineId || methodName;
    Object.defineProperty(target, methodName, {
      get: function() {
        return function(methodArgs, options) {
          options = options || {};
          var requestId = options.requestId || LT.getLogID();
          var requestTrail = LT.branch({ key:'requestId', value:requestId });
          LX.has('info') && LX.log('info', requestTrail.toMessage({
            text: 'send a new request'
          }));
          LX.has('debug') && LX.log('debug', requestTrail.add({
            args: methodArgs
          }).toMessage({
            text: 'method parameters: ${args}'
          }));
          return assertRpcMaster(descriptor.rpcName).then(function(handler) {
            return handler.request(routineId, methodArgs, {
              requestId: requestId,
              progressEnabled: false
            });
          }).then(function(task) {
            LX.has('info') && LX.log('info', requestTrail.toMessage({
              text: 'request has been sent, waiting for result'
            }));
            return task.extractResult().then(function(result) {
              LX.has('info') && LX.log('info', requestTrail.add({
                status: result.status,
                data: result.data
              }).toMessage({
                text: 'request has finished with status: ${status}'
              }));
              if (result.timeout) return Promise.reject({
                code: 'RPC_TIMEOUT',
                text: 'RPC request is timeout'
              });
              if (result.failed) return Promise.reject(result.error);
              if (result.completed) return Promise.resolve(result.value);
            });
          });
        }
      },
      set: function(val) {}
    });
    return target;
  }

  var rpcMasterStore = params.rpcMaster;
  var assertRpcMaster = function(rpcName) {
    var rpcMaster = rpcMasterStore.get(rpcName);
    if (rpcMaster) return Promise.resolve(rpcMaster);
    return Promise.reject();
  }

  init();

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor end!'
  }));
};

Service.referenceList = [ 'rpcMaster' ];

module.exports = Service;
