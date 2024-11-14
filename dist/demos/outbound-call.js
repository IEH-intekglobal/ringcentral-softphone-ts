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
const node_fs_1 = __importDefault(require("node:fs"));
const softphone_1 = __importDefault(require("../src/softphone"));
const softphone = new softphone_1.default({
    outboundProxy: process.env.SIP_INFO_OUTBOUND_PROXY,
    username: process.env.SIP_INFO_USERNAME,
    password: process.env.SIP_INFO_PASSWORD,
    authorizationId: process.env.SIP_INFO_AUTHORIZATION_ID,
    domain: process.env.SIP_INFO_DOMAIN,
});
softphone.enableDebugMode(); // print all SIP messages
const main = () => __awaiter(void 0, void 0, void 0, function* () {
    yield softphone.register();
    // await waitFor({ interval: 1000 });
    // callee format sample: 16506668888, country code is required, otherwise behavior is undefined
    const callSession = yield softphone.call(parseInt(process.env.CALLEE_FOR_TESTING, 10));
    callSession.on('busy', () => {
        console.log('cannot reach the callee');
    });
    // callee answers the call
    callSession.once('answered', () => __awaiter(void 0, void 0, void 0, function* () {
        // receive audio
        const writeStream = node_fs_1.default.createWriteStream(`${callSession.callId}.wav`, {
            flags: 'a',
        });
        callSession.on('audioPacket', (rtpPacket) => {
            writeStream.write(rtpPacket.payload);
        });
        // either you or the peer hang up
        callSession.once('disposed', () => {
            writeStream.close();
        });
        // call transfer
        // await waitFor({ interval: 3000 });
        // callSession.transfer(parseInt(process.env.ANOTHER_CALLEE_FOR_TESTING!, 10));
        // // send audio to remote peer
        // const streamer = callSession.streamAudio(fs.readFileSync('demos/test.wav'));
        // // You may subscribe to the 'finished' event of the streamer to know when the audio sending is finished
        // streamer.once('finished', () => {
        //   console.log('audio sending finished');
        // });
        // // you may pause/resume/stop audio sending at any time
        // await waitFor({ interval: 3000 });
        // streamer.pause();
        // await waitFor({ interval: 3000 });
        // streamer.resume();
        // await waitFor({ interval: 2000 });
        // streamer.stop();
        // receive DTMF
        callSession.on('dtmf', (digit) => {
            console.log('dtmf', digit);
        });
        // // send DTMF
        // await waitFor({ interval: 2000 });
        // callSession.sendDTMF('1');
        // await waitFor({ interval: 2000 });
        // callSession.sendDTMF('#');
        // // hang up the call
        // await waitFor({ interval: 5000 });
        // callSession.hangup();
    }));
    // // cancel the call (before the peer answers)
    // await waitFor({ interval: 8000 });
    // callSession.cancel();
});
main();
//# sourceMappingURL=outbound-call.js.map