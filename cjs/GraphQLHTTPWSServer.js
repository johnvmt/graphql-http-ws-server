"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _http = _interopRequireDefault(require("http"));

var _url = _interopRequireDefault(require("url"));

var _express = _interopRequireDefault(require("express"));

var _ws = _interopRequireDefault(require("ws"));

var _graphql = require("graphql");

var _apolloServerExpress = require("apollo-server-express");

var _subscriptionsTransportWs = require("subscriptions-transport-ws");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class GraphQLHTTPWSServer {
  constructor(schema, passedOptions = {}) {
    const options = {
      port: 80,
      graphQLPath: '/graphql',
      subscriptionsPath: '/graphql',
      listen: true,
      debug: false,
      ...passedOptions
    };
    this.expressApp = options.hasOwnProperty('expressApp') ? options.expressApp : (0, _express.default)();
    this.httpServer = options.hasOwnProperty('httpServer') ? options.httpServer : _http.default.createServer(this.expressApp);
    this.wsServer = options.hasOwnProperty('wsServer') ? options.wsServer : new _ws.default.Server({
      noServer: true
    });
    this.subscriptionServer = _subscriptionsTransportWs.SubscriptionServer.create({ ...GraphQLHTTPWSServer.filterObject(options, ['rootValue', 'onOperation', 'onOperationComplete', 'onConnect', 'onDisconnect', 'keepAlive']),
      schema: schema,
      execute: _graphql.execute,
      subscribe: _graphql.subscribe
    }, this.wsServer);
    this.apolloServer = new _apolloServerExpress.ApolloServer({
      schema: schema,
      introspection: true,
      playground: false,
      context: options.context
    });
    this.apolloServer.applyMiddleware({
      app: this.expressApp,
      path: options.graphQLPath
    });
    this.httpServer.on('upgrade', (request, socket, head) => {
      const pathname = _url.default.parse(request.url).pathname;

      if (pathname === options.subscriptionsPath) {
        this.wsServer.handleUpgrade(request, socket, head, socket => {
          this.wsServer.emit('connection', socket, request);
        });
      }
    });

    if (options.listen) {
      this.httpServer.listen(options.port, () => {
        this._debug(`🚀 GraphQLHTTPServer ready on port ${options.port} on path ${this.apolloServer.graphqlPath}`);

        this._debug(`🚀 GraphQLHTTPServer Subscriptions ready on port ${options.port} on path ${this.apolloServer.subscriptionsPath}`);
      });
    }
  }

  _debug(...args) {
    console.log.apply(console, args);
  }

  static filterObject(rawObject, filterKeys) {
    return filterKeys.reduce((filteredObject, key) => {
      if (rawObject.hasOwnProperty(key)) filteredObject[key] = rawObject[key];
      return filteredObject;
    }, {});
  }

}

var _default = GraphQLHTTPWSServer;
exports.default = _default;