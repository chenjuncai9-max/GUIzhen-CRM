-- 修复：“读不出数据”和“写入失败”的问题
-- 原因：Supabase 默认或由于误操作开启了行级安全（Row-Level Security, RLS），拦截了前端通过 anon key 发起的匿名读写请求。
-- 解决办法：为我们的业务表关闭 RLS（因为目前是单用户内部 CRM，暂不需要针对不同用户的权限隔离），或者添加允许公开访问的策略。

-- 方案一：直接禁用 RLS（推荐，最省事）
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE customer_cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE finance_records DISABLE ROW LEVEL SECURITY;

-- 方案二：如果你想保持 RLS 开启，请解除注释并运行以下授权策略
/*
CREATE POLICY "Enable read access for all users" ON products FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON products FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON products FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON products FOR DELETE USING (true);

-- （对其他表做同样的策略...）
*/
