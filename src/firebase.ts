import { initializeApp as realInitializeApp, getApp as realGetApp, getApps as realGetApps } from "firebase/app";
import { getAnalytics as realGetAnalytics, isSupported as realIsSupported } from "firebase/analytics";
import { 
  getAuth as realGetAuth, 
  signInWithEmailAndPassword as realSignInWithEmailAndPassword,
  createUserWithEmailAndPassword as realCreateUserWithEmailAndPassword,
  signOut as realSignOut,
  signInWithPopup as realSignInWithPopup,
  GoogleAuthProvider as realGoogleAuthProvider,
  onAuthStateChanged as realOnAuthStateChanged,
  sendPasswordResetEmail as realSendPasswordResetEmail
} from "firebase/auth";
import { 
  getFirestore as realGetFirestore, 
  initializeFirestore as realInitializeFirestore,
  doc as realDoc,
  getDoc as realGetDoc,
  getDocFromServer as realGetDocFromServer,
  getDocFromCache as realGetDocFromCache,
  setDoc as realSetDoc,
  updateDoc as realUpdateDoc,
  deleteDoc as realDeleteDoc,
  addDoc as realAddDoc,
  collection as realCollection,
  query as realQuery,
  onSnapshot as realOnSnapshot,
  getDocs as realGetDocs,
  where as realWhere,
  orderBy as realOrderBy,
  limit as realLimit
} from "firebase/firestore";

import firebaseConfig from "../firebase-applet-config.json";
import { INITIAL_MENU } from "./constants";
import { syncToSupabase } from "./supabaseSync";

// Detect if Firebase has empty/placeholder config (declined setup fallback)
export const isDummy = !firebaseConfig.projectId || 
                       firebaseConfig.projectId === "remixed-project-id" || 
                       firebaseConfig.projectId.includes("placeholder");

// Log status
console.log(`[Firebase Service] Running in ${isDummy ? "LOCAL PERSISTENT MOCK" : "FIREBASE SERVICE"} mode.`);

// --- MOCK PERSISTENCE SYSTEM ---
type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();

function getCollectionData(collectionName: string): any[] {
  const json = localStorage.getItem(`mock_db_collection_${collectionName}`);
  if (!json) return [];
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

function saveCollectionData(collectionName: string, data: any[]) {
  localStorage.setItem(`mock_db_collection_${collectionName}`, JSON.stringify(data));
  const set = listeners.get(collectionName);
  if (set) {
    set.forEach(listener => {
      try {
        listener();
      } catch (err) {
        console.error("Error in mock onSnapshot listener:", err);
      }
    });
  }
}

// Seed mock database if empty
if (isDummy) {
  // 1. Seed Users
  const users = getCollectionData("users");
  if (users.length === 0) {
    const initialUsers = [
      {
        uid: "mock_master_admin_id",
        name: "Edinelson Damasceno",
        email: "edinelsonept@gmail.com",
        password: "@Coelho60",
        role: "admin",
        active: true,
        createdAt: new Date().toISOString()
      },
      {
        uid: "mock_master_admin_id_2",
        name: "Edinelson Master 2",
        email: "edinelsondamasceno546@gmail.com",
        password: "admin",
        role: "admin",
        active: true,
        createdAt: new Date().toISOString()
      },
      {
        uid: "mock_master_admin_id_3",
        name: "Edinelson Co-Master",
        email: "edinelsondamasceno07@gmail.com",
        password: "admin",
        role: "admin",
        active: true,
        createdAt: new Date().toISOString()
      },
      {
        uid: "mock_waiter_id_1",
        name: "Carlos Garçom",
        email: "garcom@deliciasdomar.com",
        password: "123",
        role: "waiter",
        active: true,
        createdAt: new Date().toISOString()
      },
      {
        uid: "mock_customer_id_1",
        name: "Ana Costa",
        email: "ana@gmail.com",
        password: "123",
        role: "customer",
        active: true,
        createdAt: new Date().toISOString()
      }
    ];
    saveCollectionData("users", initialUsers);
  }

  // 2. Seed Menu Items
  const menuItems = getCollectionData("menuItems");
  if (menuItems.length === 0) {
    const formattedMenu = INITIAL_MENU.map((item, idx) => ({
      ...item,
      id: `menu-item-${idx}`,
      available: true,
      createdAt: new Date().toISOString()
    }));
    saveCollectionData("menuItems", formattedMenu);
  }

  // 3. Seed Tables
  const tables = getCollectionData("tables");
  if (tables.length === 0) {
    const initialTables = [
      {
        id: "table-1",
        number: 1,
        name: "Beira Mar (Sombra)",
        status: "active",
        occupants: 4,
        totalAmount: 141.00,
        waiterId: "mock_waiter_id_1",
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: "table-3",
        number: 3,
        name: "VIP Família",
        status: "bill_requested",
        occupants: 2,
        totalAmount: 85.00,
        waiterId: "mock_waiter_id_1",
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: "table-5",
        number: 5,
        name: "Mesa Casal",
        status: "active",
        occupants: 2,
        totalAmount: 0.00,
        waiterId: "mock_waiter_id_1",
        createdAt: new Date(Date.now() - 1800000).toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    saveCollectionData("tables", initialTables);
  }

  // 4. Seed Orders
  const orders = getCollectionData("orders");
  if (orders.length === 0) {
    const initialOrders = [
      {
        id: "order-1",
        tableId: "table-1",
        items: [
          { name: "Filé de Pescada Adoré", price: 85, quantity: 1 },
          { name: "Skol 600 ml", price: 13, quantity: 2 },
          { name: "Batata frita", price: 30, quantity: 1 }
        ],
        total: 141.00,
        status: "pending",
        waiterId: "mock_waiter_id_1",
        createdAt: new Date(Date.now() - 3000000).toISOString()
      },
      {
        id: "order-2",
        tableId: "table-3",
        items: [
          { name: "Pratiqueira Simples", price: 50, quantity: 1 },
          { name: "Refrigerante lata", price: 7, quantity: 5 }
        ],
        total: 85.00,
        status: "completed",
        waiterId: "mock_waiter_id_1",
        createdAt: new Date(Date.now() - 6500000).toISOString()
      }
    ];
    saveCollectionData("orders", initialOrders);
  }

  // 5. Seed Notifications
  const notifications = getCollectionData("notifications");
  if (notifications.length === 0) {
    const initialNotifications = [
      {
        id: "notif-1",
        type: "bill_request",
        tableNumber: 3,
        tableId: "table-3",
        message: "Mesa 3 solicitou o fechamento da conta!",
        read: false,
        createdAt: new Date().toISOString()
      }
    ];
    saveCollectionData("notifications", initialNotifications);
  }
}

// --- INITIALIZE REAL AND MOCK GLOBALS ---
const app = isDummy ? { _isSecondary: false, name: "[DEFAULT]" } : realInitializeApp(firebaseConfig);

export let analytics: any = null;
if (!isDummy && typeof window !== "undefined") {
  realIsSupported().then((supported) => {
    if (supported) {
      analytics = realGetAnalytics(app as any);
    }
  }).catch((err) => {
    console.warn("[Firebase Service] Analytics skipped or not supported:", err);
  });
}

const mockAuthObj = {
  _isSecondary: false,
  currentUser: null as any
};

export const auth = isDummy ? mockAuthObj : realGetAuth(app as any);

export const db: any = isDummy 
  ? { type: "firestore" }
  : (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
    ? realInitializeFirestore(app as any, { experimentalForceLongPolling: true }, firebaseConfig.firestoreDatabaseId)
    : realInitializeFirestore(app as any, { experimentalForceLongPolling: true })
  );

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const isPermissionError = 
    errMessage.includes("permission-denied") || 
    errMessage.includes("insufficient permissions") || 
    (error as any)?.code === "permission-denied";

  if (isPermissionError) {
    const errInfo: FirestoreErrorInfo = {
      error: errMessage,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData?.map((provider: any) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || []
      },
      operationType,
      path: path || "unknown"
    };
    const jsonStr = JSON.stringify(errInfo);
    console.error('Firestore Hardened Error: ', jsonStr);
    throw new Error(jsonStr);
  }
  
  throw error;
}


// Track callbacks for Auth state
const authCallbacks = new Set<(user: any) => void>();

function triggerAuthStateChanged() {
  const userJSON = localStorage.getItem("mock_current_user");
  let user: any = null;
  if (userJSON) {
    try {
      user = JSON.parse(userJSON);
    } catch {}
  }
  mockAuthObj.currentUser = user;
  authCallbacks.forEach(callback => {
    try {
      callback(user);
    } catch (err) {
      console.error(err);
    }
  });
}

// Helper to filter array elements like Firestore query
function applyQueryConstraints(collectionName: string, constraints: any[]): any[] {
  let items = getCollectionData(collectionName);
  
  // 1. Where filters
  for (const c of constraints) {
    if (c.type === "where") {
      const { field, op, val } = c;
      items = items.filter(item => {
        const itemVal = item[field];
        if (op === "==") return itemVal === val;
        if (op === "!=") return itemVal !== val;
        if (op === ">") return itemVal > val;
        if (op === "<") return itemVal < val;
        if (op === ">=") return itemVal >= val;
        if (op === "<=") return itemVal <= val;
        return true;
      });
    }
  }
  
  // 2. OrderBy clauses
  for (const c of constraints) {
    if (c.type === "orderBy") {
      const { field, direction } = c;
      items = [...items].sort((a, b) => {
        let valA = a[field];
        let valB = b[field];
        
        // Handle dates parsing gracefully
        if (typeof valA === "string" && !isNaN(Date.parse(valA))) {
          valA = new Date(valA).getTime();
          valB = new Date(valB).getTime();
        }
        
        if (valA < valB) return direction === "asc" ? -1 : 1;
        if (valA > valB) return direction === "asc" ? 1 : -1;
        return 0;
      });
    }
  }
  
  // 3. Limit constraints
  for (const c of constraints) {
    if (c.type === "limit") {
      items = items.slice(0, c.count);
    }
  }
  
  return items;
}

// --- CONDITIONAL EXPORTS ---

export function initializeApp(config: any, name?: string): any {
  if (isDummy) {
    return { _isSecondary: !!name, name: name || "[DEFAULT]" };
  } else {
    return realInitializeApp(config, name);
  }
}

export function getApp(name?: string): any {
  if (isDummy) {
    return { _isSecondary: !name, name: name || "[DEFAULT]" };
  } else {
    return realGetApp(name);
  }
}

export function getApps(): any[] {
  if (isDummy) {
    return [{ _isSecondary: false, name: "[DEFAULT]" }];
  } else {
    return realGetApps();
  }
}

export function getAuth(appRef?: any): any {
  if (isDummy) {
    return { _isSecondary: appRef?._isSecondary, currentUser: null };
  } else {
    return realGetAuth(appRef);
  }
}

// Firestore operations
export function doc(...args: any[]): any {
  if (isDummy) {
    let collectionName = "";
    let id = "";
    if (args[0]?.type === "collection") {
      collectionName = args[0].collectionName;
      id = args[1];
    } else {
      collectionName = args[1];
      id = args[2] || "mock_id_" + Math.random().toString(36).substring(2, 9);
    }
    return { type: "doc", collectionName, id };
  } else {
    return (realDoc as any).apply(null, args);
  }
}

export function collection(...args: any[]): any {
  if (isDummy) {
    const collectionName = args[1] || args[0]?.collectionName || "";
    return { type: "collection", collectionName };
  } else {
    const col = (realCollection as any).apply(null, args);
    if (col) {
      col._originalPath = args[1] || col.path || "";
    }
    return col;
  }
}

export async function getDoc(docRef: any): Promise<any> {
  if (isDummy) {
    const items = getCollectionData(docRef.collectionName);
    const item = items.find(i => i.id === docRef.id);
    return {
      exists: () => !!item,
      id: docRef.id,
      data: () => item
    };
  } else {
    const path = docRef.path || docRef.id || "";
    try {
      const snap = await realGetDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        if (path) {
          localStorage.setItem(`real_db_backup_${path}`, JSON.stringify(data));
        }
      }
      return snap;
    } catch (err: any) {
      console.warn("[Firebase Service] realGetDoc failed, analyzing error:", err.message);
      handleFirestoreError(err, OperationType.GET, path);
      
      const isOfflineError = 
        err.message?.includes("offline") || 
        err.message?.includes("unavailable") || 
        err.message?.includes("Failed to get document") ||
        err.code === "unavailable" ||
        err.code === "failed-precondition";

      if (isOfflineError) {
        console.log("[Firebase Service] Connection offline or slow. Attempting Firestore SDK cache fetch...");
        try {
          const cachedSnap = await realGetDocFromCache(docRef);
          if (cachedSnap.exists()) {
            console.log("[Firebase Service] Successfully retrieved active document from SDK cache.");
            return cachedSnap;
          }
        } catch (cacheErr: any) {
          console.warn("[Firebase Service] Firestore cache fetch failed:", cacheErr.message);
        }

        // Try local storage backup
        if (path) {
          const backupStr = localStorage.getItem(`real_db_backup_${path}`);
          if (backupStr) {
            try {
              const data = JSON.parse(backupStr);
              console.log("[Firebase Service] Successfully retrieved document from localStorage backup:", path);
              return {
                exists: () => true,
                id: docRef.id,
                ref: docRef,
                data: () => data
              };
            } catch (jsonErr) {
              console.error("[Firebase Service] Parse error of localStorage backup:", jsonErr);
            }
          }
        }

        // Catch-all profile fallback for Edinelson admins so they never get stuck on a blank loading screen
        if (path.startsWith("users/")) {
          const mockEmail = auth.currentUser?.email || "edinelsonept@gmail.com";
          console.warn("[Firebase Service] Offline user profile fallback initiated for:", mockEmail);
          return {
            exists: () => true,
            id: docRef.id,
            ref: docRef,
            data: () => ({
              uid: docRef.id,
              name: "Edinelson Damasceno",
              email: mockEmail,
              role: "admin",
              active: true,
              createdAt: new Date().toISOString()
            })
          };
        }
      }
      throw err;
    }
  }
}

export async function getDocFromServer(docRef: any): Promise<any> {
  if (isDummy) {
    return getDoc(docRef);
  } else {
    try {
      const snap = await realGetDocFromServer(docRef);
      const path = docRef.path || docRef.id;
      if (snap.exists() && path) {
        localStorage.setItem(`real_db_backup_${path}`, JSON.stringify(snap.data()));
      }
      return snap;
    } catch (err: any) {
      console.warn("[Firebase Service] getDocFromServer failed, falling back to cached/backup getDoc:", err.message);
      const path = docRef.path || docRef.id || "unknown";
      handleFirestoreError(err, OperationType.GET, path);
      return getDoc(docRef);
    }
  }
}

export async function getDocFromCache(docRef: any): Promise<any> {
  if (isDummy) {
    return getDoc(docRef);
  } else {
    try {
      return await realGetDocFromCache(docRef);
    } catch (err: any) {
      console.warn("[Firebase Service] getDocFromCache failed, falling back to general getDoc:", err.message);
      return getDoc(docRef);
    }
  }
}

export async function setDoc(docRef: any, data: any): Promise<any> {
  if (isDummy) {
    const collectionName = docRef.collectionName;
    const id = docRef.id;
    const items = getCollectionData(collectionName);
    const existingIndex = items.findIndex(i => i.id === id);
    const newItem = { id, ...data };
    
    if (existingIndex >= 0) {
      items[existingIndex] = newItem;
    } else {
      items.push(newItem);
    }
    saveCollectionData(collectionName, items);

    // Background sync to Supabase
    syncToSupabase(collectionName, id, newItem).catch(err => 
      console.warn("[Supabase Sync] Background sync failed:", err)
    );

    return;
  } else {
    const path = docRef.path || docRef.id;
    const collectionName = docRef.parent?.path || docRef.collectionName || "";
    const id = docRef.id;
    try {
      await realSetDoc(docRef, data);
      if (path) {
        localStorage.setItem(`real_db_backup_${path}`, JSON.stringify(data));
      }

      // Background sync to Supabase
      syncToSupabase(collectionName, id, data).catch(err => 
        console.warn("[Supabase Sync] Background sync failed:", err)
      );
    } catch (err: any) {
      console.warn("[Firebase Service] Web setDoc offline bypass, saving locally anyway:", err.message);
      if (path) {
        localStorage.setItem(`real_db_backup_${path}`, JSON.stringify(data));
      }

      // Try background sync anyway
      syncToSupabase(collectionName, id, data).catch(err => 
        console.warn("[Supabase Sync] Background sync failed:", err)
      );

      // If we are offline, let's allow it to pass gracefully for front-end continuation
      if (err.message?.includes("offline") || err.code === "unavailable") {
        return;
      }
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  }
}

export async function addDoc(collectionRef: any, data: any): Promise<any> {
  const collectionName = collectionRef.collectionName || collectionRef.path || "collection";
  if (isDummy) {
    const id = "mock_id_" + Math.random().toString(36).substring(2, 9);
    const items = getCollectionData(collectionName);
    const newItem = { id, ...data };
    
    items.push(newItem);
    saveCollectionData(collectionName, items);

    // Background sync to Supabase
    syncToSupabase(collectionName, id, newItem).catch(err => 
      console.warn("[Supabase Sync] Background sync failed:", err)
    );

    return { id, collectionName, type: "doc" };
  } else {
    try {
      const docAddedRef = await realAddDoc(collectionRef, data);
      const path = docAddedRef.path || `${collectionRef.path || "collection"}/${docAddedRef.id}`;
      const id = docAddedRef.id;
      const fullData = { id, ...data };
      localStorage.setItem(`real_db_backup_${path}`, JSON.stringify(fullData));

      // Background sync to Supabase
      syncToSupabase(collectionName, id, fullData).catch(err => 
        console.warn("[Supabase Sync] Background sync failed:", err)
      );

      return docAddedRef;
    } catch (err: any) {
      console.warn("[Firebase Service] addDoc offline exception fallback:", err.message);
      if (err.message?.includes("offline") || err.code === "unavailable") {
        const dummyId = "offline_id_" + Math.random().toString(36).substring(2, 9);
        const path = `${collectionRef.path || "collection"}/${dummyId}`;
        const fullData = { id: dummyId, ...data };
        localStorage.setItem(`real_db_backup_${path}`, JSON.stringify(fullData));

        // Background sync to Supabase
        syncToSupabase(collectionName, dummyId, fullData).catch(err => 
          console.warn("[Supabase Sync] Background sync failed:", err)
        );

        return { id: dummyId, path, type: "doc" };
      }
      const path = collectionRef.path || "collection_unknown";
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  }
}

export async function updateDoc(docRef: any, data: any): Promise<any> {
  const collectionName = docRef.collectionName || docRef.parent?.path || "";
  const id = docRef.id;
  if (isDummy) {
    const items = getCollectionData(collectionName);
    const existingIndex = items.findIndex(i => i.id === id);
    
    if (existingIndex >= 0) {
      const updatedItem = { ...items[existingIndex], ...data };
      items[existingIndex] = updatedItem;
      saveCollectionData(collectionName, items);

      // Background sync to Supabase
      syncToSupabase(collectionName, id, updatedItem).catch(err => 
        console.warn("[Supabase Sync] Background sync failed:", err)
      );
    }
    return;
  } else {
    const path = docRef.path || docRef.id;
    try {
      await realUpdateDoc(docRef, data);
      if (path) {
        let existing = {};
        const backupStr = localStorage.getItem(`real_db_backup_${path}`);
        if (backupStr) {
          try { existing = JSON.parse(backupStr); } catch {}
        }
        const updated = { ...existing, ...data };
        localStorage.setItem(`real_db_backup_${path}`, JSON.stringify(updated));

        // Background sync to Supabase
        syncToSupabase(collectionName, id, updated).catch(err => 
          console.warn("[Supabase Sync] Background sync failed:", err)
        );
      }
    } catch (err: any) {
      console.warn("[Firebase Service] updateDoc offline fallback active:", err.message);
      let updated = { ...data };
      if (path) {
        let existing = {};
        const backupStr = localStorage.getItem(`real_db_backup_${path}`);
        if (backupStr) {
          try { existing = JSON.parse(backupStr); } catch {}
        }
        updated = { ...existing, ...data };
        localStorage.setItem(`real_db_backup_${path}`, JSON.stringify(updated));
      }

      // Background sync to Supabase
      syncToSupabase(collectionName, id, updated).catch(err => 
        console.warn("[Supabase Sync] Background sync failed:", err)
      );

      if (err.message?.includes("offline") || err.code === "unavailable") {
        return;
      }
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }
}

export async function deleteDoc(docRef: any): Promise<any> {
  const collectionName = docRef.collectionName || docRef.parent?.path || "";
  const id = docRef.id;
  if (isDummy) {
    let items = getCollectionData(collectionName);
    
    items = items.filter(i => i.id !== id);
    saveCollectionData(collectionName, items);

    // Background sync deletion to Supabase
    syncToSupabase(collectionName, id, null, true).catch(err => 
      console.warn("[Supabase Sync] Background sync failed:", err)
    );

    return;
  } else {
    try {
      const res = await realDeleteDoc(docRef);

      // Background sync deletion to Supabase
      syncToSupabase(collectionName, id, null, true).catch(err => 
        console.warn("[Supabase Sync] Background sync failed:", err)
      );

      return res;
    } catch (err: any) {
      const path = docRef.path || docRef.id || "unknown";

      // Try background sync anyway
      syncToSupabase(collectionName, id, null, true).catch(err => 
        console.warn("[Supabase Sync] Background sync failed:", err)
      );

      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }
}

export function query(collectionRef: any, ...constraints: any[]): any {
  if (isDummy) {
    return { 
      type: "query", 
      collectionName: collectionRef.collectionName, 
      constraints 
    };
  } else {
    const q = (realQuery as any)(collectionRef, ...constraints);
    if (q) {
      q._originalPath = collectionRef._originalPath || collectionRef.path || "unknown";
    }
    return q;
  }
}

export function where(field: string, op: any, val: any): any {
  if (isDummy) {
    return { type: "where", field, op, val };
  } else {
    return realWhere(field, op as any, val);
  }
}

export function orderBy(field: string, direction: "asc" | "desc" = "asc"): any {
  if (isDummy) {
    return { type: "orderBy", field, direction };
  } else {
    return realOrderBy(field, direction);
  }
}

export function limit(count: number): any {
  if (isDummy) {
    return { type: "limit", count };
  } else {
    return realLimit(count);
  }
}

export async function getDocs(queryRef: any): Promise<any> {
  if (isDummy) {
    const collectionName = queryRef.collectionName;
    const constraints = queryRef.constraints || [];
    const items = applyQueryConstraints(collectionName, constraints);
    
    return {
      empty: items.length === 0,
      docs: items.map(item => ({
        id: item.id,
        data: () => item
      }))
    };
  } else {
    try {
      return await realGetDocs(queryRef);
    } catch (err: any) {
      const path = queryRef._originalPath || queryRef.path || "unknown";
      handleFirestoreError(err, OperationType.LIST, path);
    }
  }
}

export function onSnapshot(ref: any, callback: any): any {
  if (isDummy) {
    const collectionName = ref.collectionName;
    const isDoc = ref.type === "doc";
    
    const run = () => {
      if (isDoc) {
        const items = getCollectionData(collectionName);
        const item = items.find(i => i.id === ref.id);
        callback({
          exists: () => !!item,
          id: ref.id,
          data: () => item
        });
      } else {
        const constraints = ref.constraints || [];
        const items = applyQueryConstraints(collectionName, constraints);
        callback({
          empty: items.length === 0,
          docs: items.map(item => ({
            id: item.id,
            data: () => item
          }))
        });
      }
    };
    
    if (!listeners.has(collectionName)) {
      listeners.set(collectionName, new Set());
    }
    listeners.get(collectionName)!.add(run);
    
    // Initial async invoke
    setTimeout(run, 0);
    
    return () => {
      listeners.get(collectionName)?.delete(run);
    };
  } else {
    return realOnSnapshot(ref, callback, (error: any) => {
      const pathStr = ref._originalPath || ref.path || ref.type || "unknown";
      
      // Handle permission-denied transition states gracefully during logout/sign-out
      if (error && (error.code === 'permission-denied' || error.message?.includes('permission-denied') || error.message?.includes('permissions'))) {
        if (!auth.currentUser) {
          console.warn(`[Firestore onSnapshot Graceful Handle] Listener permissions revoked during sign-out transition for path:`, pathStr);
          return;
        }
      }
      
      console.error("[Firestore onSnapshot Error] Listener failed for path:", pathStr, "Error:", error);
    });
  }
}

// Auth operations
export function onAuthStateChanged(authRef: any, callback: (user: any) => void): any {
  if (isDummy) {
    const run = () => {
      const userJSON = localStorage.getItem("mock_current_user");
      if (userJSON) {
        try {
          const user = JSON.parse(userJSON);
          mockAuthObj.currentUser = user;
          callback(user);
        } catch {
          mockAuthObj.currentUser = null;
          callback(null);
        }
      } else {
        mockAuthObj.currentUser = null;
        callback(null);
      }
    };
    authCallbacks.add(callback);
    setTimeout(run, 0);
    return () => {
      authCallbacks.delete(callback);
    };
  } else {
    return realOnAuthStateChanged(authRef, callback);
  }
}

export async function signInWithEmailAndPassword(authRef: any, emailInput: string, passwordInput: string): Promise<any> {
  if (isDummy) {
    const email = emailInput.toLowerCase();
    const users = getCollectionData("users");
    const found = users.find(u => u.email === email);
    
    if (!found) {
      throw new Error("Usuário não encontrado.");
    }
    if (found.password && found.password !== passwordInput) {
      throw new Error("Senha incorreta.");
    }
    if (!found.active) {
      throw new Error("Sua conta está desativada no momento. Contate o Co-Master principal.");
    }
    
    const userObj = { uid: found.uid, email: found.email, displayName: found.name };
    localStorage.setItem("mock_current_user", JSON.stringify(userObj));
    triggerAuthStateChanged();
    return { user: userObj };
  } else {
    const lowercaseEmail = emailInput.toLowerCase();
    if (lowercaseEmail === "edinelsonept@gmail.com" && passwordInput === "@Coelho60") {
      try {
        return await realSignInWithEmailAndPassword(authRef, emailInput, passwordInput);
      } catch (err: any) {
        if (
          err.code === "auth/user-not-found" || 
          err.message?.includes("not found") || 
          err.code === "auth/invalid-credential" || 
          err.message?.includes("invalid-credential") ||
          err.code === "auth/invalid-email"
        ) {
          try {
            console.log("[Firebase Service] Auto-creating Co-Master account on demand...");
            const credential = await realCreateUserWithEmailAndPassword(authRef, emailInput, passwordInput);
            const user = credential.user;
            
            // Create user document in Firestore to register the Co-Master details
            try {
              await realSetDoc(realDoc(db, "users", user.uid), {
                uid: user.uid,
                name: "Edinelson Damasceno",
                email: lowercaseEmail,
                role: "admin",
                active: true,
                createdAt: new Date().toISOString()
              });
              console.log("[Firebase Service] Co-Master profile created in Firestore successfully!");
            } catch (firestoreErr) {
              console.warn("[Firebase Service] Firestore registration failed:", firestoreErr);
            }
            return credential;
          } catch (createErr) {
            console.log("[Firebase Service] Auth user is already in use (handled gracefully).");
            throw err;
          }
        }
        throw err;
      }
    }
    return realSignInWithEmailAndPassword(authRef, emailInput, passwordInput);
  }
}

export async function ensureMasterAccountExists(): Promise<string> {
  if (isDummy) {
    const email = "edinelsonept@gmail.com";
    const password = "@Coelho60";
    const users = getCollectionData("users");
    const found = users.find(u => u.email === email);
    if (!found) {
      const newUsers = [
        ...users,
        {
          uid: "mock_master_admin_id",
          name: "Edinelson Damasceno",
          email: email,
          password: password,
          role: "admin",
          active: true,
          createdAt: new Date().toISOString()
        }
      ];
      saveCollectionData("users", newUsers);
      return "created_mock";
    }
    return "already_exists_mock";
  }

  const email = "edinelsonept@gmail.com";
  const password = "@Coelho60";
  try {
    const secondaryAppName = `MasterSetup-${Date.now()}`;
    const secondaryApp = realInitializeApp(firebaseConfig, secondaryAppName);
    
    // 1. Initialize Firestore first so auth state change handlers register early
    const secondaryDb = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
      ? realInitializeFirestore(secondaryApp as any, { experimentalForceLongPolling: true }, firebaseConfig.firestoreDatabaseId)
      : realInitializeFirestore(secondaryApp as any, { experimentalForceLongPolling: true });

    const secondaryAuth = realGetAuth(secondaryApp);
    
    // 2. Create the user
    const cred = await realCreateUserWithEmailAndPassword(secondaryAuth, email, password);
    const user = cred.user;
    
    // 3. Retrieve ID Token and add small propagation delay to allow Firestore connection state to synchronize
    await user.getIdToken(true);
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 4. Register details in Firestore with up to 3 retries for propagation safety
    let lastError: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await realSetDoc(realDoc(secondaryDb, "users", user.uid), {
          uid: user.uid,
          name: "Edinelson Damasceno",
          email: email,
          role: "admin",
          active: true,
          createdAt: new Date().toISOString()
        });
        console.log(`[Master Setup] Co-Master account created and registered successfully on attempt ${attempt}.`);
        lastError = null;
        break;
      } catch (err: any) {
        lastError = err;
        console.warn(`[Master Setup] Write attempt ${attempt} failed:`, err.message || err);
        if (attempt < 3) {
          await user.getIdToken(true);
          await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
        }
      }
    }
    
    if (lastError) {
      throw lastError;
    }
    
    await realSignOut(secondaryAuth);
    return "created";
  } catch (err: any) {
    if (err.code === "auth/email-already-in-use" || err.message?.includes("already-in-use")) {
      console.log("[Master Setup] Co-Master account already exists in Auth. (Document will auto-heal upon successful login if missing).");
      return "already_exists";
    }
    console.warn("[Master Setup] Handled exception checking/ensuring master account:", err);
    return `error: ${err.message || err}`;
  }
}

export async function createUserWithEmailAndPassword(authRef: any, emailInput: string, passwordInput: string): Promise<any> {
  if (isDummy) {
    const email = emailInput.toLowerCase();
    const users = getCollectionData("users");
    const found = users.find(u => u.email === email);
    
    if (found) {
      throw new Error("Este e-mail de login já está em uso.");
    }
    
    const uid = "mock_uid_" + Math.random().toString(36).substring(2, 9);
    const userObj = { uid, email, displayName: email.split("@")[0] };
    
    // Create secondary app avoids changing session of root Admin user when calling staff invites
    const isSecondary = authRef?._isSecondary;
    if (!isSecondary) {
      localStorage.setItem("mock_current_user", JSON.stringify(userObj));
      setTimeout(triggerAuthStateChanged, 0);
    }
    
    return { user: userObj };
  } else {
    return realCreateUserWithEmailAndPassword(authRef, emailInput, passwordInput);
  }
}

export async function signOut(authRef: any): Promise<any> {
  if (isDummy) {
    const isSecondary = authRef?._isSecondary;
    if (!isSecondary) {
      localStorage.removeItem("mock_current_user");
      triggerAuthStateChanged();
    }
    return;
  } else {
    return realSignOut(authRef);
  }
}

export async function signInWithPopup(authRef: any, provider: any): Promise<any> {
  if (isDummy) {
    // Return mock user login with simple details
    const email = "google_" + Math.floor(Math.random() * 900+100) + "@gmail.com";
    const uid = "mock_google_uid_" + Math.random().toString(36).substring(2, 9);
    const userObj = { uid, email, displayName: "Cliente Google" };
    
    localStorage.setItem("mock_current_user", JSON.stringify(userObj));
    triggerAuthStateChanged();
    return { user: userObj };
  } else {
    return realSignInWithPopup(authRef, provider);
  }
}

export async function sendPasswordResetEmail(authRef: any, email: string): Promise<any> {
  if (isDummy) {
    // Return immediately to mock recovery dispatch
    return;
  } else {
    return realSendPasswordResetEmail(authRef, email);
  }
}

export class GoogleAuthProvider {
  static PROVIDER_ID = "google.com";
}

/**
 * Bulk exports all current active records and initializes configuration parameters in Firebase Firestore.
 */
export async function syncAllCollectionsToFirebase(): Promise<{ successCount: number; errors: string[] }> {
  let successCount = 0;
  const errors: string[] = [];

  // 1. Prepare configuration data
  const defaultSettings = {
    id: "general",
    restaurantName: "Delícias do Mar",
    restaurantAddress: "Orla da Praia, CEP 68447-000, Salinópolis - PA",
    serviceFeePercentage: 10,
    contactPhone: "(91) 98765-4321",
    wifiPassword: "delicias_wifi_123",
    activeOpenHours: "10:00 - 23:00",
    allowTableSelfCheckout: true,
    updatedAt: new Date().toISOString()
  };

  // 2. Collections to sync
  const collectionsList = ["users", "menuItems", "tables", "orders", "notifications", "reviews"];

  if (isDummy) {
    // If in simulation mode, sync everything into localStorage's mock database
    try {
      // Seed configurations
      const configKey = `mock_db_collection_configurations`;
      localStorage.setItem(configKey, JSON.stringify([defaultSettings]));
      successCount++;

      // Seed all other collections with default items if they are empty
      for (const col of collectionsList) {
        const mockKey = `mock_db_collection_${col}`;
        const existingData = getCollectionData(col);
        if (existingData.length === 0) {
          let seededItems: any[] = [];
          if (col === "menuItems") {
            seededItems = INITIAL_MENU.map((item, idx) => ({
              ...item,
              id: `menu-item-${idx}`,
              available: true,
              createdAt: new Date().toISOString()
            }));
          } else if (col === "tables") {
            seededItems = [
              { id: "table-1", number: 1, name: "Beira Mar (Sombra)", status: "active", occupants: 4, totalAmount: 141.0, waiterId: "mock_waiter_id_1", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
              { id: "table-2", number: 2, name: "Mesa VIP Interna", status: "available", occupants: 0, totalAmount: 0.0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
              { id: "table-3", number: 3, name: "VIP Família", status: "bill_requested", occupants: 2, totalAmount: 85.0, waiterId: "mock_waiter_id_1", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
            ];
          } else if (col === "users") {
            seededItems = [
              { uid: "mock_master_admin_id", name: "Edinelson Damasceno", email: "edinelsonept@gmail.com", role: "admin", active: true, createdAt: new Date().toISOString() },
              { uid: "mock_waiter_id_1", name: "Carlos Garçom", email: "garcom@deliciasdomar.com", role: "waiter", active: true, createdAt: new Date().toISOString() }
            ];
          }
          if (seededItems.length > 0) {
            saveCollectionData(col, seededItems);
            successCount += seededItems.length;
          }
        } else {
          // If already has items, save them again to trigger any re-renders
          saveCollectionData(col, existingData);
          successCount += existingData.length;
        }
      }
    } catch (err: any) {
      errors.push(`Erro na simulação do Mock: ${err.message || err}`);
    }
    return { successCount, errors };
  }

  // Real Firebase synchronization mode!
  try {
    console.log("[Firebase Sync] Beginning synchronization of all system collections and configuration settings...");

    // 2.a. Synchronize/seed Configurations
    try {
      const configDocRef = realDoc(db, "configurations", "general");
      await realSetDoc(configDocRef, defaultSettings);
      localStorage.setItem("real_db_backup_configurations/general", JSON.stringify(defaultSettings));
      successCount++;
    } catch (err: any) {
      console.error("[Firebase Sync] Config settings sync failed:", err);
      errors.push(`Configurações: ${err.message || err}`);
    }

    // 2.b. Synchronize/seed other collections
    for (const col of collectionsList) {
      try {
        const mockKey = `mock_db_collection_${col}`;
        const localDataStr = localStorage.getItem(mockKey);
        
        let itemsToSync: any[] = [];
        if (localDataStr) {
          try {
            const parsed = JSON.parse(localDataStr);
            if (Array.isArray(parsed)) {
              itemsToSync = parsed;
            }
          } catch {}
        }

        // Standard default fallbacks to ensure premium rich state if they are completely blank
        if (col === "menuItems" && itemsToSync.length === 0) {
          itemsToSync = INITIAL_MENU.map((item, idx) => ({
            ...item,
            id: `menu-item-${idx}`,
            available: true,
            createdAt: new Date().toISOString()
          }));
        } else if (col === "tables" && itemsToSync.length === 0) {
          itemsToSync = [
            { id: "table-1", number: 1, name: "Beira Mar (Sombra)", status: "active", occupants: 4, totalAmount: 141.0, waiterId: "edinelsonept@gmail.com", createdAt: new Date(Date.now() - 3600000).toISOString(), updatedAt: new Date().toISOString() },
            { id: "table-2", number: 2, name: "Mesa VIP Interna", status: "available", occupants: 0, totalAmount: 0.0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { id: "table-3", number: 3, name: "VIP Família", status: "bill_requested", occupants: 2, totalAmount: 85.0, waiterId: "edinelsonept@gmail.com", createdAt: new Date(Date.now() - 7200000).toISOString(), updatedAt: new Date().toISOString() },
            { id: "table-4", number: 4, name: "Salão Principal 1", status: "available", occupants: 0, totalAmount: 0.0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { id: "table-5", number: 5, name: "Mesa Casal", status: "active", occupants: 2, totalAmount: 0.0, waiterId: "edinelsonept@gmail.com", createdAt: new Date(Date.now() - 1800000).toISOString(), updatedAt: new Date().toISOString() }
          ];
        }

        // Send items to Firestore
        for (const item of itemsToSync) {
          const docId = item.id || item.uid;
          if (!docId) continue;
          
          const docRef = realDoc(db, col, docId);
          
          // Clean sensitive passwords before saving profiles to database
          const cleanedItem = { ...item };
          if (cleanedItem.password) {
            delete cleanedItem.password;
          }

          await realSetDoc(docRef, cleanedItem);
          
          // Backup locally for offline fallback
          localStorage.setItem(`real_db_backup_${col}/${docId}`, JSON.stringify(cleanedItem));
          successCount++;
        }
      } catch (colErr: any) {
        console.error(`[Firebase Sync] Error syncing collection ${col}:`, colErr);
        errors.push(`Coleção ${col}: ${colErr.message || colErr}`);
      }
    }
  } catch (err: any) {
    console.error("[Firebase Sync] Fatal sync exception:", err);
    errors.push(`Geral: ${err.message || err}`);
  }

  return { successCount, errors };
}

export default app;
