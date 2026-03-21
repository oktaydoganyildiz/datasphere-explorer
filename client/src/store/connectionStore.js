import { create } from 'zustand';

const useConnectionStore = create((set) => ({
  // Connection State
  isConnected: false,
  connectionConfig: null,
  schemas: [],
  
  // Selection State
  selectedSchema: null,
  tables: [], // List of tables/views in current schema
  
  // Actions
  setConnected: (status, config) => set({ isConnected: status, connectionConfig: config }),
  setSchemas: (schemas) => set({ schemas }),
  setSelectedSchema: (schema) => set({ selectedSchema: schema }),
  setTables: (tables) => set({ tables }),
  reset: () => set({ 
    isConnected: false, 
    connectionConfig: null, 
    schemas: [], 
    selectedSchema: null, 
    tables: [] 
  })
}));

export default useConnectionStore;
