'use strict';

const Devebot = require('devebot');
const Promise = Devebot.require('bluebird');
const chores = Devebot.require('chores');
const lodash = Devebot.require('lodash');
const valvekit = require('valvekit');

function Service(params = {}) {
  let LX = params.loggingFactory.getLogger();
  let LT = params.loggingFactory.getTracer();
  let packageName = params.packageName || 'app-opmaster';
  let blockRef = chores.getBlockRef(__filename, packageName);

  let pluginCfg = lodash.get(params, ['sandboxConfig'], {});
  let mappings = pluginCfg.mappings || {};
  let services = {};

  let ticketDeliveryDelay = pluginCfg.ticketDeliveryDelay || null;
  if (!(lodash.isInteger(ticketDeliveryDelay) && ticketDeliveryDelay > 0)) {
    ticketDeliveryDelay = null;
  }

  let throughputValve = null;
  if (lodash.isInteger(pluginCfg.throughputQuota) && pluginCfg.throughputQuota > 0) {
    LX.has('debug') && LX.log('debug', LT.add({
      throughputQuota: pluginCfg.throughputQuota
    }).toMessage({
      tags: [ blockRef, 'quota-ticket' ],
      text: ' - Create throughput valve: ${throughputQuota}'
    }));
    throughputValve = valvekit.createSemaphore(pluginCfg.throughputQuota);
  }

  const ctx = {
    LX, LT, blockRef, throughputValve, ticketDeliveryDelay,
    rpcMasterStore: params.rpcMaster
  }

  this.lookupService = function(serviceName) {
    return services[serviceName];
  }

  init(ctx, services, mappings, pluginCfg.enabled !== false);
};

Service.referenceList = [ 'rpcMaster' ];

module.exports = Service;

let init = function(ctx, services, mappings, enabled) {
  const {LX, LT, blockRef} = ctx;
  LX.has('debug') && LX.log('debug', LT.add({ enabled }).toMessage({
    tags: [ blockRef, 'init-mappings' ],
    text: ' - Initialize the mappings, enabled: ${enabled}'
  }));
  if (!enabled) return;
  lodash.forOwn(mappings, function(serviceDescriptor, serviceName) {
    createService(ctx, services, serviceName, serviceDescriptor);
  });
}

function createService(ctx, storage, serviceName, serviceDescriptor) {
  const {LX, LT, blockRef} = ctx;
  storage = storage || {};
  storage[serviceName] = storage[serviceName] || {};
  LX.has('debug') && LX.log('debug', LT.add({
    enabled: serviceDescriptor.enabled !== false,
    name: serviceName
  }).toMessage({
    tags: [ blockRef, 'register-service' ],
    text: ' - Initialize the service[${name}], enabled: ${enabled}'
  }));
  if (serviceDescriptor.enabled !== false) {
    let methods = serviceDescriptor.methods || {};
    lodash.forOwn(methods, function(methodDescriptor, methodName) {
      registerMethod(ctx, storage[serviceName], methodName, methodDescriptor);
    });
  }
  return storage;
}

function registerMethod(ctx, target, methodName, methodDescriptor) {
  const {LX, LT, blockRef} = ctx;
  target = target || {};

  // TODO: validate descriptor here
  methodDescriptor = methodDescriptor || {};

  let routineId = methodDescriptor.routineId || methodName;
  let routineTr = LT.branch({ key:'routineId', value:routineId });

  LX.has('debug') && LX.log('debug', routineTr.add({
    enabled: methodDescriptor.enabled !== false,
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
        return getTicket(ctx).then(function(ticketId) {
          let requestId = options.requestId || LT.getLogID();
          let requestTrail = routineTr.branch({ key:'requestId', value:requestId });
          LX.has('info') && LX.log('info', requestTrail.add({
            ticketId: ticketId,
            routineId: routineId,
            methodArgs: methodArgs,
            options: options
          }).toMessage({
            tags: [ blockRef, 'dispatch-message' ],
            text: '[${ticketId}] Routine[${routineId}] arguments: ${methodArgs}, options: ${options}'
          }));
          return assertRpcMaster(ctx, methodDescriptor.rpcName).then(function(handler) {
            return handler.request(routineId, methodArgs, {
              requestId: requestId,
              progressEnabled: false
            });
          }).then(function(task) {
            LX.has('info') && LX.log('info', requestTrail.add({
              ticketId: ticketId
            }).toMessage({
              text: '[${ticketId}] request has been sent, waiting for result'
            }));
            return task.extractResult();
          }).then(function(result) {
            LX.has('info') && LX.log('info', requestTrail.add({
              ticketId: ticketId,
              status: result.status,
              data: result.data
            }).toMessage({
              tags: [ blockRef, 'receive-result' ],
              text: '[${ticketId}] request has finished with status: ${status}'
            }));
            if (result.completed) return Promise.resolve(result.value);
            if (result.failed) return Promise.reject({
              code: 'RPC_FAILED',
              text: 'RPC request has failed',
              error: result.error
            });
            if (result.timeout) return Promise.reject({
              code: 'RPC_TIMEOUT',
              text: 'RPC request is timeout'
            });
            return Promise.reject({
              code: 'RPC_UNKNOWN',
              text: 'RPC request return unknown output'
            });
          }).finally(function() {
            releaseTicket(ctx, ticketId);
          });
        });
      }
    },
    set: function(val) {}
  });
  return target;
}

function assertRpcMaster(ctx, rpcName) {
  const {rpcMasterStore} = ctx;
  let rpcMaster = rpcMasterStore.get(rpcName);
  if (rpcMaster) return Promise.resolve(rpcMaster);
  return Promise.reject();
}

function parseMethodArgs(args) {
  let opts = {};
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

function getTicket(ctx) {
  const {LX, LT, blockRef, throughputValve, ticketDeliveryDelay} = ctx;
  let ticketId = LT.getLogID();
  let ticket;
  if (throughputValve) {
    ticket = new Promise(function(onResolved, onRejected) {
      throughputValve.take(function whenResourceAvailable() {
        LX.has('debug') && LX.log('debug', LT.add({
          ticketId: ticketId,
          waiting: throughputValve.waiting,
          available: throughputValve.available,
          capacity: throughputValve.capacity
        }).toMessage({
          tags: [ blockRef, 'lock-valve' ],
          text: ' - Lock throughput ticket[${ticketId}] - [${waiting}/${available}/${capacity}]'
        }));
        onResolved(ticketId);
      });
    });
  } else {
    ticket = Promise.resolve(ticketId);
  }
  return ticketDeliveryDelay ? ticket.delay(ticketDeliveryDelay) : ticket;
}

function releaseTicket(ctx, ticketId) {
  const {LX, LT, blockRef, throughputValve} = ctx;
  if (throughputValve) {
    throughputValve.release();
    LX.has('debug') && LX.log('debug', LT.add({
      ticketId: ticketId,
      waiting: throughputValve.waiting,
      available: throughputValve.available,
      capacity: throughputValve.capacity
    }).toMessage({
      tags: [ blockRef, 'unlock-valve' ],
      text: ' - Unlock throughput ticket[${ticketId}] - [${waiting}/${available}/${capacity}]'
    }));
  }
}
