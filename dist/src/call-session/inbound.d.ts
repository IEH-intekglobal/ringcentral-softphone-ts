import { type InboundMessage } from '../sip-message';
import type Softphone from '../softphone';
import CallSession from '.';
type Protocol = {
    id: number;
    rtpmap: string;
    fmtp?: string;
};
export declare const protocols: Protocol[];
export declare function createSDPAnswer(protocols: Protocol[], client?: string): string;
declare class InboundCallSession extends CallSession {
    constructor(softphone: Softphone, inviteMessage: InboundMessage);
    answer(): Promise<void>;
}
export default InboundCallSession;
