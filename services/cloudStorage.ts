import { supabase } from './supabaseClient';
import { Product, Transaction, Customer, FinanceRecord, CustomerCard, ProductType } from '../types';

export const CloudStorageService = {
    // --- Products ---
    getProducts: async (): Promise<Product[]> => {
        const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
        if (error) {
            console.error('Error fetching products:', error);
            return [];
        }
        return (data || []).map(p => ({
            id: p.id,
            name: p.name,
            category: p.category,
            sku: p.sku,
            price: p.price,
            cost: p.cost,
            stock: p.stock,
            minStockLevel: p.minstocklevel, // Map DB lowercase 'minstocklevel' back to camelCase
            type: p.type as ProductType,
            value: p.value
        }));
    },

    saveProduct: async (product: Product): Promise<void> => {
        const productData = {
            id: product.id,
            name: product.name,
            category: product.category,
            sku: product.sku,
            price: product.price,
            cost: product.cost,
            stock: product.stock,
            minstocklevel: product.minStockLevel,
            type: product.type,
            value: product.value
        };
        const { error } = await supabase.from('products').upsert(productData);
        if (error) console.error('Error saving product:', error);
    },

    deleteProduct: async (id: string): Promise<void> => {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) console.error('Error deleting product:', error);
    },

    batchSaveProducts: async (newProducts: Product[]): Promise<void> => {
        const productsData = newProducts.map(product => ({
            id: product.id,
            name: product.name,
            category: product.category,
            sku: product.sku,
            price: product.price,
            cost: product.cost,
            stock: product.stock,
            minstocklevel: product.minStockLevel,
            type: product.type,
            value: product.value
        }));
        const { error } = await supabase.from('products').upsert(productsData);
        if (error) console.error('Error batch saving products:', error);
    },

    // --- Customers ---
    getCustomers: async (): Promise<Customer[]> => {
        const { data: customersData, error: customersError } = await supabase.from('customers').select('*');
        if (customersError) {
            console.error('Error fetching customers:', customersError);
            return [];
        }

        const { data: cardsData, error: cardsError } = await supabase.from('customer_cards').select('*');
        if (cardsError) {
            console.error('Error fetching customer cards:', cardsError);
            return [];
        }

        // Merge cards into customers
        const customers = customersData || [];
        const cards = cardsData || [];

        return customers.map(c => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            notes: c.notes,
            lastActivity: c.lastactivity || c.lastActivity, // Map DB to TS
            cards: cards.filter(card => card.customer_id === c.id).map(card => ({
                id: card.id,
                productId: card.productid,
                productName: card.productname,
                type: card.type,
                remainingCounts: card.remainingcounts,
                expiryDate: card.expirydate,
                purchaseDate: card.purchasedate
            }))
        }));
    },

    saveCustomer: async (customer: Customer): Promise<void> => {
        // 1. Save customer basic info - Map TS camelCase to DB snake_case
        const customerData = {
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            notes: customer.notes,
            lastactivity: customer.lastActivity // Map to DB lowercase
        };

        const { error: customerError } = await supabase.from('customers').upsert(customerData);
        if (customerError) {
            console.error('Error saving customer:', customerError);
            return;
        }

        // 2. Save customer cards - Map TS camelCase to DB snake_case
        // The previous implementation replaced all cards when saving. Here we upsert existing cards.
        // However, if a card was deleted, an upsert won't remove it. For simplicity in this CRM, 
        // cards are typically only added or updated (usage).
        if (customer.cards && customer.cards.length > 0) {
            const cardsToUpsert = customer.cards.map(card => ({
                id: card.id,
                customer_id: customer.id,
                productid: card.productId,
                productname: card.productName,
                type: card.type,
                remainingcounts: card.remainingCounts || 0,
                expirydate: card.expiryDate,
                purchasedate: card.purchaseDate || new Date().toISOString()
            }));
            const { error: cardsError } = await supabase.from('customer_cards').upsert(cardsToUpsert);
            if (cardsError) console.error('Error saving customer cards:', cardsError);
        }
    },

    batchSaveCustomers: async (newCustomers: Customer[]): Promise<void> => {
        // Map TS camelCase to DB snake_case
        const basicData = newCustomers.map(c => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            notes: c.notes,
            lastactivity: c.lastActivity
        }));
        const { error } = await supabase.from('customers').upsert(basicData);
        if (error) console.error('Error batch saving customers:', error);
    },

    deleteCustomer: async (id: string): Promise<void> => {
        // Due to ON DELETE CASCADE on customer_cards, we only need to delete the customer
        const { error } = await supabase.from('customers').delete().eq('id', id);
        if (error) console.error('Error deleting customer:', error);
    },

    // Customer Card Logic (Issuing)
    issueCardToCustomer: async (customerId: string, product: Product, quantity: number): Promise<void> => {
        // 1. Update Customer Activity
        const { error: updateError } = await supabase.from('customers').update({ lastactivity: new Date().toISOString() }).eq('id', customerId);
        if (updateError) console.error('Error updating customer activity:', updateError);

        // 2. Insert Cards - Map TS camelCase to DB snake_case
        const newCards: any[] = [];
        for (let i = 0; i < quantity; i++) {
            const newCard = {
                id: Date.now().toString() + Math.random().toString().slice(2, 6),
                customer_id: customerId,
                productid: product.id,
                productname: product.name,
                type: product.type,
                purchasedate: new Date().toISOString(),
                remainingcounts: product.type === ProductType.SERVICE_COUNT ? (product.value || 1) : null,
                expirydate: null as string | null
            };

            if (product.type === ProductType.SERVICE_TIME) {
                const days = product.value || 30;
                const expiry = new Date();
                expiry.setDate(expiry.getDate() + days);
                newCard.expirydate = expiry.toISOString();
            }
            newCards.push(newCard);
        }

        const { error: cardsError } = await supabase.from('customer_cards').insert(newCards);
        if (cardsError) console.error('Error inserting customer cards:', cardsError);
    },

    // Customer Card Logic (Redemption/Verifying)
    redeemCard: async (customerId: string, cardId: string, quantity: number = 1): Promise<boolean> => {
        // We first need to get the card
        const { data: cards, error: fetchError } = await supabase.from('customer_cards').select('*').eq('id', cardId).eq('customer_id', customerId);
        if (fetchError || !cards || cards.length === 0) return false;

        const card = cards[0];

        // Update customer last activity
        await supabase.from('customers').update({ lastactivity: new Date().toISOString() }).eq('id', customerId);

        if (card.type === ProductType.SERVICE_TIME) {
            if (new Date(card.expirydate) < new Date()) return false;
            return true;
        } else if (card.type === ProductType.SERVICE_COUNT) {
            const remaining = card.remainingcounts || 0;
            if (remaining < quantity) return false;

            const newRemaining = remaining - quantity;
            const { error: updateError } = await supabase.from('customer_cards').update({ remainingcounts: newRemaining }).eq('id', cardId);
            if (updateError) return false;
            return true;
        }
        return false;
    },

    // --- Transactions ---
    getTransactions: async (): Promise<Transaction[]> => {
        const { data, error } = await supabase.from('transactions').select('*').order('created_at', { ascending: false });
        if (error) {
            console.error('Error fetching transactions:', error);
            return [];
        }
        return (data || []).map(t => ({
            id: t.id,
            date: t.date,
            type: t.type,
            productId: t.productid,
            productName: t.productname,
            quantity: t.quantity,
            totalAmount: t.totalamount,
            partyName: t.partyname,
            partyId: t.partyid,
            costSnapshot: t.costsnapshot
        }));
    },

    addTransaction: async (transaction: Transaction): Promise<void> => {
        const txData = {
            id: transaction.id,
            date: transaction.date,
            type: transaction.type,
            productid: transaction.productId,
            productname: transaction.productName,
            quantity: transaction.quantity,
            totalamount: transaction.totalAmount,
            partyname: transaction.partyName,
            partyid: transaction.partyId,
            costsnapshot: transaction.costSnapshot
        };
        const { error } = await supabase.from('transactions').insert(txData);
        if (error) console.error('Error adding transaction:', error);

        // Update Product Stock if applicable
        if (transaction.productId) {
            const { data: products } = await supabase.from('products').select('*').eq('id', transaction.productId);
            if (products && products.length > 0) {
                const product = products[0];
                if (product.type === ProductType.GOODS) {
                    const stockChange = transaction.type === 'PURCHASE' ? (transaction.quantity || 0) : -(transaction.quantity || 0);
                    await supabase.from('products').update({ stock: product.stock + stockChange }).eq('id', product.id);
                }

                // Issue Service Card
                if (transaction.type === 'SALE' && transaction.partyId && (product.type === ProductType.SERVICE_COUNT || product.type === ProductType.SERVICE_TIME)) {
                    await CloudStorageService.issueCardToCustomer(transaction.partyId, product, transaction.quantity || 1);
                }
            }
        }
    },

    batchAddTransactions: async (newTransactions: Transaction[]): Promise<void> => {
        const txData = newTransactions.map(transaction => ({
            id: transaction.id,
            date: transaction.date,
            type: transaction.type,
            productid: transaction.productId,
            productname: transaction.productName,
            quantity: transaction.quantity,
            totalamount: transaction.totalAmount,
            partyname: transaction.partyName,
            partyid: transaction.partyId,
            costsnapshot: transaction.costSnapshot
        }));
        // insert transactions
        const { error } = await supabase.from('transactions').insert(txData);
        if (error) console.error('Error batch adding transactions', error);

        // NOTE: A more complex query or edge function is better here for batch stock updates.
        // For standard local-first iteration, we process sequentially or rely on Realtime sync later.
        for (const t of newTransactions) {
            if (t.productId) {
                const { data: products } = await supabase.from('products').select('*').eq('id', t.productId);
                if (products && products.length > 0 && products[0].type === ProductType.GOODS) {
                    const stockChange = t.type === 'PURCHASE' ? (t.quantity || 0) : -(t.quantity || 0);
                    await supabase.from('products').update({ stock: products[0].stock + stockChange }).eq('id', t.productId);
                }
            }
        }
    },

    // --- Finance Records ---
    getFinanceRecords: async (): Promise<FinanceRecord[]> => {
        const { data, error } = await supabase.from('finance_records').select('*').order('created_at', { ascending: false });
        if (error) {
            console.error('Error fetching finance records:', error);
            return [];
        }
        return (data || []).map(r => ({
            id: r.id,
            date: r.date,
            type: r.type,
            amount: r.amount,
            category: r.category,
            description: r.description
        }));
    },

    addFinanceRecord: async (record: FinanceRecord): Promise<void> => {
        const { error } = await supabase.from('finance_records').insert(record);
        if (error) console.error('Error adding finance record:', error);
    },

    deleteFinanceRecord: async (id: string): Promise<void> => {
        const { error } = await supabase.from('finance_records').delete().eq('id', id);
        if (error) console.error('Error deleting finance record:', error);
    },

    batchAddFinanceRecords: async (newRecords: FinanceRecord[]): Promise<void> => {
        const { error } = await supabase.from('finance_records').insert(newRecords);
        if (error) console.error('Error batch adding finance records', error);
    },

    // --- Realtime Subscriptions ---
    subscribeToChanges: (onDataChange: () => void) => {
        const channel = supabase.channel('schema-db-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'products' },
                () => onDataChange()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'customers' },
                () => onDataChange()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'customer_cards' },
                () => onDataChange()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'transactions' },
                () => onDataChange()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'finance_records' },
                () => onDataChange()
            )
            .subscribe((status) => {
                console.log('Supabase real-time status:', status);
            });

        return channel;
    }
};
