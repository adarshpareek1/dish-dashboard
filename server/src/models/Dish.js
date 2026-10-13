import mongoose from 'mongoose';

const dishSchema = new mongoose.Schema(
  {
    dishId: {
      type: String,
      required: [true, 'dishId is required'],
      unique: true,
      trim: true,
      index: true
    },
    dishName: {
      type: String,
      required: [true, 'dishName is required'],
      trim: true
    },
    imageUrl: {
      type: String,
      required: [true, 'imageUrl is required'],
      trim: true
    },
    isPublished: {
      type: Boolean,
      default: false
    },
    version: {
      type: Number,
      required: true,
      default: 1,
      min: 1
    }
  },
  {
    timestamps: true,
    versionKey: false // We use our own explicit `version` field for OCC
  }
);

export const Dish = mongoose.model('Dish', dishSchema);
