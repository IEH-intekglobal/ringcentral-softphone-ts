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
const dgram_1 = __importDefault(require("dgram"));
const events_1 = __importDefault(require("events"));
const werift_rtp_1 = require("werift-rtp");
// import { opus } from '../codec';
const dtmf_1 = __importDefault(require("../dtmf"));
const sip_message_1 = require("../sip-message");
const utils_1 = require("../utils");
const streamer_1 = __importDefault(require("./streamer"));
class CallSession extends events_1.default {
    constructor(softphone, sipMessage) {
        super();
        this.disposed = false;
        this.softphone = softphone;
        this.sipMessage = sipMessage;
        this.remoteIP = this.sipMessage.body.match(/c=IN IP4 ([\d.]+)/)[1];
        this.remotePort = parseInt(this.sipMessage.body.match(/m=audio (\d+) /)[1], 10);
    }
    set remoteKey(key) {
        const localKeyBuffer = Buffer.from(utils_1.localKey, 'base64');
        const remoteKeyBuffer = Buffer.from(key, 'base64');
        this.srtpSession = new werift_rtp_1.SrtpSession({
            profile: 0x0001,
            keys: {
                localMasterKey: localKeyBuffer.subarray(0, 16),
                localMasterSalt: localKeyBuffer.subarray(16, 30),
                remoteMasterKey: remoteKeyBuffer.subarray(0, 16),
                remoteMasterSalt: remoteKeyBuffer.subarray(16, 30),
            },
        });
    }
    get callId() {
        return this.sipMessage.headers['Call-ID'];
    }
    send(data) {
        this.socket.send(data, this.remotePort, this.remoteIP);
    }
    hangup() {
        return __awaiter(this, void 0, void 0, function* () {
            const requestMessage = new sip_message_1.RequestMessage(`BYE sip:${this.softphone.sipInfo.domain} SIP/2.0`, {
                'Call-ID': this.callId,
                From: this.localPeer,
                To: this.remotePeer,
                Via: `SIP/2.0/TLS ${this.softphone.fakeDomain};branch=${(0, utils_1.branch)()}`,
            });
            this.softphone.send(requestMessage);
        });
    }
    sendDTMF(char) {
        return __awaiter(this, void 0, void 0, function* () {
            const timestamp = Math.floor(Date.now() / 1000);
            let sequenceNumber = timestamp % 65536;
            const rtpHeader = new werift_rtp_1.RtpHeader({
                version: 2,
                padding: false,
                paddingSize: 0,
                extension: false,
                marker: false,
                payloadOffset: 12,
                payloadType: 101,
                sequenceNumber,
                timestamp,
                ssrc: (0, utils_1.randomInt)(),
                csrcLength: 0,
                csrc: [],
                extensionProfile: 48862,
                extensionLength: undefined,
                extensions: [],
            });
            for (const payload of dtmf_1.default.charToPayloads(char)) {
                rtpHeader.sequenceNumber = sequenceNumber++;
                const rtpPacket = new werift_rtp_1.RtpPacket(rtpHeader, payload);
                this.send(this.srtpSession.encrypt(rtpPacket.payload, rtpPacket.header));
            }
        });
    }
    // buffer is the content of a audio file, it is supposed to be PCMU/8000 encoded.
    // The audio should be playable by command: ffplay -autoexit -f mulaw -ar 8000 test.raw
    streamAudio(input, payloadType = 0) {
        const streamer = new streamer_1.default(this, input, payloadType);
        streamer.start();
        return streamer;
    }
    startLocalServices() {
        return __awaiter(this, void 0, void 0, function* () {
            this.socket = dgram_1.default.createSocket('udp4');
            this.socket.on('message', (message) => {
                const rtpPacket = werift_rtp_1.RtpPacket.deSerialize(this.srtpSession.decrypt(message));
                this.emit('rtpPacket', rtpPacket);
                if (rtpPacket.header.payloadType === 101) {
                    this.emit('dtmfPacket', rtpPacket);
                    const char = dtmf_1.default.payloadToChar(rtpPacket.payload);
                    if (char) {
                        this.emit('dtmf', char);
                    }
                }
                else {
                    try {
                        // rtpPacket.payload = opus.decode(rtpPacket.payload);
                        this.emit('audioPacket', rtpPacket);
                    }
                    catch (_a) {
                        console.error('opus decode failed');
                    }
                }
            });
            // as I tested, we can use a random port here and it still works
            // but it seems that in SDP we need to tell remote our local IP Address, not 127.0.0.1
            this.socket.bind(); // random port
            // send a message to remote server so that it knows where to reply
            this.send('hello');
            const byeHandler = (inboundMessage) => {
                if (inboundMessage.headers['Call-ID'] !== this.callId) {
                    return;
                }
                if (inboundMessage.headers.CSeq.endsWith(' BYE')) {
                    this.softphone.off('message', byeHandler);
                    this.dispose();
                }
            };
            this.softphone.on('message', byeHandler);
        });
    }
    dispose() {
        var _a, _b;
        this.disposed = true;
        this.emit('disposed');
        this.removeAllListeners();
        (_a = this.socket) === null || _a === void 0 ? void 0 : _a.removeAllListeners();
        (_b = this.socket) === null || _b === void 0 ? void 0 : _b.close();
    }
    transfer(transferTo) {
        const requestMessage = new sip_message_1.RequestMessage(`REFER sip:${this.softphone.sipInfo.username}@${this.softphone.sipInfo.outboundProxy};transport=tls SIP/2.0`, {
            Via: `SIP/2.0/TLS ${this.softphone.client.localAddress}:${this.softphone.client.localPort};rport;branch=${(0, utils_1.branch)()};alias`,
            'Max-Forwards': 70,
            From: this.localPeer,
            To: this.remotePeer,
            Contact: `<sip:${this.softphone.sipInfo.username}@${this.softphone.client.localAddress}:${this.softphone.client.localPort};transport=TLS;ob>`,
            'Call-ID': this.callId,
            Event: 'refer',
            Expires: 600,
            Supported: 'replaces, 100rel, timer, norefersub',
            Accept: 'message/sipfrag;version=2.0',
            'Allow-Events': 'presence, message-summary, refer',
            'Refer-To': `sip:${transferTo}@${this.softphone.sipInfo.domain}`,
            'Referred-By': `<sip:${this.softphone.sipInfo.username}@${this.softphone.sipInfo.domain}>`,
        });
        this.softphone.send(requestMessage);
        // reply to those NOTIFY messages
        const notifyHandler = (inboundMessage) => {
            if (!inboundMessage.subject.startsWith('NOTIFY ')) {
                return;
            }
            const responseMessage = new sip_message_1.ResponseMessage(inboundMessage, 200);
            this.softphone.send(responseMessage);
            if (inboundMessage.body.trim() === 'SIP/2.0 200 OK') {
                this.softphone.off('message', notifyHandler);
            }
        };
        this.softphone.on('message', notifyHandler);
    }
}
exports.default = CallSession;
//# sourceMappingURL=index.js.map