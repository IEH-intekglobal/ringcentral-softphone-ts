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
const events_1 = __importDefault(require("events"));
const werift_rtp_1 = require("werift-rtp");
// import { opus } from '../codec';
const utils_1 = require("../utils");
class Streamer extends events_1.default {
    constructor(callSesstion, buffer, payloadType = 0) {
        super();
        this.paused = false;
        this.sequenceNumber = (0, utils_1.randomInt)();
        this.timestamp = (0, utils_1.randomInt)();
        this.ssrc = (0, utils_1.randomInt)();
        this.callSession = callSesstion;
        this.buffer = buffer;
        this.originalBuffer = buffer;
        this.payloadType = payloadType;
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            this.buffer = this.originalBuffer;
            this.paused = false;
            this.sendPacket();
        });
    }
    stop() {
        return __awaiter(this, void 0, void 0, function* () {
            this.buffer = Buffer.alloc(0);
        });
    }
    pause() {
        return __awaiter(this, void 0, void 0, function* () {
            this.paused = true;
        });
    }
    resume() {
        return __awaiter(this, void 0, void 0, function* () {
            this.paused = false;
            this.sendPacket();
        });
    }
    get finished() {
        // return this.buffer.length < 640;
        return this.buffer.length < 160;
    }
    sendPacket() {
        if (!this.callSession.disposed && !this.paused && !this.finished) {
            //       const temp = opus.encode(this.buffer.subarray(0, 640));
            const temp = this.buffer.subarray(0, 160);
            this.buffer = this.buffer.subarray(160);
            const rtpPacket = new werift_rtp_1.RtpPacket(new werift_rtp_1.RtpHeader({
                version: 2,
                padding: false,
                paddingSize: 0,
                extension: false,
                marker: false,
                payloadOffset: 12,
                payloadType: this.payloadType,
                sequenceNumber: this.sequenceNumber,
                timestamp: this.timestamp,
                ssrc: this.ssrc,
                csrcLength: 0,
                csrc: [],
                extensionProfile: 48862,
                extensionLength: undefined,
                extensions: [],
            }), temp);
            this.callSession.send(this.callSession.srtpSession.encrypt(rtpPacket.payload, rtpPacket.header));
            this.sequenceNumber += 1;
            if (this.sequenceNumber > 65535) {
                this.sequenceNumber = 0;
            }
            //       this.timestamp += 320;
            this.timestamp += 160;
            //       this.buffer = this.buffer.subarray(640);
            if (this.finished) {
                this.emit('finished');
            }
            else {
                setTimeout(() => this.sendPacket(), 20);
            }
        }
    }
}
exports.default = Streamer;
//# sourceMappingURL=streamer.js.map