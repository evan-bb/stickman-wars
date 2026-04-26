// ============================================
// Matchmaking Lobby (Firebase Realtime Database)
// ============================================
//
// One slot at /lobby/waiting holds the peer ID of whoever is currently
// looking for a match. Two players hit the slot:
//
//   - If the slot is empty (or stale > LOBBY_STALE_MS), the caller writes
//     their own peerId and becomes the HOST (waits for guest to connect
//     via PeerJS).
//   - If the slot has someone else's fresh peerId, the caller atomically
//     deletes the entry and connects out as the GUEST.
//
// Race-safe via Firebase transactions: ties are broken by retrying — the
// loser sees the new value and falls through to the guest branch.
//
// Cleanup: hosts register onDisconnect().remove() so a closed tab doesn't
// strand the slot. The 30s stale fallback covers crashes that bypass the
// onDisconnect handler.

const LOBBY_PATH = 'lobby/waiting';
const LOBBY_STALE_MS = 30000;

// firebase-config.js sets window.FIREBASE_CONFIG before this file loads.
class LobbyClient {
    constructor() {
        this.app = null;
        this.db = null;
        this.disconnectHandle = null; // OnDisconnect ref for cleanup
        this.hostingRef = null;       // DB ref we wrote our peerId to (host only)
    }

    init() {
        if (this.db) return;
        if (typeof firebase === 'undefined' || !firebase.app) {
            throw new Error('Firebase SDK not loaded');
        }
        if (!window.FIREBASE_CONFIG || !window.FIREBASE_CONFIG.databaseURL) {
            throw new Error('Firebase config missing databaseURL');
        }
        if (!firebase.apps.length) {
            this.app = firebase.initializeApp(window.FIREBASE_CONFIG);
        } else {
            this.app = firebase.app();
        }
        this.db = firebase.database();
    }

    // Resolves with {role:'host'} | {role:'guest', opponentPeerId}.
    async findMatch(myPeerId) {
        this.init();
        const ref = this.db.ref(LOBBY_PATH);
        const now = Date.now();

        // Step 1: peek at the current slot.
        const snap = await ref.get();
        const cur = snap.val();
        const isFresh = cur && cur.peerId && (now - (cur.ts || 0)) <= LOBBY_STALE_MS;

        // Step 2: if the slot has a fresh occupant (and it's not us), try to
        // claim it. The transaction only deletes if the peerId still matches
        // what we just read, so concurrent claims fall through cleanly.
        if (isFresh && cur.peerId !== myPeerId) {
            const opponent = cur.peerId;
            const claim = await ref.transaction((c) => {
                if (c && c.peerId === opponent) return null;
                return c; // someone else changed it — abort
            });
            const after = claim.snapshot.val();
            if (!after || after.peerId !== opponent) {
                return { role: 'guest', opponentPeerId: opponent };
            }
            // Concurrent claim won; fall through and try to become host.
        }

        // Step 3: become host — install ourselves only if the slot is still empty/stale.
        const install = await ref.transaction((c) => {
            if (!c || !c.peerId || (now - (c.ts || 0)) > LOBBY_STALE_MS) {
                return { peerId: myPeerId, ts: now };
            }
            return c; // a new host arrived between steps; abort and re-route
        });
        const after = install.snapshot.val();
        if (after && after.peerId === myPeerId) {
            this.hostingRef = ref;
            this.disconnectHandle = ref.onDisconnect();
            this.disconnectHandle.remove();
            return { role: 'host' };
        }
        // Step 4: another player became host while we were peeking — claim them.
        if (after && after.peerId) {
            const opponent = after.peerId;
            await ref.transaction((c) => (c && c.peerId === opponent ? null : c));
            return { role: 'guest', opponentPeerId: opponent };
        }
        throw new Error('Could not claim lobby slot');
    }

    // Remove our waiting entry (host-side cancel or after match starts).
    async leaveLobby() {
        if (this.disconnectHandle) {
            try { await this.disconnectHandle.cancel(); } catch (e) {}
            this.disconnectHandle = null;
        }
        if (this.hostingRef) {
            try { await this.hostingRef.remove(); } catch (e) {}
            this.hostingRef = null;
        }
    }
}

window.LobbyClient = LobbyClient;
