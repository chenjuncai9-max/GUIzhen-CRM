-- 修复 schema 缺少前台 ts 类型某些驼峰命名字段的问题。 
-- 因为 React 前端在 cloudStorage.ts 里直接 upsert 原对象，因此在数据库需要保持名称的一致或者加列。

ALTER TABLE products ADD COLUMN IF NOT EXISTS "minStockLevel" INTEGER DEFAULT 10;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "type" TEXT DEFAULT 'GOODS';
ALTER TABLE products ADD COLUMN IF NOT EXISTS "value" NUMERIC; -- 卡项面值 (次数或天数)

ALTER TABLE customers ADD COLUMN IF NOT EXISTS "lastActivity" TIMESTAMP WITH TIME ZONE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- 注意：在上次的表结构设计中使用了下划线命名法
-- 这可能导致前台发送 "minStockLevel" 时由于不匹配而丢弃或报错。
-- 如果旧有字段存在此冲突，最好是支持 camelCase，我们以双引号 "camelCase" 为新增列，以适配前台发送的原始对象结构。
