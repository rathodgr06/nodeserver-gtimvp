// ============================================
// Wallet Table Seeder - Insert 1500 Records
// ============================================

const generateUniqueId = require('generate-unique-id');
const pool = require("../config/database");

/**
 * Seeds the pg_wallet table with 1500 fake records
 * Usage: node seedWallets.js
 */

const seedWallets = async () => {
  let qb;
  
  try {
    qb = await pool.get_connection();
    
    const validCurrencies = ['LRD', 'USD', 'EUR', 'GHS'];
    const recordsToInsert = 1500;
    const batchSize = 100; // Insert in batches for better performance
    
    console.log(`Starting wallet seeding: ${recordsToInsert} records`);
    console.log('='.repeat(50));
    
    let totalInserted = 0;
    let merchantCurrencyMap = new Map(); // Track merchant-currency combinations
    
    // Process in batches
    for (let batch = 0; batch < Math.ceil(recordsToInsert / batchSize); batch++) {
      const recordsInThisBatch = Math.min(batchSize, recordsToInsert - totalInserted);
      const wallets = [];
      
      for (let i = 0; i < recordsInThisBatch; i++) {
        // Generate unique wallet_id (12 digits)
        const wallet_id = generateUniqueId({
          length: 12,
          useLetters: false,
        });
        
        // Generate random merchant_id (1000 to 9999)
        const sub_merchant_id = Math.floor(Math.random() * 9000) + 8000;
        
        // Select random currency
        const currency = validCurrencies[Math.floor(Math.random() * validCurrencies.length)];
        
        // Check if this merchant already has this currency
        const merchantKey = `${sub_merchant_id}-${currency}`;
        
        // Skip if merchant-currency combination already exists (one merchant = one currency)
        if (merchantCurrencyMap.has(merchantKey)) {
          i--; // Retry this iteration
          continue;
        }
        
        merchantCurrencyMap.set(merchantKey, true);
        
        // Random beneficiary_id (optional, 0 or 1000-9999)
        const beneficiary_id = Math.random() > 0.7 ? Math.floor(Math.random() * 9000) + 1000 : 0;
        
        // Current timestamp
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        
        wallets.push({
          wallet_id,
          sub_merchant_id,
          currency,
          beneficiary_id,
          total_balance: 0.00,
          available_balance: 0.00,
          pending_balance: 0.00,
          active: 1,
          deleted: 0,
          created_at: now,
          updated_at: now
        });
      }
      
      // Bulk insert this batch
      if (wallets.length > 0) {
        const result = await qb.insert('pg_wallet', wallets);
        totalInserted += wallets.length;
        
        console.log(`✓ Batch ${batch + 1}: Inserted ${wallets.length} wallets (Total: ${totalInserted}/${recordsToInsert})`);
      }
    }
    
    console.log('='.repeat(50));
    console.log(`✓ Successfully seeded ${totalInserted} wallet records`);
    console.log('='.repeat(50));
    
    // Display summary
    const summary = await qb.query(`
      SELECT 
        currency, 
        COUNT(*) as count,
        COUNT(DISTINCT sub_merchant_id) as unique_merchants
      FROM pg_wallet 
      WHERE deleted = 0
      GROUP BY currency
    `);
    
    console.log('\nSummary by Currency:');
    console.table(summary);
    
    return {
      success: true,
      totalInserted,
      summary
    };
    
  } catch (error) {
    console.error('❌ Error seeding wallets:', error.message);
    throw error;
  } finally {
    if (qb) {
      qb.release();
    }
  }
};

// ============================================
// Alternative: Insert with Raw SQL Query
// ============================================

const seedWalletsWithRawSQL = async () => {
  let qb;
  
  try {
    qb = await pool.get_connection();
    
    const validCurrencies = ['LRD', 'USD', 'EUR', 'GHS'];
    const recordsToInsert = 1500;
    const batchSize = 100;
    
    console.log(`Starting wallet seeding: ${recordsToInsert} records`);
    console.log('='.repeat(50));
    
    let totalInserted = 0;
    const usedMerchantCurrency = new Set();
    
    for (let batch = 0; batch < Math.ceil(recordsToInsert / batchSize); batch++) {
      const values = [];
      let recordsInBatch = 0;
      
      while (recordsInBatch < batchSize && totalInserted + recordsInBatch < recordsToInsert) {
        const wallet_id = generateUniqueId({ length: 12, useLetters: false });
        const sub_merchant_id = Math.floor(Math.random() * 9000) + 1000;
        const currency = validCurrencies[Math.floor(Math.random() * validCurrencies.length)];
        const merchantKey = `${sub_merchant_id}-${currency}`;
        
        // Ensure unique merchant-currency combination
        if (usedMerchantCurrency.has(merchantKey)) {
          continue;
        }
        
        usedMerchantCurrency.add(merchantKey);
        
        const beneficiary_id = Math.random() > 0.7 ? Math.floor(Math.random() * 9000) + 1000 : 0;
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        
        values.push(`(
          '${wallet_id}',
          ${sub_merchant_id},
          '${currency}',
          ${beneficiary_id},
          0.00,
          0.00,
          0.00,
          1,
          0,
          '${now}',
          '${now}'
        )`);
        
        recordsInBatch++;
      }
      
      if (values.length > 0) {
        const query = `
          INSERT INTO pg_wallet (
            wallet_id, sub_merchant_id, currency, beneficiary_id,
            total_balance, available_balance, pending_balance,
            active, deleted, created_at, updated_at
          ) VALUES ${values.join(',\n')}
        `;
        
        await qb.query(query);
        totalInserted += values.length;
        
        console.log(`✓ Batch ${batch + 1}: Inserted ${values.length} wallets (Total: ${totalInserted}/${recordsToInsert})`);
      }
    }
    
    console.log('='.repeat(50));
    console.log(`✓ Successfully seeded ${totalInserted} wallet records`);
    
    return { success: true, totalInserted };
    
  } catch (error) {
    console.error('❌ Error seeding wallets:', error.message);
    throw error;
  } finally {
    if (qb) {
      qb.release();
    }
  }
};

// ============================================
// Standalone Script Version
// ============================================

/**
 * Run this as a standalone script:
 * node seedWallets.js
 */

const runSeeder = async () => {
  console.log('🌱 Starting Wallet Seeder...\n');
  
  try {
    const result = await seedWallets();
    
    console.log('\n✅ Seeding completed successfully!');
    console.log(`📊 Total records inserted: ${result.totalInserted}`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  }
};

// ============================================
// Helper: Clean/Reset Wallet Table (Optional)
// ============================================

const cleanWalletTable = async () => {
  let qb;
  
  try {
    qb = await pool.get_connection();
    
    console.log('⚠️  WARNING: This will delete all wallet records!');
    console.log('Waiting 3 seconds... Press Ctrl+C to cancel\n');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await qb.query('TRUNCATE TABLE pg_wallet');
    console.log('✓ Wallet table cleaned');
    
    return true;
  } catch (error) {
    console.error('Error cleaning wallet table:', error);
    throw error;
  } finally {
    if (qb) {
      qb.release();
    }
  }
};

// ============================================
// Export Functions
// ============================================

module.exports = {
  seedWallets,
  seedWalletsWithRawSQL,
  cleanWalletTable,
  runSeeder
};

// Run if called directly
if (require.main === module) {
  runSeeder();
}

// ============================================
// Usage Examples
// ============================================

/*
// Example 1: Seed wallets
const { seedWallets } = require('./seedWallets');
await seedWallets();

// Example 2: Clean and reseed
const { cleanWalletTable, seedWallets } = require('./seedWallets');
await cleanWalletTable();
await seedWallets();

// Example 3: Use in API endpoint
app.post('/seed-wallets', async (req, res) => {
  try {
    const result = await seedWallets();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
*/