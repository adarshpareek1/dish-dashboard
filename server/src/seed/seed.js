import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { Dish } from '../models/Dish.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const seedDishes = async () => {
  try {
    await connectDB();

    // Read seedData.json
    const seedPath = path.resolve(__dirname, '../../seedData.json');
    if (!fs.existsSync(seedPath)) {
      throw new Error(`seedData.json not found at ${seedPath}`);
    }

    const rawData = fs.readFileSync(seedPath, 'utf-8');
    const dishes = JSON.parse(rawData);

    if (!Array.isArray(dishes) || dishes.length === 0) {
      throw new Error('seedData.json must contain a non-empty array of dishes');
    }

    // Prepare idempotent upsert operations with $setOnInsert
    // This ensures:
    // 1. Missing dishes are inserted with version = 1
    // 2. Existing dishes are NEVER overwritten or duplicated
    // 3. User edits and incremented versions are preserved across re-seeds
    const bulkOps = dishes.map((dish) => ({
      updateOne: {
        filter: { dishId: String(dish.dishId) },
        update: {
          $setOnInsert: {
            dishId: String(dish.dishId),
            dishName: String(dish.dishName).trim(),
            imageUrl: String(dish.imageUrl).trim(),
            isPublished: Boolean(dish.isPublished),
            version: 1
          }
        },
        upsert: true
      }
    }));

    const result = await Dish.bulkWrite(bulkOps);

    const totalCount = await Dish.countDocuments();
    console.log(`[Seed Success] Processed ${dishes.length} dishes from seedData.json.`);
    console.log(`  - Newly Inserted: ${result.upsertedCount}`);
    console.log(`  - Already Existing (Preserved intact): ${result.matchedCount}`);
    console.log(`  - Total Dishes in Database: ${totalCount}`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error(`[Seed Error] Failed to seed database: ${error.message}`);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

seedDishes();
