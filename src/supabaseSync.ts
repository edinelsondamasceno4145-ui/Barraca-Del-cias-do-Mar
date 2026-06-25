import { createClient } from "@supabase/supabase-js";

// Retrieve environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// Initialize Supabase Client
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Checks if Supabase connection credentials have been populated in the environment.
 */
export function isSupabaseConfigured(): boolean {
  return !!supabase;
}

/**
 * Generic sync helper to mirror Firestore modifications (dummy or real) inside Supabase.
 * Supports both:
 * 1. A fallback, zero-configuration generic table `firestore_sync` which stores the full JSON as-is.
 * 2. Dedicated named tables (mapped collections) with automatic standard schema alignment.
 * 
 * @param collectionName Firestore collection name (e.g. 'users', 'orders').
 * @param id Document id.
 * @param data Data payload.
 * @param isDeleted True if deletion, false otherwise.
 */
export async function syncToSupabase(
  collectionName: string,
  id: string,
  data: any,
  isDeleted: boolean = false
): Promise<{ success: boolean; error?: any }> {
  if (!supabase) {
    // Silent skip if Supabase is not configured
    return { success: false, error: "Supabase not configured in .env" };
  }

  // Map Firestore collection names to Supabase tables
  // Standard conversion from camelCase like 'menuItems' to snake_case 'menu_items'
  const tableName = collectionName === "menuItems" ? "menu_items" : collectionName;

  try {
    console.log(`[Supabase Sync] Processing sync for list: ${collectionName} (table: ${tableName}), ID: ${id}, Deletion: ${isDeleted}`);

    if (isDeleted) {
      // 1. Delete from robust generic table
      await supabase
        .from("firestore_sync")
        .delete()
        .eq("collection", collectionName)
        .eq("id", id);

      // 2. Try deleting from specific table (may fail gracefully if table is not created)
      try {
        await supabase
          .from(tableName)
          .delete()
          .eq("id", id);
      } catch (tableErr) {
        console.warn(`[Supabase Sync] Deletion failed on specific table '${tableName}' (probably not created in Supabase yet):`, tableErr);
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
    const { error: genericErr } = await supabase
      .from("firestore_sync")
      .upsert({
        id: id,
        collection: collectionName,
        data: cleanedData,
        updated_at: new Date().toISOString()
      }, { onConflict: "collection,id" });

    if (genericErr) {
      console.warn(`[Supabase Sync] Warning: Unable to save to 'firestore_sync' generic table. Error: ${genericErr.message}. Make sure to deploy SQL instructions.`);
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
      specificRow.customer_name = cleanedData.customerName || null;
      specificRow.rating = cleanedData.rating || 5;
      specificRow.comment = cleanedData.comment || null;
      specificRow.created_at = cleanedData.createdAt || new Date().toISOString();
    } else {
      // Direct pass for any unmapped table fields
      Object.assign(specificRow, cleanedData);
    }

    // Upsert into individual SQL tables in Supabase
    const { error: specificErr } = await supabase
      .from(tableName)
      .upsert(specificRow, { onConflict: "id" });

    if (specificErr) {
      console.warn(`[Supabase Sync] Warning: Unable to save to specific table '${tableName}'. Error: ${specificErr.message}. This is normal if the table hasn't been created yet.`);
    }

    return { success: !genericErr || !specificErr };
  } catch (err: any) {
    console.error("[Supabase Sync] Crash during sync execution:", err);
    return { success: false, error: err };
  }
}

/**
 * Bulk exports all current active records from local storage or real Firebase into Supabase.
 * Helpful for feeding the Supabase instance in one click!
 */
export async function syncAllCollectionsToSupabase(): Promise<{ successCount: number; errors: string[] }> {
  let successCount = 0;
  const errors: string[] = [];

  if (!supabase) {
    return { successCount: 0, errors: ["Supabase is not configured yet."] };
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
            const { success, error } = await syncToSupabase(col, item.id || item.uid, item);
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
 * SQL snippet instructions to create both the generic and structural relational tables in Supabase SQL editor.
 */
export const SUPABASE_SQL_INSTRUCTIONS = `-- SQL SETUP SCHEMA FOR SUPABASE EDITOR
-- Copy and paste this into SQL Editor in https://database.supabase.com to create structural tables for instant syncing.

-- 1. Universal Zero-Config Fallback Table
CREATE TABLE IF NOT EXISTS firestore_sync (
  id VARCHAR(255) NOT NULL,
  collection VARCHAR(255) NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (collection, id)
);

-- Enable Row Level Security (RLS) or public accessibility depending on desires
ALTER TABLE firestore_sync ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public full access" ON firestore_sync FOR ALL USING (true) WITH CHECK (true);

-- 2. Specific Table Mappings (Optional but highly recommended for analytical dashboards)

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255),
  role VARCHAR(50),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public full access" ON users FOR ALL USING (true) WITH CHECK (true);

-- Menu Items Table
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
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public full access" ON menu_items FOR ALL USING (true) WITH CHECK (true);

-- Tables Status
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
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public full access" ON tables FOR ALL USING (true) WITH CHECK (true);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(255) PRIMARY KEY,
  table_id VARCHAR(255),
  items JSONB,
  total NUMERIC,
  status VARCHAR(100),
  waiter_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public full access" ON orders FOR ALL USING (true) WITH CHECK (true);

-- Notifications (Real-time updates)
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(255) PRIMARY KEY,
  type VARCHAR(100),
  table_number INTEGER,
  table_id VARCHAR(255),
  message TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public full access" ON notifications FOR ALL USING (true) WITH CHECK (true);

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id VARCHAR(255) PRIMARY KEY,
  customer_name VARCHAR(255),
  rating INTEGER,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public full access" ON reviews FOR ALL USING (true) WITH CHECK (true);
`;
