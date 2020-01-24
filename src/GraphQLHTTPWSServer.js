import http from 'http';
import url from 'url';
import express from 'express';
import WebSocket from 'ws';
import { execute, subscribe } from 'graphql';
import { ApolloServer } from 'apollo-server-express';
import { SubscriptionServer } from 'subscriptions-transport-ws';

class GraphQLHTTPWSServer {
    constructor(schema, passedOptions = {}) {
        const self = this;

        const options = Object.assign({
            port: 80,
            graphQLPath: '/graphql',
            subscriptionsPath: '/graphql',
            listen: true,
            debug: false
        }, passedOptions);

        self.expressApp = (options.hasOwnProperty('expressApp')) ? options.expressApp : express();
        self.httpServer = (options.hasOwnProperty('httpServer')) ? options.httpServer : http.createServer(self.expressApp);
        self.wsServer = (options.hasOwnProperty('wsServer')) ? options.wsServer : new WebSocket.Server({ noServer: true });

        self.subscriptionServer = SubscriptionServer.create(Object.assign({},
            GraphQLHTTPWSServer.filterObject(options, ['rootValue', 'onOperation', 'onOperationComplete', 'onConnect', 'onDisconnect', 'keepAlive']),
            {
                schema: schema,
                execute: execute,
                subscribe: subscribe
            }),
            self.wsServer);

        Object.assign({
                introspection: true,
                playground: false
            },
            GraphQLHTTPWSServer.filterObject(options, ['context', 'mocks', 'mockEntireSchema', 'schemaDirectives', 'introspection', 'debug', 'validationRules', 'tracing', 'formatError', 'engine', 'persistedQueries', 'cors']),
            {
                schema: schema
            });

        self.apolloServer = new ApolloServer({
            schema: schema,
            introspection: true,
            playground: false,
            context: options.context
        });

        self.apolloServer.applyMiddleware({
            app: self.expressApp,
            path: options.graphQLPath,
        });

        self.httpServer.on('upgrade', (request, socket, head) => {
            const pathname = url.parse(request.url).pathname;

            if(pathname === options.subscriptionsPath) {
                self.wsServer.handleUpgrade(request, socket, head, (socket) => {
                    self.wsServer.emit('connection', socket, request);
                });
            }
        });

        if(options.listen) {
            self.httpServer.listen(options.port, () => {
                self._debug(`🚀 GraphQLHTTPServer ready on port ${options.port} on path ${self.apolloServer.graphqlPath}`);
                self._debug(`🚀 GraphQLHTTPServer Subscriptions ready on port ${options.port} on path ${self.apolloServer.subscriptionsPath}`);
            });
        }
    }

    _debug() {
        console.log.apply(console, Array.prototype.slice.call(arguments));
    }

    static filterObject(rawObject, filterKeys) {
        return Object.keys(rawObject)
            .filter(key => filterKeys.includes(key))
            .reduce((filteredObject, key) => {
                filteredObject[key] = rawObject[key];
                return filteredObject;
            }, {});
    }
}

export default GraphQLHTTPWSServer
