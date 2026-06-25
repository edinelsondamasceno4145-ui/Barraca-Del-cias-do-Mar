export type UserRole = 'waiter' | 'customer' | 'admin';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  password?: string;
  createdAt?: any;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  description?: string;
  available: boolean;
}

export type TableStatus = 'available' | 'active' | 'bill_requested' | 'paid';

export interface Table {
  id: string;
  number: number;
  name?: string;
  status: TableStatus;
  currentOrderId?: string;
  waiterId?: string;
  customerId?: string;
  totalAmount: number;
  occupants: number;
  createdAt: any;
  updatedAt: any;
}

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  tableId: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'completed';
  waiterId?: string;
  customerId: string;
  createdAt: any;
}

export interface AppNotification {
  id: string;
  type: 'bill_request' | 'order_update';
  tableNumber: number;
  tableId: string;
  message: string;
  read: boolean;
  createdAt: any;
}

export interface Review {
  id?: string;
  orderId: string;
  customerId: string;
  customerName: string;
  rating: number; // 1-5
  comment: string;
  createdAt: any;
}
