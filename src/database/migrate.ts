import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const runMigrations = async (): Promise<void> => {
  console.log('🔄 Running database migrations...');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    multipleStatements: true,
  });

  try {
    // Create database if it doesn't exist
    const dbName = process.env.DB_NAME!;
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await connection.query(`USE \`${dbName}\``);

    console.log(`✅ Database '${dbName}' ready`);

    // Read and run schema
    const schemaPath = path.resolve(__dirname, '../../migrations/001_initial_schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Migration file not found: ${schemaPath}`);
    }

    const schema = fs.readFileSync(schemaPath, 'utf8');
    await connection.query(schema);

    console.log('✅ Schema migration completed');
    console.log('🎉 All migrations completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await connection.end();
  }
};

runMigrations();
