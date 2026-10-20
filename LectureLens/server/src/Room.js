const { createRouter } = require('./mediasoupWorker');
const config = require('./config');

/**
 * Room — represents a single video call session.
 *
 * Holds:
 *   - mediasoup Router (one per room)
 *   - peers: Map<socketId, Peer>
 *
 * Each Peer holds:
 *   - role: 'host' | 'participant'
 *   - user: { id, name, role }
 *   - transports: Map<transportId, Transport>
 *   - producers: Map<producerId, Producer>
 *   - consumers: Map<consumerId, Consumer>
 */
class Room {
  constructor(roomId) {
    this.id = roomId;
    this.router = null;
    this.peers = new Map(); // socketId → Peer
    this.lectureId = null;
  }

  async init() {
    this.router = await createRouter();
    return this;
  }

  // ─── Peer management ──────────────────────────────────────────────────────

  addPeer(socketId, role, user = null) {
    const peer = {
      id: socketId,
      role, // 'host' | 'participant'
      user: user || { id: socketId, name: role === 'host' ? 'Teacher' : 'Student', role: role === 'host' ? 'TEACHER' : 'STUDENT' },
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
    };
    this.peers.set(socketId, peer);
    console.log(`[Room ${this.id}] Peer added: ${socketId} (${role}) - ${peer.user.name}`);
    return peer;
  }

  getPeer(socketId) {
    return this.peers.get(socketId);
  }

  removePeer(socketId) {
    const peer = this.peers.get(socketId);
    if (!peer) return;

    // Clean up mediasoup resources
    for (const transport of peer.transports.values()) {
      transport.close();
    }
    this.peers.delete(socketId);
    console.log(`[Room ${this.id}] Peer removed: ${socketId}`);
  }

  getHost() {
    for (const peer of this.peers.values()) {
      if (peer.role === 'host') return peer;
    }
    return null;
  }

  // ─── Transport ────────────────────────────────────────────────────────────

  async createWebRtcTransport(socketId) {
    const transport = await this.router.createWebRtcTransport({
      listenIps: config.webRtcTransport.listenIps,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate: config.webRtcTransport.initialAvailableOutgoingBitrate,
    });

    transport.on('icestatechange', (state) => {
      console.log(`[Transport ${transport.id}] ICE state → ${state}`);
    });
    transport.on('dtlsstatechange', (state) => {
      if (state === 'failed' || state === 'closed') {
        console.warn(`[Transport ${transport.id}] DTLS state → ${state}`);
      }
    });

    const peer = this.peers.get(socketId);
    if (peer) peer.transports.set(transport.id, transport);

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
    };
  }

  // ─── Connect transport (DTLS handshake) ──────────────────────────────────

  async connectTransport(socketId, transportId, dtlsParameters) {
    const peer = this.peers.get(socketId);
    if (!peer) throw new Error(`Peer not found: ${socketId}`);

    const transport = peer.transports.get(transportId);
    if (!transport) throw new Error(`Transport not found: ${transportId}`);

    await transport.connect({ dtlsParameters });
    console.log(`[Transport ${transportId}] DTLS connected`);
  }

  // ─── Produce (camera, mic, or screen) ─────────────────────────────────────

  async produce(socketId, transportId, kind, rtpParameters, appData = {}) {
    const peer = this.peers.get(socketId);
    if (!peer) throw new Error(`Peer not found: ${socketId}`);

    const transport = peer.transports.get(transportId);
    if (!transport) throw new Error(`Transport not found: ${transportId}`);

    const producer = await transport.produce({ kind, rtpParameters, appData });

    peer.producers.set(producer.id, producer);

    producer.on('transportclose', () => {
      console.log(`[Producer ${producer.id}] Transport closed`);
      peer.producers.delete(producer.id);
    });

    console.log(`[Producer ${producer.id}] Created (kind: ${kind}, type: ${appData.type || kind})`);
    return producer.id;
  }

  // ─── Close Producer (e.g. stop screen share) ─────────────────────────────

  closeProducer(socketId, producerId) {
    const peer = this.peers.get(socketId);
    if (!peer) return false;

    const producer = peer.producers.get(producerId);
    if (!producer) return false;

    producer.close();
    peer.producers.delete(producerId);
    console.log(`[Producer ${producerId}] Manually closed by ${socketId}`);
    return true;
  }

  // ─── Consume ──────────────────────────────────────────────────────────────

  async consume(socketId, producerId, rtpCapabilities) {
    if (!this.router.canConsume({ producerId, rtpCapabilities })) {
      throw new Error(`Cannot consume producer ${producerId} — RTP capabilities mismatch`);
    }

    const peer = this.peers.get(socketId);
    if (!peer) throw new Error(`Peer not found: ${socketId}`);

    const recvTransport = [...peer.transports.values()].find(
      (t) => t.appData?.direction === 'recv'
    );
    if (!recvTransport) throw new Error(`No recv transport found for peer ${socketId}`);

    // Look up producer across all peers to forward its appData
    let sourceProducer = null;
    for (const p of this.peers.values()) {
      if (p.producers.has(producerId)) {
        sourceProducer = p.producers.get(producerId);
        break;
      }
    }

    const consumer = await recvTransport.consume({
      producerId,
      rtpCapabilities,
      paused: true,
      appData: sourceProducer?.appData || {},
    });

    peer.consumers.set(consumer.id, consumer);

    consumer.on('transportclose', () => {
      console.log(`[Consumer ${consumer.id}] Transport closed`);
      peer.consumers.delete(consumer.id);
    });

    console.log(`[Consumer ${consumer.id}] Created for producer ${producerId} (${consumer.kind})`);

    return {
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      appData: sourceProducer?.appData || {},
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  getProducerList(excludeSocketId) {
    const producers = [];
    for (const [socketId, peer] of this.peers) {
      if (socketId === excludeSocketId) continue;
      for (const [producerId, producer] of peer.producers) {
        producers.push({
          producerId,
          kind: producer.kind,
          type: producer.appData?.type || (producer.kind === 'video' ? 'camera' : 'microphone'),
          peerId: socketId,
          userName: peer.user?.name || (peer.role === 'host' ? 'Teacher' : 'Student'),
          userRole: peer.user?.role || (peer.role === 'host' ? 'TEACHER' : 'STUDENT'),
        });
      }
    }
    return producers;
  }

  get rtpCapabilities() {
    return this.router.rtpCapabilities;
  }

  isEmpty() {
    return this.peers.size === 0;
  }
}

module.exports = Room;
