// ============================================
// Multiplayer Client (WebRTC via PeerJS)
// ============================================
//
// 1v1 over the public PeerJS broker. No backend for the data channel
// itself — peers connect directly. A separate matchmaking lobby
// (js/lobby.js) brokers peer IDs through Firebase RTDB so users don't
// have to share codes.
//
// Peer IDs are random and prefixed with `swars-` so we don't collide
// with other apps on the public broker.
//
// Flow:
//   - Host: hostPeer() registers a random peer ID, waits for incoming.
//     Returns the registered ID so the lobby can publish it.
//   - Guest: connectToPeer(id) opens a data channel to that ID.
//   - Both ends exchange JSON messages: { type, ...payload }
//
// Message types:
//   'hello'  – { name, weapon }            initial handshake
//   'state'  – { x, y, facing, hp, attack, weapon, ts }
//   'damage' – { amount }                  attacker → defender
//   'emote'  – { key }
//   'win'    – { winner: 'host' | 'guest' }  authoritative result

const MP_PEER_PREFIX = 'swars-';

function _randomPeerSuffix() {
    // 12 chars from a URL-safe alphabet; ~ 71 bits of entropy.
    const a = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    for (let i = 0; i < 12; i++) s += a[Math.floor(Math.random() * a.length)];
    return s;
}

class MultiplayerClient {
    constructor() {
        this.peer = null;
        this.conn = null;
        this.role = null;        // 'host' | 'guest'
        this.peerId = null;      // our own peer ID on the broker
        this.connected = false;
        this.opponentReady = false;

        this._listeners = {};   // event -> [handler]
    }

    on(event, handler) {
        (this._listeners[event] ||= []).push(handler);
    }

    _emit(event, data) {
        const arr = this._listeners[event] || [];
        for (const fn of arr) {
            try { fn(data); } catch (e) { console.error('mp listener error', e); }
        }
    }

    _ensurePeer() {
        if (typeof Peer === 'undefined') {
            throw new Error('PeerJS failed to load (offline or blocked)');
        }
    }

    // Register a random peer ID on the broker as the host. Resolves with
    // the registered peerId; the matchmaking lobby publishes that so a
    // guest can connect to us.
    hostPeer() {
        this._ensurePeer();
        this.role = 'host';
        const id = MP_PEER_PREFIX + _randomPeerSuffix();

        return new Promise((resolve, reject) => {
            const peer = new Peer(id);
            this.peer = peer;
            peer.on('open', (registeredId) => {
                this.peerId = registeredId;
                resolve(registeredId);
            });
            peer.on('error', (err) => {
                if (err && err.type === 'unavailable-id') {
                    reject(new Error('Peer ID collision (rare) — retry'));
                } else {
                    this._emit('error', err);
                }
            });
            peer.on('connection', (conn) => {
                this._bindConn(conn);
            });
        });
    }

    // Connect out to an existing host peer ID. Resolves once the data channel opens.
    connectToPeer(targetId) {
        this._ensurePeer();
        this.role = 'guest';

        return new Promise((resolve, reject) => {
            const peer = new Peer(); // random guest ID
            this.peer = peer;
            peer.on('open', (id) => {
                this.peerId = id;
                const conn = peer.connect(targetId, { reliable: true });
                this._bindConn(conn);
                let opened = false;
                conn.on('open', () => { opened = true; resolve(true); });
                conn.on('error', (err) => reject(err));
                setTimeout(() => {
                    if (!opened) reject(new Error('Host did not respond'));
                }, 8000);
            });
            peer.on('error', (err) => {
                if (err && (err.type === 'peer-unavailable' || err.type === 'network')) {
                    reject(new Error('Host went away before we could connect'));
                } else {
                    this._emit('error', err);
                }
            });
        });
    }

    _bindConn(conn) {
        this.conn = conn;
        conn.on('open', () => {
            this.connected = true;
            this._emit('connected');
        });
        conn.on('data', (msg) => {
            if (!msg || !msg.type) return;
            this._emit('message', msg);
            this._emit('msg:' + msg.type, msg);
        });
        conn.on('close', () => {
            this.connected = false;
            this._emit('disconnected');
        });
        conn.on('error', (err) => {
            this._emit('error', err);
        });
    }

    send(type, payload) {
        if (!this.conn || !this.connected) return false;
        try {
            this.conn.send({ type, ...payload });
            return true;
        } catch (e) {
            console.warn('mp send failed', e);
            return false;
        }
    }

    leave() {
        try { if (this.conn) this.conn.close(); } catch (e) {}
        try { if (this.peer) this.peer.destroy(); } catch (e) {}
        this.peer = null;
        this.conn = null;
        this.connected = false;
        this.opponentReady = false;
        this.role = null;
        this.peerId = null;
    }
}

window.MultiplayerClient = MultiplayerClient;
