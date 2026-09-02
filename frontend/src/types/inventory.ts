export interface InventoryItem {
  id: string;
  client_name: string;
  ip: string;
  mac: string;
  serial_number: string;
  model: string;
  status: 'active' | 'disabled' | 'pending' | 'suspended' | 'unknown' | string;
  address: string;
}

export interface InventoryApiResponse {
  success: boolean;
  count: number;
  cached: boolean;
  timestamp: string;
  data: InventoryItem[];
}

export interface UseInventorySearchResult {
  loading: boolean;
  error: string | null;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  results: InventoryItem[];
  totalRecords: number;
  refresh: () => Promise<void>;
  isCached: boolean;
  lastUpdated: string | null;
  isSyncing?: boolean;
}
