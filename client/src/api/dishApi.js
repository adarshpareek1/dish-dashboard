// Base URL uses relative path so Vite proxy handles development
const BASE_URL = '/dishes';

/**
 * Fetch all dishes from the backend
 */
export async function getDishes() {
  try {
    const response = await fetch(BASE_URL, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to load dishes (Status ${response.status})`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[API getDishes error]:', error);
    throw error;
  }
}

/**
 * Patch a dish with optimistic concurrency control
 * @param {string} dishId - Unique identifier of the dish
 * @param {object} payload - { dishName, isPublished, expectedVersion }
 */
export async function patchDish(dishId, payload) {
  try {
    const response = await fetch(`${BASE_URL}/${dishId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(
        responseData?.error || `Request failed with status ${response.status}`
      );
      error.status = response.status;
      error.data = responseData;
      throw error;
    }

    return responseData;
  } catch (error) {
    console.error(`[API patchDish error for dishId ${dishId}]:`, error);
    throw error;
  }
}
