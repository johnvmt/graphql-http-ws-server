import http from "http";
import url from "url";
import express from "express";
import { WebSocketServer } from "ws";
import { ApolloServer } from "apollo-server-express";
import { ApolloServerPluginDrainHttpServer, ApolloServerPluginLandingPageDisabled } from "apollo-server-core";

// graphql-ws
import { useServer as useGraphQLWSServer } from "graphql-ws/lib/use/ws";

// subscriptions-transport-ws
import { execute, subscribe } from "graphql";
import { SubscriptionServer as SubscriptionsTransportWSSubscriptionServer } from "subscriptions-transport-ws";
import filterObject from "./utils/filterObject.js";

const createGraphQLHTTPServer = (schema, options = {}) => {
    const mergedOptions = {
        port: 80,
        graphQLPath: '/graphql',
        subscriptionsPath: '/graphql',
        listen: true,
        playground: false,
        ...options
    };

    const expressApp = 'expressApp' in mergedOptions
        ? mergedOptions.expressApp
        : express();

    const httpServer = ('httpServer' in mergedOptions)
        ? mergedOptions.httpServer
        : http.createServer(expressApp);

    // graphql-transport-ws subprotocol (graphql-ws module)
    const graphQLWSTransportWSServer = new WebSocketServer({ noServer: true });

    const graphQLTransportWSServerCleanup = useGraphQLWSServer(
        {
            schema,
            // Adding a context property lets you add data to your GraphQL operation context
            context: mergedOptions.wsContext
        },
        graphQLWSTransportWSServer,
    );

    // graphql-ws subprotocol (subscriptions-transport-ws module)
    const graphQLWSWSServer = new WebSocketServer({ noServer: true });

    SubscriptionsTransportWSSubscriptionServer.create({
        // allowed options
        ...filterObject(mergedOptions, ['rootValue', 'onOperation', 'onOperationComplete', 'onConnect', 'onDisconnect', 'keepAlive']),
        schema: schema,
        execute: execute,
        subscribe: subscribe
    },
    graphQLWSWSServer);

    httpServer.on('upgrade', (request, socket, head) => {
        const pathname = url.parse(request.url).pathname;

        if(pathname === mergedOptions.subscriptionsPath) {
            const wsSubprotocol = request.headers['sec-websocket-protocol']
                ? request.headers['sec-websocket-protocol']
                : 'graphql-ws';

            if(wsSubprotocol === 'graphql-transport-ws') {
                graphQLWSTransportWSServer.handleUpgrade(request, socket, head, (socket) => {
                    graphQLWSTransportWSServer.emit('connection', socket, request);
                });
            }
            else if(wsSubprotocol === 'graphql-ws') {
                graphQLWSWSServer.handleUpgrade(request, socket, head, (socket) => {
                    graphQLWSWSServer.emit('connection', socket, request);
                });
            }
            else
                throw new Error(`Unknown WS subprotocol`)
        }
    });

    const apolloServerPlugins = [
        // graceful shutdown for the HTTP server.
        ApolloServerPluginDrainHttpServer({
            httpServer: httpServer
        }),

        // graceful shutdown for the WebSocket server.
        {
            async serverWillStart() {
                return {
                    async drainServer() {
                        await graphQLTransportWSServerCleanup.dispose();
                    },
                };
            },
        },
    ];

    if(!mergedOptions.playground)
        apolloServerPlugins.push(ApolloServerPluginLandingPageDisabled());

    const apolloServer = new ApolloServer({
        schema,
        csrfPrevention: true,
        cache: "bounded",
        plugins: apolloServerPlugins,
        context: mergedOptions.httpContext ?? mergedOptions.context,
    });

    apolloServer
        .start()
        .then(() => {
            apolloServer.applyMiddleware({
                app: expressApp,
                path: mergedOptions.graphQLPath,
            });
        });

    if(mergedOptions.listen) {
        httpServer.listen(mergedOptions.port, () => {
            if(mergedOptions.logger) {
                mergedOptions.logger.info(`GraphQLHTTPServer ready on port ${mergedOptions.port} on path ${mergedOptions.graphQLPath}`);
                mergedOptions.logger.info(`GraphQLHTTPServer Subscriptions ready on port ${mergedOptions.port} on path ${mergedOptions.subscriptionsPath}`);
            }
        });
    }
}

export default createGraphQLHTTPServer;
