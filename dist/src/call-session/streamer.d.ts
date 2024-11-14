import EventEmitter from 'events';
import type CallSession from '.';
declare class Streamer extends EventEmitter {
    paused: boolean;
    private callSession;
    private buffer;
    private originalBuffer;
    private sequenceNumber;
    private timestamp;
    private ssrc;
    private payloadType;
    constructor(callSesstion: CallSession, buffer: Buffer, payloadType?: number);
    start(): Promise<void>;
    stop(): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    get finished(): boolean;
    private sendPacket;
}
export default Streamer;
