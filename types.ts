import { Timestamp } from 'firebase/firestore';

export interface Movement {
  type: 'entrada' | 'salida' | 'anulacion_entrada' | 'anulacion_salida';
  amount: number;
  unit: string;
  date: string;
  source?: string;
  destination?: string;
  cancelled?: boolean;
  cancelledMovementDate?: string;
  productId?: string;
  productName?: string;
}

export interface Product {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  minStock: number;
  category: string;
  history: Movement[];
  createdAt: string;
}

export interface RequisitionItem {
  productId: string;
  productName: string;
  requestedQuantity: number;
  unit: string;
  deliveredQuantity?: number;
  observation?: string;
}

export interface Requisition {
  id: string;
  department: string;
  status: 'pending' | 'completed';
  createdAt: Timestamp;
  processedAt?: Timestamp;
  items: RequisitionItem[];
  createdBy?: string;
}

export interface InvoiceItem {
  productName: string;
  quantity: number;
  unit: string;
  price: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  provider: string;
  date: Timestamp;
  totalAmount: number;
  status: 'pending' | 'paid';
  source: 'manual' | 'whatsapp' | 'ia_chatbot';
  rawText?: string;
  items: InvoiceItem[];
}

export interface Provider {
    id: string;
    name: string;
    phone: string;
    lastUsed: Timestamp;
    useCount: number;
}

export interface ProductionOutput {
  productName: string;
  quantity: number;
  unit: string;
  category: string;
}

export interface Production {
  id: string;
  date: Timestamp;
  rawMaterialId: string;
  rawMaterialName: string;
  rawMaterialQuantityUsed: number;
  rawMaterialUnit: string;
  outputs: ProductionOutput[];
  waste: {
    quantity: number;
    unit: string;
  };
  notes?: string;
  createdBy?: string;
}

export type ViewType = 
  | 'dashboard'
  | 'requisitions'
  | 'orders'
  | 'invoices'
  | 'pantry'
  | 'meats'
  | 'vegetables'
  | 'licores'
  | 'productions'
  | 'calendar'
  | 'stats'
  | 'reports'
  | 'chatbot'
  | 'settings';

export interface NotificationType {
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface GeminiAction {
    name: string;
    args: any;
}

export type UserRole = 'jefe' | 'inventario' | 'almacenista';

export interface AppSettings {
  theme: 'light' | 'dark';
  role: UserRole;
}

export interface AppPermissions {
    canAccessSettings: boolean;
    canDeleteProducts: boolean;
    canProcessRequisitions: boolean;
    canCreateProductions: boolean;
    canManuallyAdjustStock: boolean;
    canViewFullHistory: boolean;
}
