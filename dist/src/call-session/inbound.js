"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultProtocols = void 0;
exports.createSDPAnswer = createSDPAnswer;
const _1 = __importDefault(require("."));
const sip_message_1 = require("../sip-message");
const utils_1 = require("../utils");
exports.defaultProtocols = [
    { id: 0, rtpmap: 'pcmu/8000' },
    { id: 9, rtpmap: 'g722/8000' },
    // { id: 8, rtpmap: 'pcma/8000' },
    { id: 101, rtpmap: 'telephone-event/8000', fmtp: '0-15' },
    // { id: 103, rtpmap: 'telephone-event/16000', fmtp: '0-15' },
    // { id: 109, rtpmap: 'OPUS/16000', fmtp: 'useinbandfec=1;usedtx=0' },
];
function createSDPAnswer(protocols = exports.defaultProtocols, client = 'rc-ssoftphone-ts') {
    const protocolIDs = protocols.map(p => p.id).join(' ');
    const attributes = protocols.map(p => `a=rtpmap:${p.id} ${p.rtpmap}` + (p.fmtp ? `\na=fmtp:${p.id} ${p.fmtp}` : '')).join('\n');
    return `
v=0
o=- ${Date.now()} 0 IN IP4 ${this.softphone.client.localAddress}
s=${client}
c=IN IP4 ${this.softphone.client.localAddress}
t=0 0
m=audio ${(0, utils_1.randomInt)()} RTP/AVP ${protocolIDs}
a=sendrecv
${attributes}
a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:${utils_1.localKey}
`.trim();
}
class InboundCallSession extends _1.default {
    constructor(softphone, inviteMessage) {
        super(softphone, inviteMessage);
        this.localPeer = inviteMessage.headers.To;
        this.remotePeer = inviteMessage.headers.From;
        this.To = (0, utils_1.extractPhoneNumber)(this.localPeer);
        this.From = (0, utils_1.extractPhoneNumber)(this.remotePeer);
        this.remoteKey = inviteMessage.body.match(/AES_CM_128_HMAC_SHA1_80 inline:([\w+/]+)/)[1];
    }
    answer(protocols, client) {
        return __awaiter(this, void 0, void 0, function* () {
            const answerSDP = createSDPAnswer(protocols, client);
            const newMessage = new sip_message_1.OutboundMessage('SIP/2.0 200 OK', {
                Via: this.sipMessage.headers.Via,
                'Call-ID': this.sipMessage.headers['Call-ID'],
                From: this.sipMessage.headers.From,
                To: this.sipMessage.headers.To,
                CSeq: this.sipMessage.headers.CSeq,
                Contact: `<sip:${this.softphone.sipInfo.username}@${this.softphone.client.localAddress}:${this.softphone.client.localPort};transport=TLS;ob>`,
                Allow: 'PRACK, INVITE, ACK, BYE, CANCEL, UPDATE, INFO, SUBSCRIBE, NOTIFY, REFER, MESSAGE, OPTIONS',
                Supported: 'replaces, 100rel, timer, norefersub',
                'Session-Expires': '14400;refresher=uac',
                Require: 'timer',
                'Content-Type': 'application/sdp',
            }, answerSDP);
            this.softphone.send(newMessage);
            this.startLocalServices();
        });
    }
}
exports.default = InboundCallSession;
//# sourceMappingURL=inbound.js.map