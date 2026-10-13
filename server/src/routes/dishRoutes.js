import express from 'express';
import { getAllDishes, getDishById, updateDish } from '../controllers/dishController.js';

const router = express.Router();

router.get('/', getAllDishes);
router.get('/:dishId', getDishById);
router.patch('/:dishId', updateDish);

export default router;
