import http from "http";
import url from "url";
import express from "express";
import WebSocket from "ws";
import { execute, subscribe } from "graphql";
import { ApolloServer } from "apollo-server-express";
import { SubscriptionServer } from "subscriptions-transport-ws";

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

        this.expressApp = (options.hasOwnProperty('expressApp')) ? options.expressApp : express();
        this.httpServer = (options.hasOwnProperty('httpServer')) ? options.httpServer : http.createServer(this.expressApp);
        this.wsServer = (options.hasOwnProperty('wsServer')) ? options.wsServer : new WebSocket.Server({ noServer: true });

        this.subscriptionServer = SubscriptionServer.create({
                ...(GraphQLHTTPWSServer.filterObject(options, ['rootValue', 'onOperation', 'onOperationComplete', 'onConnect', 'onDisconnect', 'keepAlive'])),
                schema: schema,
                execute: execute,
                subscribe: subscribe
            },
            this.wsServer);

        this.apolloServer = new ApolloServer({
            schema: schema,
            introspection: true,
            playground: false,
            context: options.context
        });

        this.apolloServer.applyMiddleware({
            app: this.expressApp,
            path: options.graphQLPath,
        });

        this.httpServer.on('upgrade', (request, socket, head) => {
            const pathname = url.parse(request.url).pathname;

            if(pathname === options.subscriptionsPath) {
                this.wsServer.handleUpgrade(request, socket, head, (socket) => {
                    this.wsServer.emit('connection', socket, request);
                });
            }
        });

        if(options.listen) {
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
            if(rawObject.hasOwnProperty(key))
                filteredObject[key] = rawObject[key];
            return filteredObject;
        }, {});
    }
}

export default GraphQLHTTPWSServer
