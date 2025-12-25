const { search } = require('./index.js');
const fs = require('fs');
const path = require('path');

const TEST_FILE = path.join(__dirname, 'webrtc.test.js');
const CODE = fs.readFileSync(TEST_FILE, 'utf8');
const LINES = CODE.split('\n');

// Questions based on concepts, not specific keywords from the code
const QUESTIONS = [
  // Bug/Issue finding queries
  { query: "hardcoded secret credentials in config", expect: "ICE_SERVERS" },
  { query: "reconnection backoff missing", expect: "socket.onclose" },
  { query: "disconnect handling incomplete", expect: "oniceconnectionstatechange" },
  { query: "memory leak potential in channels", expect: "DataChannelManager" },

  // Feature/Functionality queries  
  { query: "camera microphone permission", expect: "getUserMedia" },
  { query: "desktop capture for presentation", expect: "getDisplayMedia" },
  { query: "mute unmute functionality", expect: "toggleAudio" },
  { query: "video on off control", expect: "toggleVideo" },
  { query: "voice activity detection", expect: "getAudioLevel" },
  { query: "sound level monitoring", expect: "audioAnalyser" },
  
  // WebRTC core queries
  { query: "peer to peer connection setup", expect: "createPeerConnection" },
  { query: "sdp offer creation", expect: "createOffer" },
  { query: "sdp answer handling", expect: "handleAnswer" },
  { query: "ice candidate exchange", expect: "handleIceCandidate" },
  { query: "remote video stream received", expect: "ontrack" },
  { query: "connection failure recovery", expect: "restartIce" },
  { query: "network statistics gathering", expect: "getStats" },
  
  // Signaling queries
  { query: "websocket message handling", expect: "handleSignalingMessage" },
  { query: "server connection established", expect: "socket.onopen" },
  { query: "signaling server communication", expect: "SignalingChannel" },
  
  // Room/Conference queries
  { query: "join video conference", expect: "join" },
  { query: "leave meeting cleanup", expect: "leave" },
  { query: "participant joined notification", expect: "user-joined" },
  { query: "screen sharing start", expect: "startScreenShare" },
  { query: "stop presenting screen", expect: "stopScreenShare" },
  
  // Data channel queries
  { query: "send text message peer", expect: "sendMessage" },
  { query: "real time chat channel", expect: "createChannel" },
  
  // Quality/Bandwidth queries
  { query: "network speed estimation", expect: "BandwidthEstimator" },
  { query: "adaptive video quality", expect: "suggestQuality" },
  { query: "track replacement for sharing", expect: "replaceVideoTrack" },
  
  // Media management queries
  { query: "release camera resources", expect: "cleanup" },
  { query: "media stream initialization", expect: "MediaStreamManager" },
  { query: "local media tracks", expect: "localStream" },

  // Vague/Natural language queries
  { query: "how to start a call", expect: "initiateCall" },
  { query: "connection configuration", expect: "ICE_SERVERS" },
  { query: "incoming call handling", expect: "handleOffer" },
  { query: "video quality settings", expect: "MEDIA_CONSTRAINTS" },
  { query: "error event handling", expect: "onerror" },
  { query: "queued candidates processing", expect: "processPendingCandidates" },
];

function snippetContains(result, expected) {
  const snippet = LINES.slice(result.start - 1, result.end).join('\n');
  return snippet.includes(expected);
}

function run() {
  console.log('='.repeat(70));
  console.log('WEBRTC ACCURACY TEST (NEW DATASET)');
  console.log(`Questions: ${QUESTIONS.length}`);
  console.log('='.repeat(70));
  console.log();

  let top1 = 0, top3 = 0, top5 = 0;

  QUESTIONS.forEach((q, i) => {
    const results = search(CODE, q.query, { topK: 5, minLines: 5, maxLines: 80 });
    const idx = results.findIndex(r => snippetContains(r, q.expect));

    if (idx === 0) top1++;
    if (idx >= 0 && idx < 3) top3++;
    if (idx >= 0 && idx < 5) top5++;

    const status =
      idx === 0 ? '✅ TOP-1' :
      idx < 3 ? '🟡 TOP-3' :
      idx < 5 ? '🟠 TOP-5' :
      '❌ MISS';

    console.log(`${String(i + 1).padStart(2)}. ${status} | ${q.query}`);
  });

  console.log('\n' + '='.repeat(70));
  console.log('RESULTS');
  console.log('='.repeat(70));
  console.log(`Top-1 Accuracy: ${(top1 / QUESTIONS.length * 100).toFixed(1)}% (${top1}/${QUESTIONS.length})`);
  console.log(`Top-3 Accuracy: ${(top3 / QUESTIONS.length * 100).toFixed(1)}% (${top3}/${QUESTIONS.length})`);
  console.log(`Top-5 Accuracy: ${(top5 / QUESTIONS.length * 100).toFixed(1)}% (${top5}/${QUESTIONS.length})`);
}

run();
