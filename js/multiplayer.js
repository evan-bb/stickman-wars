// ============================================
// Multiplayer Client (WebRTC via PeerJS)
// ============================================
//
// 1v1 over the public PeerJS broker. No backend, peer-to-peer.
//
// Codes are 4 letters (e.g. "ABCD"). They get prefixed with a fixed
// namespace before being used as a peer ID so we don't collide with
// other apps using the public broker.
//
// Flow:
//   - First player: hostRoom('ABCD') registers peer ID swars-ABCD,
//     waits for an incoming connection.
//   - Second player: joinRoom('ABCD') connects to swars-ABCD.
//   - Both ends exchange JSON messages: { type, ...payload }
//
// Message types:
//   'hello'  – { name, weapon }            initial handshake
//   'state'  – { x, y, facing, hp, attack, weapon, ts }
//   'damage' – { amount }                  attacker → defender
//   'emote'  – { key }
//   'win'    – { winner: 'host' | 'guest' }  authoritative result

const MP_PEER_PREFIX = 'swars-';

class MultiplayerClient {
    constructor() {
        this.peer = null;
        this.conn = null;
        this.role = null;        // 'host' | 'guest'
        this.code = null;
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

    // Try to host a room. Resolves when the broker registers our ID.
    // Rejects if the ID is already taken (someone is hosting that code).
    hostRoom(code) {
        this._ensurePeer();
        this.role = 'host';
        this.code = code;
        const id = MP_PEER_PREFIX + code.toUpperCase();

        return new Promise((resolve, reject) => {
            const peer = new Peer(id);
            this.peer = peer;
            peer.on('open', () => resolve(true));
            peer.on('error', (err) => {
                // 'unavailable-id' means somebody already has this peer ID
                if (err && err.type === 'unavailable-id') {
                    reject(new Error('Code in use'));
                } else {
                    this._emit('error', err);
                }
            });
            peer.on('connection', (conn) => {
                this._bindConn(conn);
            });
        });
    }

    // Join an existing host. Resolves once the data channel opens.
    joinRoom(code) {
        this._ensurePeer();
        this.role = 'guest';
        this.code = code;
        const targetId = MP_PEER_PREFIX + code.toUpperCase();

        return new Promise((resolve, reject) => {
            // Use a random ID for the guest so we don't conflict
            const peer = new Peer();
            this.peer = peer;
            peer.on('open', () => {
                const conn = peer.connect(targetId, { reliable: true });
                this._bindConn(conn);
                let opened = false;
                conn.on('open', () => { opened = true; resolve(true); });
                conn.on('error', (err) => reject(err));
                // If we never see 'open', assume host doesn't exist
                setTimeout(() => {
                    if (!opened) reject(new Error('Could not find that room'));
                }, 6000);
            });
            peer.on('error', (err) => {
                if (err && (err.type === 'peer-unavailable' || err.type === 'network')) {
                    reject(new Error('Could not find that room'));
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
        this.code = null;
    }
}

window.MultiplayerClient = MultiplayerClient;
