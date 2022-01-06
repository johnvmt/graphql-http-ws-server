import http from "http";
import url from "url";
import express from "express";
import { WebSocketServer } from "ws";
import { execute, subscribe } from "graphql";
import { ApolloServer } from "apollo-server-express";
import { ApolloServerPluginLandingPageDisabled } from "apollo-server-core";
import { SubscriptionServer } from "subscriptions-transport-ws";


class GraphQLHTTPWSServer {
    constructor(schema, passedOptions = {}) {
        this.options = {
            port: 80,
            graphQLPath: '/graphql',
            subscriptionsPath: '/graphql',
            listen: true,
            debug: false,
            playground: false,
            ...passedOptions
        }

        this.expressApp = (this.options.hasOwnProperty('expressApp')) ? this.options.expressApp : express();
        this.httpServer = (this.options.hasOwnProperty('httpServer')) ? this.options.httpServer : http.createServer(this.expressApp);
        this.wsServer = (this.options.hasOwnProperty('wsServer')) ? this.options.wsServer : new WebSocketServer({ noServer: true });

        this.subscriptionServer = SubscriptionServer.create({
                ...(GraphQLHTTPWSServer.filterObject(this.options, ['rootValue', 'onOperation', 'onOperationComplete', 'onConnect', 'onDisconnect', 'keepAlive'])),
                schema: schema,
                execute: execute,
                subscribe: subscribe
            },
            this.wsServer);

        const apolloServerPlugins = [];

        if(!this.options.playground)
            apolloServerPlugins.push(ApolloServerPluginLandingPageDisabled())

        this.apolloServer = new ApolloServer({
            schema: schema,
            introspection: true,
            context: this.options.context,
            plugins: apolloServerPlugins
        });

        this.apolloServer
            .start()
            .then(() => {
                this.apolloServer.applyMiddleware({
                    app: this.expressApp,
                    path: this.options.graphQLPath,
                });
            });

        this.httpServer.on('upgrade', (request, socket, head) => {
            const pathname = url.parse(request.url).pathname;

            if(pathname === this.options.subscriptionsPath) {
                this.wsServer.handleUpgrade(request, socket, head, (socket) => {
                    this.wsServer.emit('connection', socket, request);
                });
            }
        });

        if(this.options.listen) {
            this.httpServer.listen(this.options.port, () => {
                this._debug(`🚀 GraphQLHTTPServer ready on port ${this.options.port} on path ${this.apolloServer.graphqlPath}`);
                this._debug(`🚀 GraphQLHTTPServer Subscriptions ready on port ${this.options.port} on path ${this.options.subscriptionsPath}`);
            });
        }
    }

    _debug(...args) {
        if(this.options.logger)
            this.options.logger.info(args.join(" "))
        if(this.options.debug)
            console.log(...args);
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
