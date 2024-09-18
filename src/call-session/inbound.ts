import { ResponseMessage, type InboundMessage } from '../sip-message';
import { randomInt } from '../utils';
import type Softphone from '../softphone';
import CallSession from '.';

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
m=audio ${randomInt()} RTP/AVP 109 0 8 9 101 103
a=sendrecv
a=rtpmap:109 OPUS/16000
a=fmtp:109 useinbandfec=1;usedtx=0
a=rtpmap:0 PCMU/8000
a=rtpmap:8 pcma/8000
a=rtpmap:9 g722/8000
a=rtpmap:101 telephone-event/8000
a=fmtp:101 0-15
a=rtpmap:103 telephone-event/16000
a=fmtp:103 0-15
a=rtcp-fb:109 ccm tmmbr
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
