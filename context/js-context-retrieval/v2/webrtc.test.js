/**
 * WebRTC Video Conferencing Application
 * A complete peer-to-peer video calling system with signaling
 */

const EventEmitter = require('events');

// ============== CONFIGURATION ==============
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { 
    urls: 'turn:turn.example.com:3478',
    username: 'user',
    credential: 'pass123'  // BUG: Hardcoded credentials
  }
];

const MEDIA_CONSTRAINTS = {
  video: { width: 1280, height: 720, facingMode: 'user' },
  audio: { echoCancellation: true, noiseSuppression: true }
};

// ============== SIGNALING SERVER ==============
class SignalingChannel extends EventEmitter {
  constructor(serverUrl) {
    super();
    this.serverUrl = serverUrl;
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  // Establish WebSocket connection to signaling server
  connect() {
    this.socket = new WebSocket(this.serverUrl);
    
    this.socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.emit('connected');
    };

    this.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleSignalingMessage(message);
    };

    // BUG: No exponential backoff for reconnection
    this.socket.onclose = () => {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), 1000);
      }
    };

    this.socket.onerror = (error) => {
      this.emit('error', error);
    };
  }

  // Handle incoming signaling messages
  handleSignalingMessage(message) {
    switch (message.type) {
      case 'offer':
        this.emit('offer', message.payload, message.from);
        break;
      case 'answer':
        this.emit('answer', message.payload, message.from);
        break;
      case 'ice-candidate':
        this.emit('ice-candidate', message.payload, message.from);
        break;
      case 'user-joined':
        this.emit('user-joined', message.userId);
        break;
      case 'user-left':
        this.emit('user-left', message.userId);
        break;
      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  // Send SDP offer to remote peer
  sendOffer(targetId, offer) {
    this.send({ type: 'offer', payload: offer, target: targetId });
  }

  // Send SDP answer to remote peer
  sendAnswer(targetId, answer) {
    this.send({ type: 'answer', payload: answer, target: targetId });
  }

  // Send ICE candidate to remote peer
  sendIceCandidate(targetId, candidate) {
    this.send({ type: 'ice-candidate', payload: candidate, target: targetId });
  }

  // Generic send method
  send(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

// ============== MEDIA STREAM MANAGER ==============
class MediaStreamManager {
  constructor() {
    this.localStream = null;
    this.screenStream = null;
    this.audioContext = null;
    this.audioAnalyser = null;
  }

  // Get user's camera and microphone
  async getUserMedia(constraints = MEDIA_CONSTRAINTS) {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.localStream;
    } catch (error) {
      if (error.name === 'NotAllowedError') {
        throw new Error('Camera/microphone permission denied');
      }
      throw error;
    }
  }

  // Capture screen for sharing
  async getDisplayMedia() {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false
      });
      
      // Handle user stopping screen share via browser UI
      this.screenStream.getVideoTracks()[0].onended = () => {
        this.stopScreenShare();
      };
      
      return this.screenStream;
    } catch (error) {
      throw new Error('Screen sharing failed: ' + error.message);
    }
  }

  // Stop screen sharing
  stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }
  }

  // Toggle video track on/off
  toggleVideo() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return videoTrack.enabled;
      }
    }
    return false;
  }

  // Toggle audio track on/off (mute/unmute)
  toggleAudio() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return audioTrack.enabled;
      }
    }
    return false;
  }

  // Setup audio level analysis for voice activity detection
  setupAudioAnalysis() {
    if (!this.localStream) return;

    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(this.localStream);
    this.audioAnalyser = this.audioContext.createAnalyser();
    this.audioAnalyser.fftSize = 256;
    source.connect(this.audioAnalyser);
  }

  // Get current audio level (0-100)
  getAudioLevel() {
    if (!this.audioAnalyser) return 0;

    const dataArray = new Uint8Array(this.audioAnalyser.frequencyBinCount);
    this.audioAnalyser.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    return Math.min(100, average * 2);
  }

  // Release all media resources
  cleanup() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    this.stopScreenShare();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// ============== PEER CONNECTION MANAGER ==============
class PeerConnectionManager extends EventEmitter {
  constructor(signaling) {
    super();
    this.signaling = signaling;
    this.peers = new Map();
    this.localStream = null;
    this.pendingCandidates = new Map();

    this.setupSignalingHandlers();
  }

  setupSignalingHandlers() {
    this.signaling.on('offer', (offer, from) => this.handleOffer(offer, from));
    this.signaling.on('answer', (answer, from) => this.handleAnswer(answer, from));
    this.signaling.on('ice-candidate', (candidate, from) => this.handleIceCandidate(candidate, from));
  }

  setLocalStream(stream) {
    this.localStream = stream;
  }

  // Create new peer connection with given peer ID
  createPeerConnection(peerId) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    
    // Add local tracks to connection
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream);
      });
    }

    // Handle ICE candidate generation
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.sendIceCandidate(peerId, event.candidate);
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      this.emit('connection-state', peerId, pc.connectionState);
      
      if (pc.connectionState === 'failed') {
        this.restartIce(peerId);
      }
    };

    // Handle incoming remote tracks
    pc.ontrack = (event) => {
      this.emit('remote-stream', peerId, event.streams[0]);
    };

    // Handle ICE connection state
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected') {
        // BUG: Should implement reconnection logic here
        console.log('ICE disconnected for peer:', peerId);
      }
    };

    this.peers.set(peerId, pc);
    return pc;
  }

  // Initiate call to remote peer
  async initiateCall(peerId) {
    const pc = this.createPeerConnection(peerId);
    
    try {
      const offer = await pc.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true
      });
      
      await pc.setLocalDescription(offer);
      this.signaling.sendOffer(peerId, offer);
    } catch (error) {
      this.emit('error', 'Failed to create offer: ' + error.message);
    }
  }

  // Handle incoming SDP offer
  async handleOffer(offer, from) {
    let pc = this.peers.get(from);
    if (!pc) {
      pc = this.createPeerConnection(from);
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      
      // Process any pending ICE candidates
      await this.processPendingCandidates(from);
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.signaling.sendAnswer(from, answer);
    } catch (error) {
      this.emit('error', 'Failed to handle offer: ' + error.message);
    }
  }

  // Handle incoming SDP answer
  async handleAnswer(answer, from) {
    const pc = this.peers.get(from);
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      await this.processPendingCandidates(from);
    } catch (error) {
      this.emit('error', 'Failed to handle answer: ' + error.message);
    }
  }

  // Handle incoming ICE candidate
  async handleIceCandidate(candidate, from) {
    const pc = this.peers.get(from);
    
    if (!pc || !pc.remoteDescription) {
      // Queue candidate if remote description not set yet
      if (!this.pendingCandidates.has(from)) {
        this.pendingCandidates.set(from, []);
      }
      this.pendingCandidates.get(from).push(candidate);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Failed to add ICE candidate:', error);
    }
  }

  // Process queued ICE candidates
  async processPendingCandidates(peerId) {
    const candidates = this.pendingCandidates.get(peerId) || [];
    const pc = this.peers.get(peerId);
    
    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('Failed to add pending ICE candidate:', error);
      }
    }
    
    this.pendingCandidates.delete(peerId);
  }

  // Restart ICE for failed connection
  async restartIce(peerId) {
    const pc = this.peers.get(peerId);
    if (!pc) return;

    try {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      this.signaling.sendOffer(peerId, offer);
    } catch (error) {
      this.emit('error', 'ICE restart failed: ' + error.message);
    }
  }

  // Replace video track (for screen sharing)
  async replaceVideoTrack(peerId, newTrack) {
    const pc = this.peers.get(peerId);
    if (!pc) return;

    const sender = pc.getSenders().find(s => s.track?.kind === 'video');
    if (sender) {
      await sender.replaceTrack(newTrack);
    }
  }

  // Get connection statistics
  async getStats(peerId) {
    const pc = this.peers.get(peerId);
    if (!pc) return null;

    const stats = await pc.getStats();
    const result = { bytesReceived: 0, bytesSent: 0, packetsLost: 0 };

    stats.forEach(report => {
      if (report.type === 'inbound-rtp') {
        result.bytesReceived += report.bytesReceived || 0;
        result.packetsLost += report.packetsLost || 0;
      }
      if (report.type === 'outbound-rtp') {
        result.bytesSent += report.bytesSent || 0;
      }
    });

    return result;
  }

  // Close connection to specific peer
  closePeerConnection(peerId) {
    const pc = this.peers.get(peerId);
    if (pc) {
      pc.close();
      this.peers.delete(peerId);
    }
    this.pendingCandidates.delete(peerId);
  }

  // Close all connections
  closeAll() {
    this.peers.forEach((pc, peerId) => {
      pc.close();
    });
    this.peers.clear();
    this.pendingCandidates.clear();
  }
}

// ============== ROOM MANAGEMENT ==============
class ConferenceRoom extends EventEmitter {
  constructor(roomId) {
    super();
    this.roomId = roomId;
    this.participants = new Map();
    this.mediaManager = new MediaStreamManager();
    this.signaling = null;
    this.peerManager = null;
    this.isHost = false;
  }

  // Join conference room
  async join(serverUrl, userId) {
    this.signaling = new SignalingChannel(serverUrl);
    this.peerManager = new PeerConnectionManager(this.signaling);
    
    // Get local media
    const stream = await this.mediaManager.getUserMedia();
    this.peerManager.setLocalStream(stream);
    this.emit('local-stream', stream);

    // Setup event handlers
    this.setupEventHandlers();
    
    // Connect to signaling server
    this.signaling.connect();
    
    return stream;
  }

  setupEventHandlers() {
    this.signaling.on('user-joined', async (userId) => {
      this.participants.set(userId, { joined: Date.now() });
      await this.peerManager.initiateCall(userId);
      this.emit('participant-joined', userId);
    });

    this.signaling.on('user-left', (userId) => {
      this.peerManager.closePeerConnection(userId);
      this.participants.delete(userId);
      this.emit('participant-left', userId);
    });

    this.peerManager.on('remote-stream', (peerId, stream) => {
      this.emit('remote-stream', peerId, stream);
    });

    this.peerManager.on('connection-state', (peerId, state) => {
      this.emit('connection-state', peerId, state);
    });
  }

  // Start screen sharing
  async startScreenShare() {
    const screenStream = await this.mediaManager.getDisplayMedia();
    const videoTrack = screenStream.getVideoTracks()[0];
    
    // Replace video track for all peers
    for (const [peerId] of this.participants) {
      await this.peerManager.replaceVideoTrack(peerId, videoTrack);
    }
    
    this.emit('screen-share-started');
    return screenStream;
  }

  // Stop screen sharing and restore camera
  async stopScreenShare() {
    this.mediaManager.stopScreenShare();
    
    const cameraTrack = this.mediaManager.localStream?.getVideoTracks()[0];
    if (cameraTrack) {
      for (const [peerId] of this.participants) {
        await this.peerManager.replaceVideoTrack(peerId, cameraTrack);
      }
    }
    
    this.emit('screen-share-stopped');
  }

  // Toggle local video
  toggleVideo() {
    return this.mediaManager.toggleVideo();
  }

  // Toggle local audio
  toggleAudio() {
    return this.mediaManager.toggleAudio();
  }

  // Leave the room
  leave() {
    this.peerManager.closeAll();
    this.signaling.disconnect();
    this.mediaManager.cleanup();
    this.participants.clear();
    this.emit('left');
  }
}

// ============== DATA CHANNEL FOR CHAT ==============
class DataChannelManager {
  constructor(peerConnection) {
    this.pc = peerConnection;
    this.channels = new Map();
    this.onMessage = null;
  }

  // Create data channel for messaging
  createChannel(label, options = {}) {
    const channel = this.pc.createDataChannel(label, {
      ordered: true,
      ...options
    });

    channel.onopen = () => {
      console.log('Data channel opened:', label);
    };

    channel.onmessage = (event) => {
      if (this.onMessage) {
        this.onMessage(label, JSON.parse(event.data));
      }
    };

    channel.onclose = () => {
      this.channels.delete(label);
    };

    this.channels.set(label, channel);
    return channel;
  }

  // Send message through data channel
  sendMessage(label, data) {
    const channel = this.channels.get(label);
    if (channel && channel.readyState === 'open') {
      channel.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  // BUG: No message queue for closed channels
  closeAll() {
    this.channels.forEach(channel => channel.close());
    this.channels.clear();
  }
}

// ============== BANDWIDTH ESTIMATION ==============
class BandwidthEstimator {
  constructor() {
    this.samples = [];
    this.maxSamples = 10;
  }

  // Add bandwidth sample
  addSample(bytesPerSecond) {
    this.samples.push(bytesPerSecond);
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
  }

  // Get estimated available bandwidth
  getEstimate() {
    if (this.samples.length === 0) return 0;
    return this.samples.reduce((a, b) => a + b) / this.samples.length;
  }

  // Suggest video quality based on bandwidth
  suggestQuality() {
    const bandwidth = this.getEstimate();
    
    if (bandwidth > 2500000) return 'high';      // 2.5 Mbps
    if (bandwidth > 1000000) return 'medium';    // 1 Mbps  
    if (bandwidth > 500000) return 'low';        // 500 Kbps
    return 'audio-only';
  }
}

module.exports = {
  SignalingChannel,
  MediaStreamManager,
  PeerConnectionManager,
  ConferenceRoom,
  DataChannelManager,
  BandwidthEstimator,
  ICE_SERVERS,
  MEDIA_CONSTRAINTS
};
