import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';

const client = new Client({
    connectionString: 'postgresql://postgres:[cjc970614..@]@db.odflefzzpawciluqwwhz.supabase.co:5432/postgres',
});

async function run() {
    try {
        await client.connect();
        console.log('Connected to Supabase PostgreSQL database');

        const sql = fs.readFileSync('supabase_schema.sql', 'utf8');

        await client.query(sql);
        console.log('Successfully executed schema creation script.');

    } catch (err) {
        console.error('Error executing script', err);
    } finally {
        await client.end();
    }
}

run();
