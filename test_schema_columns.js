import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://odflefzzpawciluqwwhz.supabase.co',
    'sb_publishable_DUquhRTOpmHvU1IFoXf4oA_Nfiyd-ol'
);

async function checkSchema() {
    const { data: pData } = await supabase.from('products').select('*').limit(1);
    const { data: cData } = await supabase.from('customers').select('*').limit(1);
    const { data: tData } = await supabase.from('transactions').select('*').limit(1);
    const { data: ccData } = await supabase.from('customer_cards').select('*').limit(1);

    console.log("Products columns:", pData && pData[0] ? Object.keys(pData[0]) : "Empty");
    console.log("Customers columns:", cData && cData[0] ? Object.keys(cData[0]) : "Empty");
    console.log("Transactions columns:", tData && tData[0] ? Object.keys(tData[0]) : "Empty");
    console.log("Customer cards columns:", ccData && ccData[0] ? Object.keys(ccData[0]) : "Empty");

    // Let's try to insert a dummy product to see what fields are strictly required
    const { data, error: insertError } = await supabase.from('products').insert({
        id: 'test_id_' + Date.now(),
        name: 'test_name',
        category: 'test_cat',
        sku: 'test_sku',
        price: 10,
        cost: 10,
        stock: 10,
        minstocklevel: 10,  // Note lower case
        type: 'GOODS'
    }).select();

    console.log("Insert Product result error:", insertError);
    if (data) {
        console.log("Insert Product success, columns returned are:", Object.keys(data[0]));
        // cleanup
        await supabase.from('products').delete().eq('id', data[0].id);
    }
}

checkSchema();
