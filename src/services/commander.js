'use strict';

var Devebot = require('devebot');
var Promise = Devebot.require('bluebird');
var chores = Devebot.require('chores');
var lodash = Devebot.require('lodash');

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
    LX.has('debug') && LX.log('debug', LT.add({
      enabled: pluginCfg.enabled
    }).toMessage({
      tags: [ blockRef, 'init-mappings' ],
      text: ' - Initialize the mappings, enabled: ${enabled}'
    }));
    if (pluginCfg.enabled === false) return;
    lodash.forOwn(mappings, function(serviceDescriptor, serviceName) {
      createService(services, serviceName, serviceDescriptor);
    });
  }

  var createService = function(storage, serviceName, serviceDescriptor) {
    storage = storage || {};
    storage[serviceName] = storage[serviceName] || {};
    LX.has('debug') && LX.log('debug', LT.add({
      enabled: serviceDescriptor.enabled,
      name: serviceName
    }).toMessage({
      tags: [ blockRef, 'register-service' ],
      text: ' - Initialize the service[${name}], enabled: ${enabled}'
    }));
    if (serviceDescriptor.enabled !== false) {
      var methods = serviceDescriptor.methods || {};
      lodash.forOwn(methods, function(methodDescriptor, methodName) {
        registerMethod(storage[serviceName], methodName, methodDescriptor);
      });
    }
    return storage;
  }

  var parseMethodArgs = function(args) {
    var opts = {};
    if (args.length > 0) {
      opts = args[args.length - 1];
      if (opts && lodash.isObject(opts) && opts.requestId && opts.opflowSeal) {
        args = Array.prototype.slice.call(args, 0, args.length - 1);
      } else {
        args = Array.prototype.slice.call(args);
        opts = {};
      }
    }
    return { methodArgs: args, options: opts }
  }

  var registerMethod = function(target, methodName, methodDescriptor) {
    target = target || {};

    // TODO: validate descriptor here
    methodDescriptor = methodDescriptor || {};

    var routineId = methodDescriptor.routineId || methodName;
    var routineTr = LT.branch({ key:'routineId', value:routineId });

    LX.has('debug') && LX.log('debug', routineTr.add({
      enabled: methodDescriptor.enabled,
      name: methodName
    }).toMessage({
      tags: [ blockRef, 'register-method' ],
      text: ' - Initialize method[${name}] ~ routine[${routineId}], enabled: ${enabled}'
    }));

    if (methodDescriptor.enabled === false) return target;

    Object.defineProperty(target, methodName, {
      get: function() {
        return function() {
          let { methodArgs, options } = parseMethodArgs(arguments);
          var requestId = options.requestId || LT.getLogID();
          var requestTrail = routineTr.branch({ key:'requestId', value:requestId });
          LX.has('info') && LX.log('info', requestTrail.add({
            routineId: routineId,
            methodArgs: methodArgs,
            options: options
          }).toMessage({
            tags: [ blockRef, 'dispatch-message' ],
            text: 'Routine[${routineId}] arguments: ${methodArgs}, options: ${options}'
          }));
          return assertRpcMaster(methodDescriptor.rpcName).then(function(handler) {
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
                tags: [ blockRef, 'receive-result' ],
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
