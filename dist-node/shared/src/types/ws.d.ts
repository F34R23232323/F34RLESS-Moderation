export type WsServerMessage = {
    type: 'log';
    payload: unknown;
} | {
    type: 'automod_log';
    payload: unknown;
} | {
    type: 'metric';
    payload: unknown;
} | {
    type: 'hello';
    payload: {
        connected: true;
    };
} | {
    type: 'error';
    payload: {
        message: string;
    };
};
export type WsClientMessage = {
    type: 'subscribe';
    payload: {
        streams: Array<'logs' | 'automod' | 'metrics'>;
    };
} | {
    type: 'ping';
} | {
    type: 'pong';
};
