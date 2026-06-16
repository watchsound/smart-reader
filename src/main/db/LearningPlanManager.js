/**
 * LearningPlanManager.js
 *
 * Database manager for learning_plan table.
 * Handles CRUD operations for AI-generated learning plans.
 *
 * Table Schema:
 * CREATE TABLE "learning_plan" (
 *   "id" TEXT PRIMARY KEY,
 *   "topic_id" TEXT NOT NULL,
 *   "user_id" INTEGER NOT NULL,
 *   "plan_data" TEXT NOT NULL,
 *   "current_phase" INTEGER DEFAULT 1,
 *   "current_day" INTEGER DEFAULT 0,
 *   "status" TEXT DEFAULT 'active',
 *   "started_at" TEXT,
 *   "completed_at" TEXT,
 *   "created_at" TEXT NOT NULL,
 *   "updated_at" TEXT
 * );
 */

import db, { getUserIdFromToken } from './dbManager';
import { dateToSQLiteString } from '../../commons/utils/SqliteHelper';

/**
 * Ensure the learning_plan table exists
 */
const ensureTableExists = () => {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS "learning_plan" (
        "id" TEXT PRIMARY KEY,
        "topic_id" TEXT NOT NULL,
        "user_id" INTEGER NOT NULL,
        "plan_data" TEXT NOT NULL,
        "current_phase" INTEGER DEFAULT 1,
        "current_day" INTEGER DEFAULT 0,
        "status" TEXT DEFAULT 'active',
        "started_at" TEXT,
        "completed_at" TEXT,
        "created_at" TEXT NOT NULL,
        "updated_at" TEXT
      )
    `);
    // Create indexes if they don't exist
    db.exec(
      `CREATE INDEX IF NOT EXISTS "idx_learning_plan_topic" ON "learning_plan"("topic_id")`,
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS "idx_learning_plan_user_status" ON "learning_plan"("user_id", "status")`,
    );
  } catch (err) {
    console.error('Error ensuring learning_plan table exists:', err);
  }
};

// Ensure table exists when module loads
ensureTableExists();

/**
 * Generate a unique plan ID
 */
const generatePlanId = () => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `plan_${timestamp}_${randomPart}`;
};

/**
 * Convert database row to plan object
 */
const rowToPlan = (row) => {
  if (!row) return null;

  let planData = null;
  try {
    planData = row.plan_data ? JSON.parse(row.plan_data) : null;
  } catch (e) {
    console.error('Error parsing plan_data:', e);
    planData = null;
  }

  // Normalize learningPoints if they exist
  if (planData && planData.learningPoints) {
    planData.learningPoints = planData.learningPoints.map((point) => ({
      ...point,
      front: typeof point.front === 'object' ? point.front?.text : point.front,
      back: typeof point.back === 'object' ? point.back?.text : point.back,
    }));
  }

  return {
    id: row.id,
    topicId: row.topic_id,
    userId: row.user_id,
    planData,
    currentPhase: row.current_phase || 1,
    currentDay: row.current_day || 0,
    status: row.status || 'active',
    startedAt: row.started_at ? new Date(row.started_at) : null,
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
  };
};

/**
 * Get a learning plan by ID
 * @param {string} id - Plan ID
 * @param {string} token - User token
 * @returns {Object|null} Plan object or null
 */
export const getLearningPlanById = (id, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.log('getLearningPlanById: invalid session');
    return null;
  }
  try {
    const stmt = db.prepare(
      'SELECT * FROM learning_plan WHERE id = ? AND user_id = ?',
    );
    const row = stmt.get(id, userId);
    return rowToPlan(row);
  } catch (err) {
    console.error('getLearningPlanById error:', err);
    return null;
  }
};

/**
 * Get learning plan for a topic
 * @param {string} topicId - Topic ID
 * @param {string} token - User token
 * @returns {Object|null} Plan object or null
 */
export const getLearningPlanByTopic = (topicId, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.log('getLearningPlanByTopic: invalid session');
    return null;
  }
  try {
    // Get the most recent active plan for the topic
    const stmt = db.prepare(`
      SELECT * FROM learning_plan
      WHERE topic_id = ? AND user_id = ?
      ORDER BY
        CASE status
          WHEN 'active' THEN 0
          WHEN 'paused' THEN 1
          ELSE 2
        END,
        created_at DESC
      LIMIT 1
    `);
    const row = stmt.get(topicId, userId);
    return rowToPlan(row);
  } catch (err) {
    console.error('getLearningPlanByTopic error:', err);
    return null;
  }
};

/**
 * Get all learning plans for a user
 * @param {string} token - User token
 * @param {Object} options - Query options
 * @returns {Array} Array of plan objects
 */
export const getLearningPlans = (token, options = {}) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.log('getLearningPlans: invalid session');
    return [];
  }

  const { status, limit = 50, offset = 0 } = options;

  try {
    let query = 'SELECT * FROM learning_plan WHERE user_id = ?';
    const params = [userId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);
    return rows.map(rowToPlan);
  } catch (err) {
    console.error('getLearningPlans error:', err);
    return [];
  }
};

/**
 * Create a new learning plan
 * @param {Object} plan - Plan data
 * @param {string} token - User token
 * @returns {Object} Created plan with ID
 */
export const createLearningPlan = (plan, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.log('createLearningPlan: invalid session');
    return { error: 'Invalid session' };
  }

  try {
    const id = generatePlanId();
    const now = dateToSQLiteString(new Date());
    const planDataJson = JSON.stringify(plan.planData || {});

    const stmt = db.prepare(`
      INSERT INTO learning_plan (
        id, topic_id, user_id, plan_data, current_phase,
        current_day, status, started_at, completed_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      plan.topicId,
      userId,
      planDataJson,
      plan.currentPhase || 1,
      plan.currentDay || 0,
      plan.status || 'active',
      plan.startedAt ? dateToSQLiteString(new Date(plan.startedAt)) : null,
      null, // completedAt
      now,
      null, // updatedAt
    );

    return getLearningPlanById(id, token);
  } catch (err) {
    console.error('createLearningPlan error:', err);
    return { error: err.message };
  }
};

/**
 * Update a learning plan
 * @param {string} id - Plan ID
 * @param {Object} updates - Fields to update
 * @param {string} token - User token
 * @returns {Object} Updated plan
 */
export const updateLearningPlan = (id, updates, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.log('updateLearningPlan: invalid session');
    return { error: 'Invalid session' };
  }

  try {
    const fields = [];
    const values = [];

    if (updates.planData !== undefined) {
      fields.push('plan_data = ?');
      values.push(JSON.stringify(updates.planData));
    }
    if (updates.currentPhase !== undefined) {
      fields.push('current_phase = ?');
      values.push(updates.currentPhase);
    }
    if (updates.currentDay !== undefined) {
      fields.push('current_day = ?');
      values.push(updates.currentDay);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.startedAt !== undefined) {
      fields.push('started_at = ?');
      values.push(
        updates.startedAt
          ? dateToSQLiteString(new Date(updates.startedAt))
          : null,
      );
    }
    if (updates.completedAt !== undefined) {
      fields.push('completed_at = ?');
      values.push(
        updates.completedAt
          ? dateToSQLiteString(new Date(updates.completedAt))
          : null,
      );
    }

    if (fields.length === 0) {
      return getLearningPlanById(id, token);
    }

    fields.push('updated_at = ?');
    values.push(dateToSQLiteString(new Date()));

    values.push(id, userId);

    const query = `UPDATE learning_plan SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`;
    const stmt = db.prepare(query);
    stmt.run(...values);

    return getLearningPlanById(id, token);
  } catch (err) {
    console.error('updateLearningPlan error:', err);
    return { error: err.message };
  }
};

/**
 * Delete a learning plan
 * @param {string} id - Plan ID
 * @param {string} token - User token
 * @returns {Object} Success/error status
 */
export const deleteLearningPlan = (id, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.log('deleteLearningPlan: invalid session');
    return { error: 'Invalid session' };
  }

  try {
    const stmt = db.prepare(
      'DELETE FROM learning_plan WHERE id = ? AND user_id = ?',
    );
    const result = stmt.run(id, userId);
    return { success: result.changes > 0 };
  } catch (err) {
    console.error('deleteLearningPlan error:', err);
    return { error: err.message };
  }
};

/**
 * Advance plan to next day
 * @param {string} id - Plan ID
 * @param {string} token - User token
 * @returns {Object} Updated plan
 */
export const advancePlanDay = (id, token) => {
  const plan = getLearningPlanById(id, token);
  if (!plan || plan.error) {
    return { error: 'Plan not found' };
  }

  const newDay = plan.currentDay + 1;
  let newPhase = plan.currentPhase;

  // Check if we need to advance to next phase
  if (plan.planData && plan.planData.phases) {
    const currentPhaseData = plan.planData.phases.find(
      (p) => p.phaseNumber === plan.currentPhase,
    );
    if (currentPhaseData) {
      // Calculate total days in current phase
      const phaseDays = currentPhaseData.durationDays || 7;
      const daysInPhase =
        newDay -
        plan.planData.phases
          .filter((p) => p.phaseNumber < plan.currentPhase)
          .reduce((sum, p) => sum + (p.durationDays || 7), 0);

      if (daysInPhase > phaseDays) {
        newPhase = plan.currentPhase + 1;
      }
    }
  }

  // Check if plan is complete
  let newStatus = plan.status;
  if (
    plan.planData &&
    plan.planData.estimatedDuration &&
    newDay >= plan.planData.estimatedDuration
  ) {
    newStatus = 'completed';
  }

  return updateLearningPlan(
    id,
    {
      currentDay: newDay,
      currentPhase: newPhase,
      status: newStatus,
      completedAt: newStatus === 'completed' ? new Date() : null,
    },
    token,
  );
};

/**
 * Start a plan (set started_at and status)
 * @param {string} id - Plan ID
 * @param {string} token - User token
 * @returns {Object} Updated plan
 */
export const startPlan = (id, token) => {
  return updateLearningPlan(
    id,
    {
      status: 'active',
      startedAt: new Date(),
      currentDay: 1,
    },
    token,
  );
};

/**
 * Pause a plan
 * @param {string} id - Plan ID
 * @param {string} token - User token
 * @returns {Object} Updated plan
 */
export const pausePlan = (id, token) => {
  return updateLearningPlan(
    id,
    {
      status: 'paused',
    },
    token,
  );
};

/**
 * Resume a paused plan
 * @param {string} id - Plan ID
 * @param {string} token - User token
 * @returns {Object} Updated plan
 */
export const resumePlan = (id, token) => {
  return updateLearningPlan(
    id,
    {
      status: 'active',
    },
    token,
  );
};

/**
 * Get today's learning items from a plan
 * @param {string} id - Plan ID
 * @param {string} token - User token
 * @returns {Object} Today's items and schedule
 */
export const getTodaysItems = (id, token) => {
  const plan = getLearningPlanById(id, token);
  if (!plan || plan.error) {
    return { error: 'Plan not found' };
  }

  if (!plan.planData || !plan.planData.items) {
    return { items: [], schedule: plan.planData?.dailySchedule || null };
  }

  // Get items scheduled for today or due for review
  const todaysItems = plan.planData.items.filter((item) => {
    // New items scheduled for today
    if (item.scheduledDay === plan.currentDay && item.status === 'pending') {
      return true;
    }
    // Items due for review
    if (
      item.status === 'reviewing' &&
      item.nextReviewAt &&
      new Date(item.nextReviewAt) <= new Date()
    ) {
      return true;
    }
    return false;
  });

  return {
    day: plan.currentDay,
    phase: plan.currentPhase,
    items: todaysItems,
    schedule: plan.planData.dailySchedule,
    totalItemsToday: todaysItems.length,
    newItems: todaysItems.filter((i) => i.status === 'pending').length,
    reviewItems: todaysItems.filter((i) => i.status === 'reviewing').length,
  };
};

/**
 * Update an item's status in the plan
 * @param {string} planId - Plan ID
 * @param {string} itemId - Item ID
 * @param {Object} itemUpdate - Item updates
 * @param {string} token - User token
 * @returns {Object} Updated plan
 */
export const updatePlanItem = (planId, itemId, itemUpdate, token) => {
  const plan = getLearningPlanById(planId, token);
  if (!plan || plan.error) {
    return { error: 'Plan not found' };
  }

  if (!plan.planData || !plan.planData.items) {
    return { error: 'Plan has no items' };
  }

  // Find and update the item
  const itemIndex = plan.planData.items.findIndex((i) => i.id === itemId);
  if (itemIndex === -1) {
    return { error: 'Item not found in plan' };
  }

  const item = plan.planData.items[itemIndex];
  const updatedItem = { ...item, ...itemUpdate };

  // Update mastery and review scheduling based on result
  if (itemUpdate.wasCorrect !== undefined) {
    if (itemUpdate.wasCorrect) {
      updatedItem.correctStreak = (item.correctStreak || 0) + 1;
      updatedItem.masteryLevel = Math.min(
        100,
        (item.masteryLevel || 0) + 10 + updatedItem.correctStreak * 2,
      );
    } else {
      updatedItem.correctStreak = 0;
      updatedItem.masteryLevel = Math.max(0, (item.masteryLevel || 0) - 5);
    }
    updatedItem.reviewCount = (item.reviewCount || 0) + 1;
    updatedItem.lastReviewedAt = new Date().toISOString();

    // Calculate next review (simple spaced repetition)
    const intervals = [1, 1, 3, 7, 14, 30, 60];
    const intervalDays = intervals[Math.min(updatedItem.correctStreak, 6)];
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + intervalDays);
    updatedItem.nextReviewAt = nextReview.toISOString();

    // Update status
    if (updatedItem.masteryLevel >= 90 && updatedItem.correctStreak >= 3) {
      updatedItem.status = 'mastered';
    } else if (updatedItem.status === 'pending') {
      updatedItem.status = 'learning';
    } else {
      updatedItem.status = 'reviewing';
    }
  }

  // Update the plan data
  const newPlanData = { ...plan.planData };
  newPlanData.items[itemIndex] = updatedItem;

  return updateLearningPlan(planId, { planData: newPlanData }, token);
};

// ============================================================================
// ADDITIONAL METHODS EXPECTED BY learningPlanHandlers.js
// These provide compatibility with the handler API expectations
// ============================================================================

/**
 * Create a plan (alias for createLearningPlan with different signature)
 * @param {Object} plan - Plan data
 * @returns {Object} Created plan
 */
export const createPlan = (plan) => {
  // The handlers pass a token-less plan object
  // We need to store it differently - store in plan_data field
  try {
    const id = plan.id || generatePlanId();
    const now = dateToSQLiteString(new Date());

    const stmt = db.prepare(`
      INSERT INTO learning_plan (
        id, topic_id, user_id, plan_data, current_phase,
        current_day, status, started_at, completed_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      plan.sourceId || 'default',
      1, // Default user
      JSON.stringify(plan),
      1,
      0,
      plan.status || 'active',
      plan.createdAt || now,
      null,
      now,
      null,
    );

    return { id, ...plan };
  } catch (err) {
    console.error('createPlan error:', err);
    return { error: err.message };
  }
};

/**
 * Get a plan by ID (alias for getLearningPlanById without token)
 * @param {string} id - Plan ID
 * @returns {Object|null} Plan
 */
export const getPlan = (id) => {
  try {
    const stmt = db.prepare('SELECT * FROM learning_plan WHERE id = ?');
    const row = stmt.get(id);
    if (!row) return null;

    let planData = null;
    try {
      planData = row.plan_data ? JSON.parse(row.plan_data) : {};
    } catch (e) {
      console.warn(
        `[LearningPlanManager] Corrupt plan_data JSON for plan ${id}:`,
        e?.message,
      );
      planData = {};
    }

    return {
      id: row.id,
      ...planData,
      currentPhase: row.current_phase,
      currentDay: row.current_day,
      status: row.status,
    };
  } catch (err) {
    console.error('getPlan error:', err);
    return null;
  }
};

/**
 * Get all plans (alias for getLearningPlans without token)
 * @param {Object} options - Query options
 * @returns {Array} Plans
 */
export const getPlans = (options = {}) => {
  const { status, limit = 50, page = 1 } = options;
  const offset = (page - 1) * limit;

  try {
    let query = 'SELECT * FROM learning_plan WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);

    return rows.map((row) => {
      let planData = {};
      try {
        planData = row.plan_data ? JSON.parse(row.plan_data) : {};
      } catch (e) {
        console.warn(
          `[LearningPlanManager] Corrupt plan_data JSON for plan ${row.id}:`,
          e?.message,
        );
        planData = {};
      }
      return {
        id: row.id,
        ...planData,
        status: row.status,
        createdAt: row.created_at,
      };
    });
  } catch (err) {
    console.error('getPlans error:', err);
    return [];
  }
};

/**
 * Add a learning point to a plan
 * @param {string} planId - Plan ID
 * @param {Object} point - Learning point data
 * @returns {Object} Result
 */
export const addLearningPoint = (planId, point) => {
  try {
    const plan = getPlan(planId);
    if (!plan) return { error: 'Plan not found' };

    // Get current plan data
    const stmt = db.prepare('SELECT plan_data FROM learning_plan WHERE id = ?');
    const row = stmt.get(planId);
    if (!row) return { error: 'Plan not found' };

    let planData = {};
    try {
      planData = row.plan_data ? JSON.parse(row.plan_data) : {};
    } catch (e) {
      console.warn(
        `[LearningPlanManager] Corrupt plan_data JSON for plan ${planId}:`,
        e?.message,
      );
      planData = {};
    }

    // Initialize learningPoints array if needed
    if (!planData.learningPoints) {
      planData.learningPoints = [];
    }

    // Add the point with an ID
    const pointWithId = {
      id:
        point.id ||
        `point_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      ...point,
    };
    planData.learningPoints.push(pointWithId);

    // Update plan
    const updateStmt = db.prepare(
      'UPDATE learning_plan SET plan_data = ?, updated_at = ? WHERE id = ?',
    );
    updateStmt.run(
      JSON.stringify(planData),
      dateToSQLiteString(new Date()),
      planId,
    );

    return { success: true, point: pointWithId };
  } catch (err) {
    console.error('addLearningPoint error:', err);
    return { error: err.message };
  }
};

/**
 * Get learning points for a plan
 * @param {string} planId - Plan ID
 * @returns {Array} Learning points
 */
export const getLearningPoints = (planId) => {
  try {
    const stmt = db.prepare('SELECT plan_data FROM learning_plan WHERE id = ?');
    const row = stmt.get(planId);
    if (!row) return [];

    let planData = {};
    try {
      planData = row.plan_data ? JSON.parse(row.plan_data) : {};
    } catch (e) {
      console.warn(
        `[LearningPlanManager] Corrupt plan_data JSON for plan ${planId}:`,
        e?.message,
      );
      planData = {};
    }

    // Normalize front/back to strings (handle both object and string formats)
    const points = planData.learningPoints || [];
    return points.map((point) => ({
      ...point,
      front: typeof point.front === 'object' ? point.front?.text : point.front,
      back: typeof point.back === 'object' ? point.back?.text : point.back,
    }));
  } catch (err) {
    console.error('getLearningPoints error:', err);
    return [];
  }
};

/**
 * Get items due for review
 * @param {string} planId - Plan ID (optional, null for all plans)
 * @param {number} limit - Max items to return
 * @returns {Array} Due items
 */
export const getDueItems = (planId = null, limit = 20) => {
  try {
    const now = new Date().toISOString();
    let query = 'SELECT * FROM learning_plan WHERE status = ?';
    const params = ['active'];

    if (planId) {
      query += ' AND id = ?';
      params.push(planId);
    }

    const stmt = db.prepare(query);
    const plans = stmt.all(...params);

    const dueItems = [];

    for (const plan of plans) {
      let planData = {};
      try {
        planData = plan.plan_data ? JSON.parse(plan.plan_data) : {};
      } catch (e) {
        console.warn(
          `[LearningPlanManager] Corrupt plan_data JSON for plan ${plan.id}:`,
          e?.message,
        );
        planData = {};
      }

      const points = planData.learningPoints || [];
      for (const point of points) {
        // Item is due if nextReview is in the past or null
        if (!point.nextReview || point.nextReview <= now) {
          // Normalize front/back to strings (handle both object and string formats)
          const normalizedPoint = {
            ...point,
            front:
              typeof point.front === 'object' ? point.front?.text : point.front,
            back:
              typeof point.back === 'object' ? point.back?.text : point.back,
            planId: plan.id,
            planName: planData.name,
          };
          dueItems.push(normalizedPoint);
        }
        if (dueItems.length >= limit) break;
      }
      if (dueItems.length >= limit) break;
    }

    return dueItems;
  } catch (err) {
    console.error('getDueItems error:', err);
    return [];
  }
};

/**
 * Get items due for review with LLM-driven reconciliation
 * This enhanced version uses the ScheduleReconciliationAgent for intelligent prioritization
 *
 * @param {string} planId - Plan ID (optional, null for all plans)
 * @param {number} limit - Max items to return
 * @param {string} token - User token
 * @param {Object} options - Additional options
 * @param {boolean} options.useReconciliation - Whether to use LLM reconciliation (default: true)
 * @param {Object} options.reconciler - ScheduleReconciliationAgent instance
 * @returns {Promise<Object>} Due items with reconciliation data
 */
export const getDueItemsReconciled = async (
  planId = null,
  limit = 20,
  token = null,
  options = {},
) => {
  const { useReconciliation = true, reconciler = null } = options;

  // Get basic due items first
  const basicDueItems = getDueItems(planId, limit * 2); // Get more items for reconciliation

  // If reconciliation is disabled or no reconciler, return basic items
  if (!useReconciliation || !reconciler) {
    return {
      items: basicDueItems.slice(0, limit),
      reconciled: false,
      source: 'basic',
    };
  }

  try {
    // Use the reconciler to get prioritized items
    const reconcileResult = await reconciler.getDueItemsReconciled(
      planId,
      token,
      limit,
    );

    if (reconcileResult.error) {
      console.warn(
        'Reconciliation failed, falling back to basic items:',
        reconcileResult.error,
      );
      return {
        items: basicDueItems.slice(0, limit),
        reconciled: false,
        source: 'basic_fallback',
        error: reconcileResult.error,
      };
    }

    return {
      items: reconcileResult.items || [],
      reconciled: true,
      source: 'reconciled',
      context: reconcileResult.context,
      adjustments: reconcileResult.adjustments,
      sessionPlan: reconcileResult.sessionPlan,
      recommendations: reconcileResult.recommendations,
    };
  } catch (err) {
    console.error('getDueItemsReconciled error:', err);
    return {
      items: basicDueItems.slice(0, limit),
      reconciled: false,
      source: 'error_fallback',
      error: err.message,
    };
  }
};

/**
 * Calculate days overdue for an item
 * @param {Object} item - Learning point with nextReview
 * @returns {number} Days overdue (0 if not overdue)
 */
export const calculateDaysOverdue = (item) => {
  if (!item.nextReview) return 0;

  const now = new Date();
  const nextReview = new Date(item.nextReview);

  if (nextReview > now) return 0;

  const diffMs = now - nextReview;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

/**
 * Get overdue items grouped by severity
 * @param {string} planId - Plan ID (optional)
 * @param {Object} profile - Learner profile with optimalReviewInterval
 * @returns {Object} Grouped overdue items
 */
export const getOverdueItemsByGap = (planId = null, profile = null) => {
  const dueItems = getDueItems(planId, 1000); // Get all due items
  const optimalInterval = profile?.optimalReviewInterval || 3;

  const grouped = {
    critical: [], // > 2x optimal interval overdue
    important: [], // 1-2x optimal interval overdue
    routine: [], // < 1x optimal interval overdue
    total: 0,
  };

  for (const item of dueItems) {
    const daysOverdue = calculateDaysOverdue(item);
    item.daysOverdue = daysOverdue;

    if (daysOverdue > optimalInterval * 2) {
      grouped.critical.push(item);
    } else if (daysOverdue > optimalInterval) {
      grouped.important.push(item);
    } else {
      grouped.routine.push(item);
    }
    grouped.total++;
  }

  // Sort each group by days overdue (most overdue first)
  grouped.critical.sort((a, b) => b.daysOverdue - a.daysOverdue);
  grouped.important.sort((a, b) => b.daysOverdue - a.daysOverdue);
  grouped.routine.sort((a, b) => b.daysOverdue - a.daysOverdue);

  return grouped;
};

/**
 * Update a learning point
 * @param {string} pointId - Point ID
 * @param {Object} updates - Updates to apply
 * @returns {Object} Result
 */
export const updateLearningPoint = (pointId, updates) => {
  try {
    // Find the plan containing this point
    const allPlans = db.prepare('SELECT * FROM learning_plan').all();

    for (const plan of allPlans) {
      let planData = {};
      try {
        planData = plan.plan_data ? JSON.parse(plan.plan_data) : {};
      } catch (e) {
        console.warn(
          `[LearningPlanManager] Skipping plan ${plan.id}: corrupt plan_data JSON`,
          e?.message,
        );
        continue;
      }

      const points = planData.learningPoints || [];
      const pointIndex = points.findIndex((p) => p.id === pointId);

      if (pointIndex >= 0) {
        // Update the point
        points[pointIndex] = { ...points[pointIndex], ...updates };
        planData.learningPoints = points;

        // Save
        const updateStmt = db.prepare(
          'UPDATE learning_plan SET plan_data = ?, updated_at = ? WHERE id = ?',
        );
        updateStmt.run(
          JSON.stringify(planData),
          dateToSQLiteString(new Date()),
          plan.id,
        );

        return { success: true, point: points[pointIndex] };
      }
    }

    return { error: 'Point not found' };
  } catch (err) {
    console.error('updateLearningPoint error:', err);
    return { error: err.message };
  }
};

/**
 * Update plan progress
 * @param {string} planId - Plan ID
 * @returns {Object} Result
 */
export const updatePlanProgress = (planId) => {
  try {
    const points = getLearningPoints(planId);

    const progress = {
      completed: points.filter((p) => p.box === 5).length,
      mastered: points.filter((p) => p.box >= 4).length,
      currentBox: {
        1: points.filter((p) => p.box === 1).length,
        2: points.filter((p) => p.box === 2).length,
        3: points.filter((p) => p.box === 3).length,
        4: points.filter((p) => p.box === 4).length,
        5: points.filter((p) => p.box === 5).length,
      },
    };

    // Update the plan
    const stmt = db.prepare('SELECT plan_data FROM learning_plan WHERE id = ?');
    const row = stmt.get(planId);
    if (!row) return { error: 'Plan not found' };

    let planData = {};
    try {
      planData = row.plan_data ? JSON.parse(row.plan_data) : {};
    } catch (e) {
      console.warn(
        `[LearningPlanManager] Corrupt plan_data JSON for plan ${planId}:`,
        e?.message,
      );
      planData = {};
    }

    planData.progress = progress;

    const updateStmt = db.prepare(
      'UPDATE learning_plan SET plan_data = ?, updated_at = ? WHERE id = ?',
    );
    updateStmt.run(
      JSON.stringify(planData),
      dateToSQLiteString(new Date()),
      planId,
    );

    return { success: true, progress };
  } catch (err) {
    console.error('updatePlanProgress error:', err);
    return { error: err.message };
  }
};

/**
 * Update plan status
 * @param {string} planId - Plan ID
 * @param {string} status - New status
 * @returns {Object} Result
 */
export const updatePlanStatus = (planId, status) => {
  try {
    const stmt = db.prepare(
      'UPDATE learning_plan SET status = ?, updated_at = ? WHERE id = ?',
    );
    stmt.run(status, dateToSQLiteString(new Date()), planId);
    return { success: true };
  } catch (err) {
    console.error('updatePlanStatus error:', err);
    return { error: err.message };
  }
};

/**
 * Delete a plan
 * @param {string} planId - Plan ID
 * @returns {Object} Result
 */
export const deletePlan = (planId) => {
  try {
    const stmt = db.prepare('DELETE FROM learning_plan WHERE id = ?');
    const result = stmt.run(planId);
    return { success: result.changes > 0 };
  } catch (err) {
    console.error('deletePlan error:', err);
    return { error: err.message };
  }
};

export default {
  // Original methods
  getLearningPlanById,
  getLearningPlanByTopic,
  getLearningPlans,
  createLearningPlan,
  updateLearningPlan,
  deleteLearningPlan,
  advancePlanDay,
  startPlan,
  pausePlan,
  resumePlan,
  getTodaysItems,
  updatePlanItem,
  // Handler-compatible methods
  createPlan,
  getPlan,
  getPlans,
  addLearningPoint,
  getLearningPoints,
  getDueItems,
  getDueItemsReconciled,
  calculateDaysOverdue,
  getOverdueItemsByGap,
  updateLearningPoint,
  updatePlanProgress,
  updatePlanStatus,
  deletePlan,
};
