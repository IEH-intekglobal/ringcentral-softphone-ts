import EventEmitter from 'events';
import type dgram from 'dgram';
import { RtpHeader, RtpPacket } from 'werift-rtp';

import { RequestMessage, type InboundMessage } from '../sip-message';
import type Softphone from '../softphone';
import { uuid } from '../utils';
import DTMF from '../dtmf';

abstract class CallSession extends EventEmitter {
  public softphone: Softphone;
  public sipMessage: InboundMessage;
  public socket: dgram.Socket;
  public localPeer: string;
  public remotePeer: string;
  public rtpPort: number;
  private remoteIP: string;
  private remotePort: number;

  public constructor(softphone: Softphone, sipMessage: InboundMessage) {
    super();
    this.softphone = softphone;
    this.sipMessage = sipMessage;
    this.remoteIP = this.sipMessage.body.match(/c=IN IP4 ([\d.]+)/)![1];
    this.remotePort = parseInt(this.sipMessage.body.match(/m=audio (\d+) /)![1], 10);
  }
  public get callId() {
    return this.sipMessage.headers['Call-Id'];
  }
  public send(data: string | Buffer) {
    this.socket.send(data, this.remotePort, this.remoteIP);
  }

  public async hangup() {
    const requestMessage = new RequestMessage(`BYE sip:${this.softphone.sipInfo.domain} SIP/2.0`, {
      'Call-Id': this.callId,
      From: this.localPeer,
      To: this.remotePeer,
      Via: `SIP/2.0/TCP ${this.softphone.fakeDomain};branch=${uuid()}`,
    });
    this.softphone.send(requestMessage);
  }

  public async sendDTMF(char: '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '*' | '#') {
    const timestamp = Math.floor(Date.now() / 1000);
    let sequenceNumber = timestamp % 65536;
    const rtpHeader = new RtpHeader({
      version: 2,
      padding: false,
      paddingSize: 0,
      extension: false,
      marker: false,
      payloadOffset: 12,
      payloadType: 101,
      sequenceNumber,
      timestamp,
      ssrc: this.rtpPort,
      csrcLength: 0,
      csrc: [],
      extensionProfile: 48862,
      extensionLength: undefined,
      extensions: [],
    });
    for (const payload of DTMF.charToPayloads(char)) {
      rtpHeader.sequenceNumber = sequenceNumber++;
      const rtpPacket = new RtpPacket(rtpHeader, payload);
      this.send(rtpPacket.serialize());
    }
  }
}

export default CallSession;