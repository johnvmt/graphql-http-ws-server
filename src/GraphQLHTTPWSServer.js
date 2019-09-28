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

        const options = Object.assign({}, passedOptions, {
            port: 80,
            graphQLPath: '/graphql',
            subscriptionsPath: '/graphql',
            listen: true,
            debug: false
        });

        self.expressApp = (options.hasOwnProperty('expressApp')) ? options.expressApp : express();
        self.httpServer = (options.hasOwnProperty('httpServer')) ? options.httpServer : http.createServer(self.expressApp);
        self.wsServer = (options.hasOwnProperty('wsServer')) ? options.wsServer : new WebSocket.Server({ noServer: true });

        self.subscriptionServer = SubscriptionServer.create({
                schema: schema,
                execute,
                subscribe,
            },
            self.wsServer);

        self.apolloServer = new ApolloServer({
            schema: schema,
            introspection: true,
            playground: false
        });

        self.apolloServer.applyMiddleware({
            app: self.expressApp,
            path: options.graphQLPath,
        });

        self.httpServer.on('upgrade', function upgrade(request, socket, head) {
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
}

export default GraphQLHTTPWSServer
