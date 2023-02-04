import { createServer as createHttpServer } from 'http';
import { WebSocketServer } from 'ws';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import gql from 'graphql-tag';
import url from 'node:url';
import { makeExecutableSchema } from '@graphql-tools/schema';

import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';

// graphql-ws
import { useServer as useGraphQLWSServer } from "graphql-ws/lib/use/ws";

// subscriptions-transport-ws
import { execute, subscribe } from "graphql";
import { SubscriptionServer as SubscriptionsTransportWSSubscriptionServer } from "subscriptions-transport-ws";

import filterObject from './utils/filterObject.js';

const createGraphQLHTTPServer = async (options = {}) => {
    const mergedOptions = {
        port: 80,
        graphQLPath: '/graphql',
        subscriptionsPath: '/graphql',
        listen: !options.httpServer && !options.expressApp, // default: listen only when creating server
        ...options
    };

    if(typeof mergedOptions.port !== "number" && !mergedOptions.httpServer && !mergedOptions.expressApp)
        throw new Error('port must be a number');

    if(!('schema' in mergedOptions) && (!('typeDefs' in mergedOptions) || !('resolvers' in mergedOptions)))
        throw new Error('schema or typeDefs/resolvers are required');

    // executable schema for Apollo and WebSocket server
    const schema = mergedOptions.schema ?? makeExecutableSchema({
        typeDefs: typeof mergedOptions.typeDefs === 'object'
            ? mergedOptions.typeDefs
            : gql(mergedOptions.typeDefs),
        resolvers: mergedOptions.resolvers
    });

    const expressApp = 'expressApp' in mergedOptions
        ? mergedOptions.expressApp
        : express();

    const httpServer = ('httpServer' in mergedOptions)
        ? mergedOptions.httpServer
        : createHttpServer(expressApp);

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

            if(wsSubprotocol === 'graphql-transport-ws') { // newer graphql-transport-ws subprotocol, graphql-ws module
                graphQLWSTransportWSServer.handleUpgrade(request, socket, head, (socket) => {
                    graphQLWSTransportWSServer.emit('connection', socket, request);
                });
            }
            else if(wsSubprotocol === 'graphql-ws') { // legacy graphql-ws subprotocol, subscriptions-transport-ws module
                graphQLWSWSServer.handleUpgrade(request, socket, head, (socket) => {
                    graphQLWSWSServer.emit('connection', socket, request);
                });
            }
            else
                throw new Error(`Unknown WS subprotocol`)
        }
    });

    const apolloServerPlugins = [
        // graceful shutdown for HTTP server.
        ApolloServerPluginDrainHttpServer({
            httpServer: httpServer
        }),
        // graceful shutdown for WebSocket server.
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

    if(Array.isArray(mergedOptions.plugins))
        apolloServerPlugins.push(...mergedOptions.plugins);

    // Set up ApolloServer.
    const apolloServer = new ApolloServer({
        schema,
        csrfPrevention: true,
        cache: "bounded",
        plugins: apolloServerPlugins,

    });

    await apolloServer.start();

    expressApp.use(mergedOptions.graphQLPath,
        cors(),
        bodyParser.json(),
        expressMiddleware(apolloServer, {
            context: mergedOptions.httpContext ?? mergedOptions.context
        })
    );

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
