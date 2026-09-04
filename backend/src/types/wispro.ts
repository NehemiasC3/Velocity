/**
 * Tipos para la API de Wispro Cloud v1
 */

export interface WisproPagination {
  total_pages: number;
  current_page: number;
  total_count: number;
  per_page: number;
}

export interface WisproMeta {
  pagination?: WisproPagination;
}

export interface WisproClientNested {
  id?: string;
  name?: string;
  address?: string;
  street?: string;
  address_street?: string;
  address_number?: string;
  city?: string;
}

export interface WisproRawItem {
  id?: string | number;
  client_id?: string | number;
  client_name?: string | null;
  name?: string | null;
  client?: WisproClientNested | null;
  
  // IP fields
  ip?: string | null;
  ip_address?: string | null;
  framed_ip_address?: string | null;
  mikrotik_ip?: string | null;
  
  // MAC fields
  mac?: string | null;
  mac_address?: string | null;
  equipment_mac?: string | null;
  device_mac?: string | null;
  
  // Serial number fields
  serial_number?: string | null;
  ont_serial_number?: string | null;
  serial?: string | null;
  sn?: string | null;
  onu_sn?: string | null;
  gpon_sn?: string | null;
  
  // PPPoE & Details
  pppoe_username?: string | null;
  public_id?: string | number | null;
  details?: string | null;
  nap_name?: string | null;
  
  // Model fields
  model?: string | null;
  equipment_model?: string | null;
  model_name?: string | null;
  hardware_model?: string | null;
  device_model?: string | null;
  
  // Status fields
  status?: string | null;
  state?: string | null;
  contract_state?: string | null;
  service_state?: string | null;
  
  // Address fields
  address?: string | null;
  street?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  full_address?: string | null;
  zone_name?: string | null;
  city?: string | null;
}

export interface WisproPageResponse {
  data?: WisproRawItem[];
  meta?: WisproMeta;
}
