'use strict';

var devebot = require('devebot');
var lodash = devebot.require('lodash');
var assert = require('chai').assert;
var path = require('path');
var rewire = require('rewire');
var sinon = require('sinon');
var valvekit = require('valvekit');
var dtk = require('../index');

function acquire(modulePath) {
  return rewire(path.join(__dirname, '../../lib/services/' + modulePath));
}

describe('commander', function() {
  describe('init()', function() {
    var Commander = acquire('commander');
    var init = Commander.__get__('init');
    var createService = sinon.stub();
    Commander.__set__('createService', createService);

    var loggingFactory = dtk.createLoggingFactoryMock({ captureMethodCall: false });
    var ctx = {
      LX: loggingFactory.getLogger(),
      LT: loggingFactory.getTracer(),
      blockRef: 'app-opmaster',
    }

    it('createService will not be called if enabled ~ false', function() {
      var services = {};
      var mappings = {
        "service_1": {},
        "service_2": {},
      };
      init(ctx, services, mappings, false);
      assert.equal(createService.callCount, 0);
    });

    it('createService will be called to initialize every service descriptors', function() {
      var services = {};
      var mappings = {
        "service_1": {},
        "service_2": {},
      };
      init(ctx, services, mappings);
      assert.equal(createService.callCount, lodash.keys(mappings).length);
    });
  });

  describe('createService()', function() {
  });

  

  describe('getTicket()/releaseTicket()', function() {
    var loggingFactory = dtk.createLoggingFactoryMock({ captureMethodCall: false });
    var ctx = {
      LX: loggingFactory.getLogger(),
      LT: loggingFactory.getTracer(),
      blockRef: 'app-opmaster',
    }
    var Commander = acquire('commander');
    var getTicket = Commander.__get__('getTicket');

    it('return default ticket if throughputValve is empty', function() {
      var ticket = getTicket(ctx);
      ticket.then(function(ticketId) {
        assert.isNotNull(ticketId);
        assert.equal(ticketId.length, 22);
      });
    });
  })
});
