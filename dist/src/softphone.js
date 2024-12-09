"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
const events_1 = __importDefault(require("events"));
const tls_1 = __importDefault(require("tls"));
const wait_for_async_1 = __importDefault(require("wait-for-async"));
const inbound_1 = __importStar(require("./call-session/inbound"));
const outbound_1 = __importDefault(require("./call-session/outbound"));
const sip_message_1 = require("./sip-message");
const utils_1 = require("./utils");
const defaultSDPConfig = {
    client: 'rc-softphone-ts',
    protocols: inbound_1.defaultProtocols,
};
class Softphone extends events_1.default {
    constructor(sipInfo, sdpConfig = {}) {
        super();
        this.fakeDomain = (0, utils_1.uuid)() + '.invalid';
        this.fakeEmail = (0, utils_1.uuid)() + '@' + this.fakeDomain;
        this.connected = false;
        this.instanceId = (0, utils_1.uuid)();
        this.registerCallId = (0, utils_1.uuid)();
        this.sdpConfig = Object.assign(Object.assign({}, defaultSDPConfig), sdpConfig);
        this.sipInfo = sipInfo;
        if (this.sipInfo.domain === undefined) {
            this.sipInfo.domain = 'sip.ringcentral.com';
        }
        if (this.sipInfo.outboundProxy === undefined) {
            this.sipInfo.outboundProxy = 'sip10.ringcentral.com:5096';
        }
        const tokens = this.sipInfo.outboundProxy.split(':');
        this.client = tls_1.default.connect({ host: tokens[0], port: parseInt(tokens[1], 10) }, () => {
            this.connected = true;
        });
        let cache = '';
        this.client.on('data', (data) => {
            cache += data.toString('utf-8');
            if (!cache.endsWith('\r\n')) {
                return; // haven't received a complete message yet
            }
            // received two empty body messages
            const tempMessages = cache
                .split('\r\nContent-Length: 0\r\n\r\n')
                .filter((message) => message.trim() !== '');
            cache = '';
            for (let i = 0; i < tempMessages.length; i++) {
                if (!tempMessages[i].includes('Content-Length: ')) {
                    tempMessages[i] = tempMessages[i] + '\r\nContent-Length: 0';
                }
            }
            for (const message of tempMessages) {
                this.emit('message', sip_message_1.InboundMessage.fromString(message));
            }
        });
    }
    register() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.connected) {
                yield (0, wait_for_async_1.default)({ interval: 100, condition: () => this.connected });
            }
            const sipRegister = () => __awaiter(this, void 0, void 0, function* () {
                const fromTag = (0, utils_1.uuid)();
                const requestMessage = new sip_message_1.RequestMessage(`REGISTER sip:${this.sipInfo.domain} SIP/2.0`, {
                    Via: `SIP/2.0/TLS ${this.client.localAddress}:${this.client.localPort};rport;branch=${(0, utils_1.branch)()};alias`,
                    Route: `<sip:${this.sipInfo.outboundProxy};transport=tls;lr>`,
                    'Max-Forwards': '70',
                    From: `<sip:${this.sipInfo.username}@${this.sipInfo.domain}>;tag=${fromTag}`,
                    To: `<sip:${this.sipInfo.username}@${this.sipInfo.domain}>`,
                    'Call-Id': this.registerCallId,
                    Supported: 'outbound, path',
                    Contact: `<sip:${this.sipInfo.username}@${this.client.localAddress}:${this.client.localPort};transport=TLS;ob>;reg-id=1;+sip.instance="<urn:uuid:${this.instanceId}>"`,
                    Expires: 300,
                    Allow: 'PRACK, INVITE, ACK, BYE, CANCEL, UPDATE, INFO, SUBSCRIBE, NOTIFY, REFER, MESSAGE, OPTIONS',
                });
                const inboundMessage = yield this.send(requestMessage, true);
                if (inboundMessage.subject.startsWith('SIP/2.0 200 ')) {
                    // sometimes the server will return 200 OK directly
                    return;
                }
                const wwwAuth = inboundMessage.headers['Www-Authenticate'] ||
                    inboundMessage.headers['WWW-Authenticate'];
                const nonce = wwwAuth.match(/, nonce="(.+?)"/)[1];
                const newMessage = requestMessage.fork();
                newMessage.headers.Authorization = (0, utils_1.generateAuthorization)(this.sipInfo, nonce, 'REGISTER');
                this.send(newMessage);
            });
            sipRegister();
            this.intervalHandle = setInterval(() => {
                sipRegister();
            }, 3 * 60 * 1000);
            this.on('message', (inboundMessage) => {
                if (!inboundMessage.subject.startsWith('INVITE sip:')) {
                    return;
                }
                const outboundMessage = new sip_message_1.OutboundMessage('SIP/2.0 100 Trying', {
                    Via: inboundMessage.headers.Via,
                    'Call-Id': inboundMessage.headers['Call-Id'],
                    From: inboundMessage.headers.From,
                    To: inboundMessage.headers.To,
                    CSeq: inboundMessage.headers.CSeq,
                    'Content-Length': '0',
                });
                this.send(outboundMessage);
                this.emit('invite', inboundMessage);
            });
        });
    }
    enableDebugMode() {
        return __awaiter(this, void 0, void 0, function* () {
            this.on('message', (message) => console.log(`Receiving...(${new Date()})\n` + message.toString()));
            const tlsWrite = this.client.write.bind(this.client);
            this.client.write = (message) => {
                console.log(`Sending...(${new Date()})\n` + message);
                return tlsWrite(message);
            };
        });
    }
    revoke() {
        return __awaiter(this, void 0, void 0, function* () {
            clearInterval(this.intervalHandle);
            this.removeAllListeners();
            this.client.removeAllListeners();
            this.client.destroy();
        });
    }
    send(message, waitForReply = false) {
        this.client.write(message.toString());
        if (!waitForReply) {
            return new Promise((resolve) => {
                resolve(undefined);
            });
        }
        return new Promise((resolve) => {
            const messageListerner = (inboundMessage) => {
                if (inboundMessage.headers.CSeq !== message.headers.CSeq) {
                    return;
                }
                if (inboundMessage.subject.startsWith('SIP/2.0 100 ')) {
                    return; // ignore
                }
                this.off('message', messageListerner);
                resolve(inboundMessage);
            };
            this.on('message', messageListerner);
        });
    }
    answer(inviteMessage) {
        return __awaiter(this, void 0, void 0, function* () {
            const inboundCallSession = new inbound_1.default(this, inviteMessage);
            yield inboundCallSession.answer(this.sdpConfig.protocols, this.sdpConfig.client);
            return inboundCallSession;
        });
    }
    // decline an inbound call
    decline(inviteMessage) {
        return __awaiter(this, void 0, void 0, function* () {
            const newMessage = new sip_message_1.ResponseMessage(inviteMessage, 603);
            this.send(newMessage);
        });
    }
    call(callee) {
        return __awaiter(this, void 0, void 0, function* () {
            const offerSDP = `
v=0
o=- ${Date.now()} 0 IN IP4 ${this.client.localAddress}
s=rc-softphone-ts
c=IN IP4 ${this.client.localAddress}
t=0 0
m=audio ${(0, utils_1.randomInt)()} RTP/SAVP 109 101
a=rtpmap:109 OPUS/16000
a=fmtp:109 useinbandfec=1;usedtx=0
a=rtpmap:101 telephone-event/8000
a=fmtp:101 0-15
a=sendrecv
a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:${utils_1.localKey}
  `.trim();
            const inviteMessage = new sip_message_1.RequestMessage(`INVITE sip:${callee} SIP/2.0`, {
                Via: `SIP/2.0/TLS ${this.client.localAddress}:${this.client.localPort};rport;branch=${(0, utils_1.branch)()};alias`,
                'Max-Forwards': 70,
                From: `<sip:${this.sipInfo.username}@${this.sipInfo.domain}>;tag=${(0, utils_1.uuid)()}`,
                To: `<sip:${callee}@sip.ringcentral.com>`,
                Contact: ` <sip:${this.sipInfo.username}@${this.client.localAddress}:${this.client.localPort};transport=TLS;ob>`,
                'Call-Id': (0, utils_1.uuid)(),
                Route: `<sip:${this.sipInfo.outboundProxy};transport=tls;lr>`,
                Allow: `PRACK, INVITE, ACK, BYE, CANCEL, UPDATE, INFO, SUBSCRIBE, NOTIFY, REFER, MESSAGE, OPTIONS`,
                Supported: `replaces, 100rel, timer, norefersub`,
                'Session-Expires': 1800,
                'Min-SE': 90,
                'Content-Type': 'application/sdp',
            }, offerSDP);
            const inboundMessage = yield this.send(inviteMessage, true);
            const proxyAuthenticate = inboundMessage.headers['Proxy-Authenticate'];
            const nonce = proxyAuthenticate.match(/, nonce="(.+?)"/)[1];
            const newMessage = inviteMessage.fork();
            newMessage.headers['Proxy-Authorization'] = (0, utils_1.generateAuthorization)(this.sipInfo, nonce, 'INVITE');
            const progressMessage = yield this.send(newMessage, true);
            return new outbound_1.default(this, progressMessage);
        });
    }
}
exports.default = Softphone;
//# sourceMappingURL=softphone.js.map