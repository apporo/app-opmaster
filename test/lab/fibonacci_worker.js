'use strict';

var lodash = require('lodash');
var opflow = require('opflow');
var debugx = require('debug')('fibonacci:rpc:worker');
var Fibonacci = require('../app/lib/utils/fibonacci');

var FibonacciRpcWorker = function(params, configurer) {
	var rpcWorker = new opflow.RpcWorker(params);
	var self = this;

	this.ready = rpcWorker.ready.bind(rpcWorker);

	this.process = function() {
		return rpcWorker.process('fibonacci', function(body, headers, response) {
			var requestId = headers.requestId;

			debugx.enabled && debugx('Request[%s] is a "%s", with body: %s', requestId, 
				headers.routineId, body);
			response.emitStarted();
			
			body = JSON.parse(body);
			if (lodash.isArray(body)) body = body[0];

			debugx.enabled && debugx('Request[%s] - numberMax: %s', requestId, self.getNumberMax());
			if (self.isSettingAvailable() && self.getNumberMax() < body.number) {
				response.emitFailed({
					message: 'Number exceeding limit',
					numberMax: self.getNumberMax()
				});
				return;
			}

			var fibonacci = new Fibonacci(body);
			// while(fibonacci.next()) {
			// 	var r = fibonacci.result();
			// 	debugx.enabled && debugx('Request[%s] step[%s]', requestId, r.step);
			// 	response.emitProgress(r.step, r.number);
			// };

			// debugx.enabled && debugx('Request[%s] has been finished: %s', requestId,
			// 	JSON.stringify(fibonacci.result()));
			
			var result = fibonacci.finish();
			result.actionId = body.actionId;

			response.emitCompleted(result);
		})
	}

	this.isSettingAvailable = function() {
		return lodash.isNumber(this.getNumberMax());
	}

	this.getNumberMax = function() {
		return 51;
	}

	this.close = rpcWorker.close.bind(rpcWorker);
}

module.exports = FibonacciRpcWorker;

if (require.main === module) {
	console.log('[+] FibonacciRpcWorker example');

	var worker = new FibonacciRpcWorker({
		uri: process.env.DEVEBOT_OPFLOW_URI || process.env.OPFLOW_TEST_URI || 'amqp://localhost',
		exchangeName: 'app-opflow4x-example',
		routingKey: 'app-opflow4x-fibonacci',
		responseName: 'app-opflow4x-response',
		operatorName: 'app-opflow4x-operator',
		applicationId: 'FibonacciExample'
	});

	worker.ready().then(worker.process);
}
