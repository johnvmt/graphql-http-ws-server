## GraphQL HTTP and WS Server

Note: The server will only intercept WS connections that have the graphQL subscription path

### Options

| Option 	        | Description                                           | Default                   |
|----------------	|------------------------------------------------------ |-------------------------- |
| port    	        | Port for HTTP Server to listen on              	    | 80                        |
| graphQLPath       | Path under HTTP server for GraphQL                    | /graphql                  |
| subscriptionsPath | Path under WS server for GraphQL                      | /graphql                  |
| listen        	| Start HTTP Server                                     | true                      |
| debug             | Print log messages                                    | false                     |
| expressApp        | Pass in an [express](https://expressjs.com/) app      | null, module will create  |
| httpServer        | Pass in an HTTP server                                | null, module will create  |
| wsServer          | pass in a WS server                                   | null, module will create  |

### Example

    import { makeExecutableSchema } from 'graphql-tools';
    import gql from 'graphql-tag'
    import EventEmitterAsyncIterator from 'event-emitter-async-iterator';
    import GraphQLHTTPWSServer from "graphql-http-ws-server";
    
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
    
    const server = new GraphQLHTTPWSServer(schema, {
        port: 80,
        graphqlPath: '/graphql',
        subscriptionsPath: '/graphql',
        debug: true
    });