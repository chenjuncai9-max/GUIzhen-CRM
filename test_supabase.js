import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://odflefzzpawciluqwwhz.supabase.co';
const supabaseKey = 'sb_publishable_DUquhRTOpmHvU1IFoXf4oA_Nfiyd-ol';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Testing Supabase Data API connection...');
    // A test insert / fetch might be required here if we can't create tables via standard API
    // However, usually we can't DDL (create tables) via anonymous key.

    // So instead of DDL, I am verifying if tables exist
    const { data, error } = await supabase.from('products').select('*').limit(1);
    if (error) {
        console.error('Error (might be table not found):', error.message);
    } else {
        console.log('Products table exists!', data);
    }
}

run();
