import { Dish } from '../models/Dish.js';

// URL validator for HTTP/HTTPS protocols
const isValidHttpUrl = (string) => {
  if (typeof string !== 'string') return false;
  try {
    const url = new URL(string.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
};

/**
 * GET /dishes & GET /api/dishes
 * Return all dishes with current published status and version.
 */
export const getAllDishes = async (req, res) => {
  try {
    const dishes = await Dish.find().sort({ dishId: 1 });
    return res.status(200).json(dishes);
  } catch (error) {
    console.error('[Error getAllDishes]:', error);
    return res.status(500).json({ error: 'Failed to retrieve dishes.' });
  }
};

/**
 * GET /dishes/:dishId & GET /api/dishes/:dishId
 * Return a single dish by dishId
 */
export const getDishById = async (req, res) => {
  try {
    const { dishId } = req.params;
    const dish = await Dish.findOne({ dishId });
    if (!dish) {
      return res.status(404).json({ error: `Dish with ID '${dishId}' not found.` });
    }
    return res.status(200).json(dish);
  } catch (error) {
    console.error('[Error getDishById]:', error);
    return res.status(500).json({ error: 'Failed to retrieve dish.' });
  }
};

/**
 * PATCH /dishes/:dishId & PATCH /api/dishes/:dishId
 * Body: { dishName, isPublished, expectedVersion, imageUrl? }
 *
 * Rules:
 * 1. Validate identifier, types and expectedVersion (integer >= 1).
 * 2. Published dish must have trimmed non-empty dishName and valid HTTP/HTTPS imageUrl.
 * 3. Status update must be an explicit boolean, not a blind toggle.
 * 4. Atomic compare-and-swap on version.
 * 5. Return 409 Conflict if version changed, 400 for invalid input, 404 for unknown dish.
 */
export const updateDish = async (req, res) => {
  try {
    const { dishId } = req.params;
    const { dishName, isPublished, expectedVersion, imageUrl } = req.body;

    // 1. Validate identifier
    if (!dishId || typeof dishId !== 'string' || dishId.trim() === '') {
      return res.status(400).json({ error: 'Valid dishId parameter is required.' });
    }

    // 2. Validate expectedVersion
    if (
      expectedVersion === undefined ||
      expectedVersion === null ||
      typeof expectedVersion !== 'number' ||
      !Number.isInteger(expectedVersion) ||
      expectedVersion < 1
    ) {
      return res.status(400).json({
        error: "expectedVersion must be an integer greater than or equal to 1. Example: { expectedVersion: 1 }"
      });
    }

    // 3. Validate dishName type and non-empty content
    if (dishName === undefined || typeof dishName !== 'string') {
      return res.status(400).json({
        error: "dishName is required and must be a string."
      });
    }

    if (dishName.trim() === '') {
      return res.status(400).json({
        error: "Dish name cannot be empty."
      });
    }

    // 4. Validate isPublished type (Explicit boolean, not blind toggle)
    if (typeof isPublished !== 'boolean') {
      return res.status(400).json({
        error: "isPublished is required and must be an explicit boolean (true or false)."
      });
    }

    // 5. Check if dish exists first to provide accurate 404 and inspect current imageUrl if not provided
    const existingDish = await Dish.findOne({ dishId });
    if (!existingDish) {
      return res.status(404).json({ error: `Dish with ID '${dishId}' not found.` });
    }

    // Target image URL is either newly provided or existing stored imageUrl
    const targetImageUrl = imageUrl !== undefined ? String(imageUrl).trim() : existingDish.imageUrl;

    // 6. Publication validation rules
    if (isPublished === true) {
      const trimmedName = dishName.trim();
      if (trimmedName.length === 0) {
        return res.status(400).json({
          error: "A published dish must have a non-empty name after trimming."
        });
      }

      if (!isValidHttpUrl(targetImageUrl)) {
        return res.status(400).json({
          error: `A published dish must have a valid HTTP or HTTPS image URL. Received: '${targetImageUrl}'`
        });
      }
    }

    // 7. Prepare update payload
    const updatePayload = {
      dishName: dishName.trim(),
      isPublished: isPublished
    };
    if (imageUrl !== undefined) {
      updatePayload.imageUrl = targetImageUrl;
    }

    // 8. Atomic compare-and-swap on { dishId, version: expectedVersion }
    // Only updates if version in database EXACTLY matches expectedVersion
    const updatedDish = await Dish.findOneAndUpdate(
      { dishId, version: expectedVersion },
      {
        $set: updatePayload,
        $inc: { version: 1 }
      },
      { new: true, runValidators: true }
    );

    // 9. If updatedDish is null, a concurrent update changed the version in the database!
    if (!updatedDish) {
      const currentDish = await Dish.findOne({ dishId });
      return res.status(409).json({
        error: `Conflict: This dish was modified by another session. Current version is ${currentDish.version}, but you sent version ${expectedVersion}.`,
        currentDish: currentDish
      });
    }

    // 10. Success: return updated dish with new incremented version
    return res.status(200).json(updatedDish);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    console.error('[Error updateDish]:', error);
    return res.status(500).json({ error: 'Unexpected server error while updating dish.' });
  }
};
