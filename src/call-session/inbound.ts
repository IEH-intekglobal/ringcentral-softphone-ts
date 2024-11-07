import CallSession from '.';
import { ResponseMessage, type InboundMessage } from '../sip-message';
import type Softphone from '../softphone';
import { randomInt } from '../utils';

class InboundCallSession extends CallSession {
  public constructor(softphone: Softphone, inviteMessage: InboundMessage) {
    super(softphone, inviteMessage);
    this.localPeer = inviteMessage.headers.To;
    this.remotePeer = inviteMessage.headers.From;
  }

  public async answer() {
    const answerSDP = `
v=0
o=- ${randomInt()} 0 IN IP4 127.0.0.1
s=rc-softphone-ts
c=IN IP4 127.0.0.1
t=0 0
m=audio ${randomInt()} RTP/SAVP 0 101
a=rtpmap:0 PCMU/8000
a=rtpmap:101 telephone-event/8000
a=fmtp:101 0-15
a=sendrecv
a=crypto:3 AES_CM_128_HMAC_SHA1_80 inline:4m4EiWWnul+FiUoHrpacZ4qobtce0w89dL4RekY9
`.trim();
    const newMessage = new ResponseMessage(
      this.sipMessage,
      200,
      {
        'Content-Type': 'application/sdp',
      },
      answerSDP,
    );
    this.softphone.send(newMessage);

    this.startLocalServices();
  }
}

export default InboundCallSession;
