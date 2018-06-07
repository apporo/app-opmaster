'use strict';

const Devebot = require('devebot');
const chores = Devebot.require('chores');
const lodash = Devebot.require('lodash');

function Invoker(params) {
  params = params || {};

  let LX = params.loggingFactory.getLogger();
  let LT = params.loggingFactory.getTracer();
  let packageName = params.packageName || 'private-test';
  let blockRef = chores.getBlockRef(__filename, packageName);

  let pluginCfg = lodash.get(params, 'sandboxConfig', {});
  let commander = params["app-opmaster/commander"];
  
  let lookupMethod = function(serviceName, methodName) {
    let ref = {};
    ref.isRemote = true;
    ref.service = commander.lookupService(serviceName);
    if (ref.service) {
      ref.method = ref.service[methodName];
    }
    return ref;
  }

  this.calc = function(number, actionId) {
    let rpcData = { number: number, actionId: actionId };
    let requestId = LT.getLogID();
    let ref = lookupMethod('application/example', 'fibonacci');
    let refMethod = ref && ref.method;
    if (lodash.isFunction(refMethod)) {
      return refMethod(rpcData, { requestId: requestId, opflowSeal: "on" });
    } else {
      return Promise.reject(ref);
    }
  }
}

Invoker.referenceList = [
  "app-opmaster/commander"
];

module.exports = Invoker;
