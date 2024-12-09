import EventEmitter from 'events';
import { TLSSocket } from 'tls';
import type SipInfoResponse from '@rc-ex/core/lib/definitions/SipInfoResponse';
import InboundCallSession, { Protocol } from './call-session/inbound';
import OutboundCallSession from './call-session/outbound';
import { InboundMessage, OutboundMessage } from './sip-message';
type SDPConfig = {
    protocols: Protocol[];
    client: string;
};
declare class Softphone extends EventEmitter {
    sipInfo: SipInfoResponse;
    sdpConfig: SDPConfig;
    client: TLSSocket;
    fakeDomain: string;
    fakeEmail: string;
    private intervalHandle;
    private connected;
    constructor(sipInfo: SipInfoResponse, sdpConfig?: Partial<SDPConfig>);
    private instanceId;
    private registerCallId;
    register(): Promise<void>;
    enableDebugMode(): Promise<void>;
    revoke(): Promise<void>;
    send(message: OutboundMessage, waitForReply?: boolean): Promise<InboundMessage>;
    answer(inviteMessage: InboundMessage): Promise<InboundCallSession>;
    decline(inviteMessage: InboundMessage): Promise<void>;
    call(callee: number): Promise<OutboundCallSession>;
}
export default Softphone;
