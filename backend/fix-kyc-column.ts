import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  console.log('Altering file_data column to bytea...');
  
  try {
    // Delete existing garbage rows to avoid casting errors with invalid text
    await pool.query('DELETE FROM kyc_documents;');
    
    // Alter column
    await pool.query('ALTER TABLE kyc_documents ALTER COLUMN file_data TYPE bytea USING file_data::bytea;');
    console.log('✅ Successfully altered file_data to bytea!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

run();
