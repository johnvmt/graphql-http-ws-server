## GraphQL HTTP and WS Server

Note: The server will only intercept WS connections that have the graphQL subscription path

### Options

| Option 	        | Description                                                                   | Default                   |
|----------------	|-------------------------------------------------------------------------------|-------------------------- |
| port    	        | Port for HTTP Server to listen on              	                            | 80                        |
| graphQLPath       | Path under HTTP server for GraphQL                                            | /graphql                  |
| subscriptionsPath | Path under WS server for GraphQL                                              | /graphql                  |
| listen        	| Start HTTP Server                                                             | true                      |
| logger            | Pass extrernal logger (eg: [Winston](https://github.com/winstonjs/winston))   | null                      |
| playground        | Enable Playground                                                             | false                     |
| expressApp        | Pass in an [express](https://expressjs.com/) app                              | null, module will create  |
| httpServer        | Pass in an HTTP server                                                        | null, module will create  |
| wsServer          | pass in a WS server                                                           | null, module will create  |

### Example

    import { makeExecutableSchema } from "@graphql-tools/schema";
    import gql from 'graphql-tag'
    import EventEmitterAsyncIterator from 'event-emitter-async-iterator';
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
    
    createGraphQLHTTPServer(schema, {
        port: 80,
        graphqlPath: '/graphql',
        subscriptionsPath: '/graphql',
        onConnect: async (connectionParams) => { // legacy graphql-ws subprotocol (subscriptions-transport-ws module)
            console.log("LEGACY WS CONNECT", req.headers);
            return {};
        },
        wsContext: (params, msg, args) => { // new graphql-transport-ws subprotocol (graphql-ws module)
            console.log("NEW WS CONNECT", req.headers);
            return {};
        },
        httpContext: async ({req}) => { // HTTP
            console.log("HTTP CONNECT", req.headers);
            return {headers: req.headers};
        }
    });