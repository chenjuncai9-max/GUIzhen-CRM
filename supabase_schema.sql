-- Enable Realtime for all tables
-- Table for Products
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  sku TEXT NOT NULL,
  price NUMERIC NOT NULL,
  cost NUMERIC NOT NULL,
  stock NUMERIC NOT NULL,
  minStockLevel NUMERIC NOT NULL,
  type TEXT NOT NULL,
  value NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for Customers
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  notes TEXT,
  lastActivity TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for Customer Cards (JSON array was used in local, but better normalized in RDBMS)
CREATE TABLE customer_cards (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  productId TEXT NOT NULL,
  productName TEXT NOT NULL,
  type TEXT NOT NULL,
  remainingCounts NUMERIC,
  expiryDate TEXT,
  purchaseDate TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for Transactions
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  productId TEXT,
  productName TEXT,
  quantity NUMERIC,
  totalAmount NUMERIC NOT NULL,
  partyName TEXT NOT NULL,
  partyId TEXT,
  costSnapshot NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for Finance Records
CREATE TABLE finance_records (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Turn on realtime for all these tables
alter publication supabase_realtime add table products;
alter publication supabase_realtime add table customers;
alter publication supabase_realtime add table customer_cards;
alter publication supabase_realtime add table transactions;
alter publication supabase_realtime add table finance_records;
