import { createClient } from "@supabase/supabase-js";

// Retrieve environment variables
const firebaseSyncUrl = import.meta.env.VITE_FIREBASE_SYNC_URL || "";
const firebaseSyncAnonKey = import.meta.env.VITE_FIREBASE_SYNC_ANON_KEY || "";

// Initialize Firebase Sync Client (using PostgreSQL under the hood)
export const firebaseSyncClient = (firebaseSyncUrl && firebaseSyncAnonKey)
  ? createClient(firebaseSyncUrl, firebaseSyncAnonKey)
  : null;

/**
 * Checks if Firebase Sync connection credentials have been populated in the environment.
 */
export function isFirebaseSyncConfigured(): boolean {
  return !!firebaseSyncClient;
}

/**
 * Generic sync helper to mirror Firestore modifications (dummy or real) inside Firebase Sync.
 * Supports both:
 * 1. A fallback, zero-configuration generic table `firestore_sync` which stores the full JSON as-is.
 * 2. Dedicated named tables (mapped collections) with automatic standard schema alignment.
 * 
 * @param collectionName Firestore collection name (e.g. 'users', 'orders').
 * @param id Document id.
 * @param data Data payload.
 * @param isDeleted True if deletion, false otherwise.
 */
export async function syncToFirebaseSync(
  collectionName: string,
  id: string,
  data: any,
  isDeleted: boolean = false
): Promise<{ success: boolean; error?: any }> {
  if (!firebaseSyncClient) {
    // Silent skip if Firebase Sync is not configured
    return { success: false, error: "Firebase Sync not configured in .env" };
  }

  // Map Firestore collection names to Firebase Sync tables
  // Standard conversion from camelCase like 'menuItems' to snake_case 'menu_items'
  const tableName = collectionName === "menuItems" ? "menu_items" : collectionName;

  try {
    console.log(`[Firebase Sync] Processing sync for list: ${collectionName} (table: ${tableName}), ID: ${id}, Deletion: ${isDeleted}`);

    if (isDeleted) {
      // 1. Delete from robust generic table
      await firebaseSyncClient
        .from("firestore_sync")
        .delete()
        .eq("collection", collectionName)
        .eq("id", id);

      // 2. Try deleting from specific table (may fail gracefully if table is not created)
      try {
        await firebaseSyncClient
          .from(tableName)
          .delete()
          .eq("id", id);
      } catch (tableErr) {
        console.warn(`[Firebase Sync] Deletion failed on specific table '${tableName}' (probably not created in Firebase Sync yet):`, tableErr);
      }

      return { success: true };
    }

    // Prepare content data for insertion
    // Clean timestamps/nulls to be compatible with SQL
    const cleanedData = { ...data };
    if (cleanedData.id === undefined) {
      cleanedData.id = id;
    }

    // Convert any Date/Timestamps to ISO string format for SQL storage
    for (const key of Object.keys(cleanedData)) {
      const val = cleanedData[key];
      if (val && typeof val === "object" && val.seconds !== undefined) {
        // Firestore timestamp conversion
        cleanedData[key] = new Date(val.seconds * 1000).toISOString();
      } else if (val instanceof Date) {
        cleanedData[key] = val.toISOString();
      }
    }

    // Step A: Sync to the universal generic 'firestore_sync' table (HIGHLY ROBUST)
    // Always works if the simple generic table schema exists:
    // CREATE TABLE firestore_sync (id VARCHAR, collection VARCHAR, data JSONB, updated_at TIMESTAMP, PRIMARY KEY(collection, id))
    const { error: genericErr } = await firebaseSyncClient
      .from("firestore_sync")
      .upsert({
        id: id,
        collection: collectionName,
        data: cleanedData,
        updated_at: new Date().toISOString()
      }, { onConflict: "collection,id" });

    if (genericErr) {
      console.warn(`[Firebase Sync] Warning: Unable to save to 'firestore_sync' generic table. Error: ${genericErr.message}. Make sure to deploy SQL instructions.`);
    }

    // Step B: Sync to the specific table mapping (e.g. users, orders, tables, etc.)
    // We construct a flat row representation based on expected columns.
    const specificRow: any = { id };

    if (tableName === "users") {
      specificRow.name = cleanedData.name || null;
      specificRow.email = cleanedData.email || null;
      specificRow.role = cleanedData.role || "customer";
      specificRow.active = cleanedData.active !== undefined ? cleanedData.active : true;
      specificRow.created_at = cleanedData.createdAt || new Date().toISOString();
    } else if (tableName === "menu_items") {
      specificRow.name = cleanedData.name || null;
      specificRow.price = cleanedData.price || 0;
      specificRow.category = cleanedData.category || null;
      specificRow.description = cleanedData.description || null;
      specificRow.image = cleanedData.image || null;
      specificRow.available = cleanedData.available !== undefined ? cleanedData.available : true;
      specificRow.created_at = cleanedData.createdAt || new Date().toISOString();
    } else if (tableName === "tables") {
      specificRow.number = cleanedData.number || 0;
      specificRow.name = cleanedData.name || null;
      specificRow.status = cleanedData.status || "idle";
      specificRow.occupants = cleanedData.occupants || 0;
      specificRow.total_amount = cleanedData.totalAmount || 0;
      specificRow.waiter_id = cleanedData.waiterId || null;
      specificRow.created_at = cleanedData.createdAt || new Date().toISOString();
      specificRow.updated_at = cleanedData.updatedAt || new Date().toISOString();
    } else if (tableName === "orders") {
      specificRow.table_id = cleanedData.tableId || null;
      specificRow.customer_id = cleanedData.customerId || null;
      specificRow.items = cleanedData.items || [];
      specificRow.total = cleanedData.total || 0;
      specificRow.status = cleanedData.status || "pending";
      specificRow.waiter_id = cleanedData.waiterId || null;
      specificRow.created_at = cleanedData.createdAt || new Date().toISOString();
    } else if (tableName === "notifications") {
      specificRow.type = cleanedData.type || null;
      specificRow.table_number = cleanedData.tableNumber || 0;
      specificRow.table_id = cleanedData.tableId || null;
      specificRow.message = cleanedData.message || null;
      specificRow.read = cleanedData.read !== undefined ? cleanedData.read : false;
      specificRow.created_at = cleanedData.createdAt || new Date().toISOString();
    } else if (tableName === "reviews") {
      specificRow.order_id = cleanedData.orderId || null;
      specificRow.customer_id = cleanedData.customerId || null;
      specificRow.customer_name = cleanedData.customerName || null;
      specificRow.rating = cleanedData.rating || 5;
      specificRow.comment = cleanedData.comment || null;
      specificRow.created_at = cleanedData.createdAt || new Date().toISOString();
    } else {
      // Direct pass for any unmapped table fields
      Object.assign(specificRow, cleanedData);
    }

    // Upsert into individual SQL tables in Firebase Sync
    const { error: specificErr } = await firebaseSyncClient
      .from(tableName)
      .upsert(specificRow, { onConflict: "id" });

    if (specificErr) {
      console.warn(`[Firebase Sync] Warning: Unable to save to specific table '${tableName}'. Error: ${specificErr.message}. This is normal if the table hasn't been created yet.`);
    }

    return { success: !genericErr || !specificErr };
  } catch (err: any) {
    console.error("[Firebase Sync] Crash during sync execution:", err);
    return { success: false, error: err };
  }
}

/**
 * Bulk exports all current active records from local storage or real Firebase into Firebase Sync.
 * Helpful for feeding the Firebase Sync instance in one click!
 */
export async function syncAllCollectionsToFirebaseSync(): Promise<{ successCount: number; errors: string[] }> {
  let successCount = 0;
  const errors: string[] = [];

  if (!firebaseSyncClient) {
    return { successCount: 0, errors: ["Firebase Sync is not configured yet."] };
  }

  const collections = ["users", "menuItems", "tables", "orders", "notifications", "reviews"];

  for (const col of collections) {
    try {
      // Grab all local mock records first to sync them up
      const mockKey = `mock_db_collection_${col}`;
      const localDataStr = localStorage.getItem(mockKey);
      if (localDataStr) {
        const items = JSON.parse(localDataStr);
        if (Array.isArray(items)) {
          for (const item of items) {
            const { success, error } = await syncToFirebaseSync(col, item.id || item.uid, item);
            if (success) {
              successCount++;
            } else if (error) {
              errors.push(`Table ${col} ID ${item.id || item.uid}: ${error.message || error}`);
            }
          }
        }
      }
    } catch (err: any) {
      errors.push(`Collection ${col}: ${err.message || err}`);
    }
  }

  return { successCount, errors };
}

/**
 * SQL snippet instructions to create both the generic and structural relational tables in Firebase Sync SQL editor.
 */
export const FIREBASE_SYNC_SQL_INSTRUCTIONS = `-- SQL SETUP SCHEMA & ROW LEVEL SECURITY (RLS) FOR FIREBASE SYNC EDITOR
-- Copy and paste this into SQL Editor to configure robust RLS security.

-- Drop old policies to avoid duplicates or overlaps
DROP POLICY IF EXISTS "Allow public full access" ON firestore_sync;
DROP POLICY IF EXISTS "Allow public full access" ON users;
DROP POLICY IF EXISTS "Allow public full access" ON menu_items;
DROP POLICY IF EXISTS "Allow public full access" ON tables;
DROP POLICY IF EXISTS "Allow public full access" ON orders;
DROP POLICY IF EXISTS "Allow public full access" ON notifications;
DROP POLICY IF EXISTS "Allow public full access" ON reviews;

-- Create tables if they do not exist
-- 1. Universal Zero-Config Fallback Table
CREATE TABLE IF NOT EXISTS firestore_sync (
  id VARCHAR(255) NOT NULL,
  collection VARCHAR(255) NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (collection, id)
);

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255),
  role VARCHAR(50),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Menu Items Table
CREATE TABLE IF NOT EXISTS menu_items (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255),
  price NUMERIC,
  category VARCHAR(100),
  description TEXT,
  image TEXT,
  available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tables Status
CREATE TABLE IF NOT EXISTS tables (
  id VARCHAR(255) PRIMARY KEY,
  number INTEGER,
  name VARCHAR(255),
  status VARCHAR(100),
  occupants INTEGER,
  total_amount NUMERIC,
  waiter_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(255) PRIMARY KEY,
  table_id VARCHAR(255),
  customer_id VARCHAR(255), -- Added to support customer-specific RLS
  items JSONB,
  total NUMERIC,
  status VARCHAR(100),
  waiter_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure customer_id column exists if table already existed without it
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id VARCHAR(255);

-- 6. Notifications (Real-time updates)
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(255) PRIMARY KEY,
  type VARCHAR(100),
  table_number INTEGER,
  table_id VARCHAR(255),
  message TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Reviews Table
CREATE TABLE IF NOT EXISTS reviews (
  id VARCHAR(255) PRIMARY KEY,
  customer_name VARCHAR(255),
  customer_id VARCHAR(255), -- Added to support customer-specific RLS
  order_id VARCHAR(255),    -- Added to support order association RLS
  rating INTEGER,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure customer_id and order_id exist if table already existed without them
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS customer_id VARCHAR(255);
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS order_id VARCHAR(255);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE firestore_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;


-- =========================================================================
-- ROW LEVEL SECURITY POLICIES DEFINITIONS
-- =========================================================================

-- -------------------------------------------------------------------------
-- TABLE: USERS (Políticas de Usuários)
-- -------------------------------------------------------------------------
-- Permite que usuários autenticados gerenciem seus próprios perfis, ou que staff acesse todos.
DROP POLICY IF EXISTS "users_select_policy" ON users;
CREATE POLICY "users_select_policy" ON users FOR SELECT 
USING (
  auth.uid()::text = id 
  OR EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid()::text AND u.role IN ('admin', 'waiter')
  )
);

DROP POLICY IF EXISTS "users_insert_policy" ON users;
CREATE POLICY "users_insert_policy" ON users FOR INSERT 
WITH CHECK (
  auth.uid()::text = id
);

DROP POLICY IF EXISTS "users_update_policy" ON users;
CREATE POLICY "users_update_policy" ON users FOR UPDATE 
USING (
  auth.uid()::text = id 
  OR EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid()::text AND u.role = 'admin'
  )
)
WITH CHECK (
  auth.uid()::text = id 
  OR EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid()::text AND u.role = 'admin'
  )
);

DROP POLICY IF EXISTS "users_delete_policy" ON users;
CREATE POLICY "users_delete_policy" ON users FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid()::text AND u.role = 'admin'
  )
);


-- -------------------------------------------------------------------------
-- TABLE: MENU_ITEMS (Políticas de Itens do Cardápio)
-- -------------------------------------------------------------------------
-- Cardápio público para leitura (SELECT), mas edição restrita a administradores.
DROP POLICY IF EXISTS "menu_items_select_policy" ON menu_items;
CREATE POLICY "menu_items_select_policy" ON menu_items FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "menu_items_modify_policy" ON menu_items;
CREATE POLICY "menu_items_modify_policy" ON menu_items FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid()::text AND u.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid()::text AND u.role = 'admin'
  )
);


-- -------------------------------------------------------------------------
-- TABLE: TABLES (Políticas de Mesas)
-- -------------------------------------------------------------------------
-- Qualquer pessoa pode ver o status das mesas (SELECT), mas modificações exigem login autenticado.
DROP POLICY IF EXISTS "tables_select_policy" ON tables;
CREATE POLICY "tables_select_policy" ON tables FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "tables_modify_policy" ON tables;
CREATE POLICY "tables_modify_policy" ON tables FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');


-- -------------------------------------------------------------------------
-- TABLE: ORDERS (Políticas de Pedidos)
-- -------------------------------------------------------------------------
-- Clientes podem ver e criar seus próprios pedidos. Staff (admin/garçom) pode gerenciar tudo.
DROP POLICY IF EXISTS "orders_select_policy" ON orders;
CREATE POLICY "orders_select_policy" ON orders FOR SELECT 
USING (
  customer_id = auth.uid()::text 
  OR EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid()::text AND u.role IN ('admin', 'waiter')
  )
);

DROP POLICY IF EXISTS "orders_insert_policy" ON orders;
CREATE POLICY "orders_insert_policy" ON orders FOR INSERT 
WITH CHECK (
  customer_id = auth.uid()::text 
  OR EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid()::text AND u.role IN ('admin', 'waiter')
  )
);

DROP POLICY IF EXISTS "orders_update_policy" ON orders;
CREATE POLICY "orders_update_policy" ON orders FOR UPDATE 
USING (
  (customer_id = auth.uid()::text AND status = 'pending') 
  OR EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid()::text AND u.role IN ('admin', 'waiter')
  )
)
WITH CHECK (
  (customer_id = auth.uid()::text AND status = 'pending') 
  OR EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid()::text AND u.role IN ('admin', 'waiter')
  )
);

DROP POLICY IF EXISTS "orders_delete_policy" ON orders;
CREATE POLICY "orders_delete_policy" ON orders FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid()::text AND u.role = 'admin'
  )
);


-- -------------------------------------------------------------------------
-- TABLE: NOTIFICATIONS (Políticas de Notificações / Chamados)
-- -------------------------------------------------------------------------
-- Qualquer usuário logado pode disparar alertas (ex: chamar garçom). Apenas staff pode ler/modificar.
DROP POLICY IF EXISTS "notifications_select_policy" ON notifications;
CREATE POLICY "notifications_select_policy" ON notifications FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid()::text AND u.role IN ('admin', 'waiter')
  )
);

DROP POLICY IF EXISTS "notifications_insert_policy" ON notifications;
CREATE POLICY "notifications_insert_policy" ON notifications FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "notifications_modify_policy" ON notifications;
CREATE POLICY "notifications_modify_policy" ON notifications FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid()::text AND u.role IN ('admin', 'waiter')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid()::text AND u.role IN ('admin', 'waiter')
  )
);


-- -------------------------------------------------------------------------
-- TABLE: REVIEWS (Políticas de Avaliações)
-- -------------------------------------------------------------------------
-- Avaliações são de leitura pública. Apenas o autor pode escrever/editar sua avaliação.
DROP POLICY IF EXISTS "reviews_select_policy" ON reviews;
CREATE POLICY "reviews_select_policy" ON reviews FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "reviews_insert_policy" ON reviews;
CREATE POLICY "reviews_insert_policy" ON reviews FOR INSERT 
WITH CHECK (
  customer_id = auth.uid()::text 
  OR EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid()::text AND u.role IN ('admin', 'waiter')
  )
);

DROP POLICY IF EXISTS "reviews_modify_policy" ON reviews;
CREATE POLICY "reviews_modify_policy" ON reviews FOR ALL 
USING (
  customer_id = auth.uid()::text 
  OR EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid()::text AND u.role = 'admin'
  )
)
WITH CHECK (
  customer_id = auth.uid()::text 
  OR EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid()::text AND u.role = 'admin'
  )
);


-- -------------------------------------------------------------------------
-- TABLE: FIRESTORE_SYNC (Políticas de Sincronização Geral Fallback)
-- -------------------------------------------------------------------------
-- Controle centralizado no JSON sincronizado
DROP POLICY IF EXISTS "firestore_sync_policy" ON firestore_sync;
CREATE POLICY "firestore_sync_policy" ON firestore_sync FOR ALL 
USING (
  id = auth.uid()::text 
  OR (data->>'customerId') = auth.uid()::text 
  OR collection IN ('menuItems', 'reviews')
  OR EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid()::text AND u.role IN ('admin', 'waiter')
  )
)
WITH CHECK (
  id = auth.uid()::text 
  OR (data->>'customerId') = auth.uid()::text 
  OR collection IN ('menuItems', 'reviews')
  OR EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid()::text AND u.role IN ('admin', 'waiter')
  )
);
`;