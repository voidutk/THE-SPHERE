import { create } from 'zustand';

const useShipStore = create((set, get) => ({
  /** @type {Map<number, object>} */
  ships: new Map(),
  shipsArray: [],
  selectedShip: null,
  shipPanelOpen: false,
  shipLayerVisible: true,
  connected: false,
  shipCount: 0,

  /** Track data for selected ship */
  trackData: [],
  trackLoading: false,

  /** EventSource instance */
  _eventSource: null,

  /** Toggle ship layer visibility */
  toggleShipLayer: () => set((s) => ({ shipLayerVisible: !s.shipLayerVisible })),

  /** Select a ship and open the detail panel */
  selectShip: (ship) => {
    set({ selectedShip: ship, shipPanelOpen: true, trackData: [], trackLoading: false });
    // Auto-fetch track
    get().fetchTrack(ship.mmsi);
  },

  /** Close ship panel */
  clearShipSelection: () => set({ selectedShip: null, shipPanelOpen: false, trackData: [] }),

  /** Fetch historical track and extended details for a ship */
  fetchTrack: async (mmsi) => {
    set({ trackLoading: true, extendedDetails: null });
    try {
      const [trackRes, detailsRes] = await Promise.all([
        fetch(`/api/ships/track/${mmsi}?days=7`),
        fetch(`/api/ships/details/${mmsi}`)
      ]);
      
      const trackJson = await trackRes.json();
      let extendedDetails = null;
      if (detailsRes.ok) {
        extendedDetails = await detailsRes.json();
      }

      set({ trackData: trackJson.track || [], extendedDetails, trackLoading: false });
    } catch (err) {
      console.warn('Track and details fetch failed:', err);
      set({ trackData: [], extendedDetails: null, trackLoading: false });
    }
  },

  /** Connect to the SSE ship stream */
  connectToShipStream: () => {
    // Don't double-connect
    if (get()._eventSource) return;

    const es = new EventSource('/api/ships/stream');

    es.addEventListener('snapshot', (e) => {
      try {
        const ships = JSON.parse(e.data);
        const map = new Map();
        for (const s of ships) {
          if (s.lat != null && s.lng != null) {
            map.set(s.mmsi, s);
          }
        }
        set({ ships: map, shipsArray: Array.from(map.values()), shipCount: map.size, connected: true });
      } catch (err) {
        console.warn('Ship snapshot parse error:', err);
      }
    });

    es.addEventListener('update', (e) => {
      try {
        const ships = JSON.parse(e.data);
        const map = new Map();
        for (const s of ships) {
          if (s.lat != null && s.lng != null) {
            map.set(s.mmsi, s);
          }
        }
        set({ ships: map, shipsArray: Array.from(map.values()), shipCount: map.size });

        // Update selected ship if it's still in the data
        const selected = get().selectedShip;
        if (selected) {
          const updated = map.get(selected.mmsi);
          if (updated) {
            set({ selectedShip: updated });
          }
        }
      } catch (err) {
        // Silent
      }
    });

    // Server is running in serverless mode (Vercel) — no persistent ship tracking.
    // Close the connection and don't retry.
    es.addEventListener('serverless', () => {
      es.close();
      set({ _eventSource: null, connected: false });
    });

    es.onerror = () => {
      set({ connected: false });
    };

    set({ _eventSource: es });
  },

  /** Disconnect from the SSE ship stream */
  disconnectShipStream: () => {
    const es = get()._eventSource;
    if (es) {
      es.close();
      set({ _eventSource: null, connected: false });
    }
  },
}));

export default useShipStore;
