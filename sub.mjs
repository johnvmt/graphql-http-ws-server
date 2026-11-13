// Local subscription test client — no browser, no Apollo Sandbox, no outside origin.
// Usage: start the server (node test.js), then in another terminal: node sub.mjs
import { WebSocket } from 'ws';
import { createClient } from 'graphql-ws';

const URL = process.env.GRAPHQL_WS_URL ?? 'ws://localhost:8005/graphql';
const QUERY = process.argv[2] ?? 'subscription { time }';

console.log(`Connecting to ${URL}`);
console.log(`Subscribing: ${QUERY}\n(Ctrl-C to exit)\n`);

const client = createClient({
    url: URL,
    webSocketImpl: WebSocket,
    connectionParams: { source: 'sub.mjs' }
});

client.on('connected', () => console.log('[connected]'));
client.on('error', (error) => console.error('[error]', error));
client.on('closed', () => console.log('[closed]'));

const unsubscribe = client.subscribe(
    { query: QUERY },
    {
        next: (data) => console.log('[next]', JSON.stringify(data)),
        error: (error) => console.error('[subscription error]', error),
        complete: () => console.log('[complete]')
    }
);

const shutdown = async () => {
    unsubscribe();
    await client.dispose();
    process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
