## GraphQL HTTP and WS Server

Note: The server will only intercept WS connections that have the graphQL subscription path

### Options
| Option            	| Description                                       	| Default                  	|
|-------------------	|---------------------------------------------------	|--------------------------	|
| schema            	| Executable schema                                 	| null                     	|
| typeDefs          	| GraphQL type definitions (combine with resolvers) 	| null                     	|
| resolvers         	| GraphQL type definitions (combine with typeDefs)  	| null                     	|
| port              	| Port for HTTP Server to listen on                 	| 80                       	|
| graphQLPath       	| Path under HTTP server for GraphQL                	| /graphql                 	|
| subscriptionsPath 	| Path under WS server for GraphQL                  	| /graphql                 	|
| listen            	| Start HTTP Server                                 	| true                     	|
| logger            	| Pass extrernal logger (eg: Winston)               	| null                     	|
| plugins           	| Apollo plugins                                    	| []                       	|
| expressApp        	| Pass in an express app                            	| null, module will create 	|
| httpServer        	| Pass in an HTTP server                            	| null, module will create 	|
| wsServer          	| pass in a WS server                               	| null, module will create 	|

### Example

    import { makeExecutableSchema } from "@graphql-tools/schema";
    import gql from 'graphql-tag'
    import { EventEmitterAsyncIterator } from 'event-emitter-async-iterator';
    import createGraphQLHTTPServer from "graphql-http-ws-server";

    const typeDefs = gql(`
        type Query {
            hello: String
        }
        type Subscription {
            time: String
        }
    `);

    const resolvers = {
        Query: {
            hello: (obj, args, context) => {
                return 'world';
            }
        },
        Subscription: {
            time: {
                subscribe: (obj, args, context, info) => {
                    const asyncIterator = new EventEmitterAsyncIterator();

                    const sendDate = () => {
                        asyncIterator.pushValue({
                            time: (new Date()).toISOString()
                        });
                    };
    
                    const sendInterval = setInterval(() => {
                        sendDate()
                    }, 1000);
    
    
                    asyncIterator.once('return', () => {
                        clearInterval(sendInterval);
                    });
    
                    sendDate();
    
                    return asyncIterator;
                }
            },
        }
    };

    const schema = makeExecutableSchema({
        typeDefs,
        resolvers,
    });

    createGraphQLHTTPServer({
        schema,
        port: 80,
        playground: true,
        graphqlPath: '/graphql',
        subscriptionsPath: '/graphql',
        onConnect: async (params) => { // WS
            console.log("LEGACY WS CONNECT", params);
            return {connection: "Legacy WS Connect"};
        },
        wsContext: (params) => {
            console.log("WS CONNECT", params.connectionParams)
            return {connection: "New WS Connect"};
        },
        httpContext: async ({req}) => { // HTTP
            console.log("HTTP CONNECT", req.headers);
            return {connection: "HTTP Connect"};
        }
    });