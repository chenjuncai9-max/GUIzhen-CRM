import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://odflefzzpawciluqwwhz.supabase.co',
    'sb_publishable_DUquhRTOpmHvU1IFoXf4oA_Nfiyd-ol'
);

async function checkSchema() {
    const { data: cData, error: cError } = await supabase.from('customers').insert({
        id: 'test_c_' + Date.now(),
        name: 'test',
        phone: '123'
    }).select();
    console.log("Customer columns:", cData ? Object.keys(cData[0]) : cError);
    if (cData) await supabase.from('customers').delete().eq('id', cData[0].id);

    const { data: ccData, error: ccError } = await supabase.from('customer_cards').insert({
        id: 'test_cc_' + Date.now(),
        customer_id: 'dummy', // might fail foreign key, let's see
        productid: 'dummy',
        productname: 'dummy',
        type: 'GOODS',
        purchasedate: new Date().toISOString()
    }).select();
    console.log("Customer Cards columns:", ccData ? Object.keys(ccData[0]) : ccError);

    const { data: tData, error: tError } = await supabase.from('transactions').insert({
        id: 'test_t_' + Date.now(),
        date: new Date().toISOString(),
        type: 'SALE',
        totalamount: 100,
        partyname: 'test'
    }).select();
    console.log("Transactions columns:", tData ? Object.keys(tData[0]) : tError);
}

checkSchema();
