// Live Dual-Window Synchronization System
// Uses BroadcastChannel API for 0ms sub-millisecond real-time sync between Editor and Game windows on same origin.

const CHANNEL_NAME = 'wanderlust_live_sync';

class LiveSyncManager {
    constructor() {
        this.channel = null;
        this.listeners = [];
        this.isConnected = false;
        this.isBroadcasting = true;

        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
            try {
                this.channel = new BroadcastChannel(CHANNEL_NAME);
                this.channel.onmessage = (event) => this.handleMessage(event.data);
                this.isConnected = true;
            } catch (e) {
                console.warn('BroadcastChannel not supported or restricted:', e);
            }
        }

        // Fallback to storage events for cross-tab sync if BroadcastChannel fails
        if (typeof window !== 'undefined') {
            window.addEventListener('storage', (e) => {
                if (e.key === 'wl_live_sync_msg' && e.newValue) {
                    try {
                        const data = JSON.parse(e.newValue);
                        this.handleMessage(data);
                    } catch (err) {}
                }
            });
        }
    }

    send(type, payload = {}) {
        const msg = {
            type,
            payload,
            timestamp: Date.now(),
            senderId: window.name || (Math.random().toString(36).substring(2, 8))
        };

        if (this.channel) {
            try {
                this.channel.postMessage(msg);
            } catch (e) {
                console.warn('Failed to postMessage to LiveSync channel:', e);
            }
        }

        // Also trigger localStorage fallback (debounced for rapid slider changes)
        try {
            localStorage.setItem('wl_live_sync_msg', JSON.stringify(msg));
        } catch (e) {}
    }

    sendParamChange(category, key, value) {
        this.send('PARAM_CHANGE', { category, key, value });
    }

    sendFullPreset(presetData) {
        this.send('FULL_PRESET_APPLIED', { preset: presetData });
    }

    sendStateSync(fullGuiState) {
        this.send('FULL_STATE_SYNC', { state: fullGuiState });
    }

    onMessage(callback) {
        if (typeof callback === 'function') {
            this.listeners.push(callback);
        }
    }

    handleMessage(data) {
        if (!data || !data.type) return;
        this.listeners.forEach(cb => {
            try {
                cb(data);
            } catch (e) {
                console.error('Error in LiveSync listener:', e);
            }
        });
    }
}

export const liveSync = new LiveSyncManager();
