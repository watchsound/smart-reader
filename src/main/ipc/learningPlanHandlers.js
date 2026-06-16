/**
 * learningPlanHandlers.js
 *
 * IPC handlers for Learning Plan Wizard operations
 * - Plan creation and management
 * - Learning point import from various sources
 * - Schedule calculation
 */

const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Import services - these export singleton instances as default
const LearningPlanGeneratorModule = require('../utils/LearningPlanGenerator');
const LearningPointImporterModule = require('../utils/LearningPointImporter');

// Defense-in-depth gate for the file-import IPC.
//
// `filePath` arrives from the renderer (Electron's File.path off
// `<input type="file">`). A compromised renderer could pass any path
// the main process has access to — system files, credentials, other
// users' data. The legitimate file-picker flow always lands under the
// user's home directory, so we require the same.
//
// Reject sensitive subpaths a legitimate import would never use, and
// require the extension to match the declared fileType so a caller
// can't say "csv" while pointing at a credentials blob.
const FILE_TYPE_EXTENSIONS = {
  csv: ['.csv'],
  json: ['.json'],
  txt: ['.txt'],
  xlsx: ['.xlsx'],
  xls: ['.xls'],
};
const SENSITIVE_SEGMENTS = ['.ssh', '.aws', '.gnupg', '.config'];

const isImportPathSafe = (filePath, fileType) => {
  if (typeof filePath !== 'string' || !filePath) return false;
  const allowedExts = FILE_TYPE_EXTENSIONS[fileType];
  if (!allowedExts) return false;
  const ext = path.extname(filePath).toLowerCase();
  if (!allowedExts.includes(ext)) return false;
  const resolved = path.resolve(filePath);
  const homeDir = path.resolve(os.homedir());
  if (resolved !== homeDir && !resolved.startsWith(homeDir + path.sep)) return false;
  const segments = resolved.split(path.sep);
  if (segments.some((seg) => SENSITIVE_SEGMENTS.includes(seg))) return false;
  return true;
};

// Get the default export (singleton instance) from ES modules
const planGenerator = LearningPlanGeneratorModule.default || LearningPlanGeneratorModule;
const importer = LearningPointImporterModule.default || LearningPointImporterModule;

/**
 * Register all learning plan IPC handlers
 * @param {Object} store - Electron store instance
 * @param {Object} services - Service instances (dbManager, aiProvider, etc.)
 */
function registerLearningPlanHandlers(store, services) {
  const { dbManager, aiProvider } = services;

  /**
   * Create a new learning plan
   */
  ipcMain.handle('learning-plan-create', async (event, planData) => {
    try {
      const {
        goalName,
        domainType,
        description,
        sourceType,
        sourceId,
        learningPoints,
        dailyMinutes,
        targetDate,
        preferredTimeOfDay,
        enableReminders,
        syncProgress,
      } = planData;

      // Generate the plan schedule
      const schedule = await planGenerator.generatePlan({
        totalItems: learningPoints.length,
        dailyMinutes,
        targetDate: targetDate ? new Date(targetDate) : null,
        domain: domainType,
        algorithm: 'leitner',
      });

      // Create plan record in database
      const plan = {
        id: `plan_${Date.now()}`,
        name: goalName,
        domain: domainType,
        description: description || '',
        sourceType,
        sourceId,
        totalItems: learningPoints.length,
        dailyMinutes,
        targetDate: targetDate ? new Date(targetDate).toISOString() : null,
        preferredTimeOfDay,
        enableReminders,
        syncProgress,
        schedule: schedule,
        status: 'active',
        progress: {
          completed: 0,
          mastered: 0,
          currentBox: { 1: learningPoints.length, 2: 0, 3: 0, 4: 0, 5: 0 },
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save plan to database
      if (dbManager?.learningPlanManager) {
        await dbManager.learningPlanManager.createPlan(plan);

        // Save learning points - normalize front/back to strings
        for (const point of learningPoints) {
          // Handle both object format {text: '...'} and string format
          const normalizedPoint = {
            ...point,
            front: typeof point.front === 'object' ? point.front?.text : point.front,
            back: typeof point.back === 'object' ? point.back?.text : point.back,
            box: 1, // Start in box 1
            lastReview: null,
            nextReview: new Date().toISOString(),
            reviewCount: 0,
            correctCount: 0,
          };
          await dbManager.learningPlanManager.addLearningPoint(plan.id, normalizedPoint);
        }
      }

      // Sync to knowledge graph if enabled
      if (syncProgress && services.graphInterface) {
        try {
          await services.graphInterface.createLearningPlan(plan);
          for (const point of learningPoints) {
            // Normalize point before syncing
            const normalizedPoint = {
              ...point,
              front: typeof point.front === 'object' ? point.front?.text : point.front,
              back: typeof point.back === 'object' ? point.back?.text : point.back,
            };
            await services.graphInterface.createLearningPoint(plan.id, normalizedPoint);
          }
        } catch (graphError) {
          console.error('Error syncing to graph:', graphError);
          // Continue even if graph sync fails
        }
      }

      return {
        success: true,
        plan: plan,
      };
    } catch (error) {
      console.error('Error creating learning plan:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Calculate plan schedule without creating
   */
  ipcMain.handle('learning-plan-calculate', async (event, params) => {
    try {
      const { totalItems, dailyMinutes, targetDate, domain, algorithm } = params;

      const plan = await planGenerator.generatePlan({
        totalItems,
        dailyMinutes,
        targetDate: targetDate ? new Date(targetDate) : null,
        domain,
        algorithm: algorithm || 'leitner',
      });

      return {
        success: true,
        plan: plan,
      };
    } catch (error) {
      console.error('Error calculating plan:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Import learning points from file
   */
  ipcMain.handle('learning-point-import-file', async (event, params) => {
    try {
      const { filePath, fileType, domain, columnMapping } = params;

      if (!isImportPathSafe(filePath, fileType)) {
        return {
          success: false,
          error: 'Import path is not permitted. Pick a file from your home directory with a supported extension (csv, json, txt, xlsx, xls).',
        };
      }

      // Read file content
      const content = fs.readFileSync(filePath, 'utf-8');

      let items;
      switch (fileType) {
        case 'csv':
          items = await importer.parseCSV(content, columnMapping);
          break;
        case 'json':
          items = await importer.parseJSON(content);
          break;
        case 'txt':
          items = await importer.parsePlainText(content, { domain });
          break;
        case 'xlsx':
        case 'xls':
          items = await importer.parseExcel(filePath, columnMapping);
          break;
        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }

      // Get available columns for CSV/Excel
      let columns = null;
      if ((fileType === 'csv' || fileType === 'xlsx' || fileType === 'xls') && !columnMapping) {
        columns = await importer.getAvailableColumns(content, fileType);
      }

      return {
        success: true,
        items: items,
        columns: columns,
      };
    } catch (error) {
      console.error('Error importing file:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Extract learning points from a book
   */
  ipcMain.handle('learning-point-extract-from-book', async (event, params) => {
    try {
      const { bookId, domain } = params;

      // Get book info
      const book = await dbManager?.bookManager?.getBook(bookId);
      if (!book) {
        throw new Error('Book not found');
      }

      // Extract content based on book type
      let items = [];

      if (domain === 'vocabulary' && book.keywords) {
        // Use existing keywords as vocabulary items
        const keywords = JSON.parse(book.keywords || '[]');
        items = keywords.map((kw, index) => ({
          id: `book_${bookId}_kw_${index}`,
          front: kw.word || kw,
          back: kw.definition || '',
          tags: [book.title],
          difficulty: 'medium',
          source: 'book',
          sourceId: bookId,
        }));
      } else if (book.bookmarks) {
        // Use bookmarks/highlights as learning points
        const bookmarks = JSON.parse(book.bookmarks || '[]');
        items = bookmarks.map((bm, index) => ({
          id: `book_${bookId}_bm_${index}`,
          front: bm.text?.substring(0, 100) || bm.note,
          back: bm.note || bm.text,
          tags: [book.title],
          difficulty: 'medium',
          source: 'book',
          sourceId: bookId,
        }));
      }

      return {
        success: true,
        items: items,
      };
    } catch (error) {
      console.error('Error extracting from book:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Load learning points from vocabulary set
   */
  ipcMain.handle('learning-point-from-vocabulary', async (event, params) => {
    try {
      const { setId } = params;

      // Get vocabulary cards from the set
      const vocab = await dbManager?.vocabularyManager?.getVocabularyBySet(setId);
      if (!vocab || vocab.length === 0) {
        return {
          success: true,
          items: [],
        };
      }

      const items = vocab.map((v) => ({
        id: `vocab_${v.id}`,
        front: v.word,
        back: v.definition || v.meaning || '',
        tags: v.tags ? JSON.parse(v.tags) : [],
        difficulty: v.difficulty || 'medium',
        source: 'vocabulary',
        sourceId: v.id,
      }));

      return {
        success: true,
        items: items,
      };
    } catch (error) {
      console.error('Error loading vocabulary:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Import learning points from URL
   */
  ipcMain.handle('learning-point-import-url', async (event, params) => {
    try {
      const { url, domain } = params;

      const items = await importer.importFromURL(url, domain);

      return {
        success: true,
        items: items,
      };
    } catch (error) {
      console.error('Error importing from URL:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Get all learning plans
   */
  ipcMain.handle('learning-plan-list', async (event, params) => {
    try {
      const { status, page = 1, limit = 20 } = params || {};

      const plans = await dbManager?.learningPlanManager?.getPlans({
        status,
        page,
        limit,
      });

      return {
        success: true,
        plans: plans || [],
      };
    } catch (error) {
      console.error('Error listing plans:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Get a single learning plan with progress
   */
  ipcMain.handle('learning-plan-get', async (event, planId) => {
    try {
      const plan = await dbManager?.learningPlanManager?.getPlan(planId);
      if (!plan) {
        return {
          success: false,
          error: 'Plan not found',
        };
      }

      // Get learning points with current status
      const points = await dbManager?.learningPlanManager?.getLearningPoints(planId);

      return {
        success: true,
        plan: {
          ...plan,
          learningPoints: points || [],
        },
      };
    } catch (error) {
      console.error('Error getting plan:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Get due items for review
   */
  ipcMain.handle('learning-plan-get-due', async (event, params) => {
    try {
      const { planId, limit = 20 } = params || {};

      const dueItems = await dbManager?.learningPlanManager?.getDueItems(planId, limit);

      return {
        success: true,
        items: dueItems || [],
      };
    } catch (error) {
      console.error('Error getting due items:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Record review result
   */
  ipcMain.handle('learning-plan-record-review', async (event, params) => {
    try {
      const { planId, pointId, correct, responseTime } = params;

      // Update learning point based on result
      const result = await planGenerator.processReview({
        planId,
        pointId,
        correct,
        responseTime,
      });

      // Update in database
      await dbManager?.learningPlanManager?.updateLearningPoint(pointId, result);

      // Update plan progress
      await dbManager?.learningPlanManager?.updatePlanProgress(planId);

      // Sync to graph if enabled
      const plan = await dbManager?.learningPlanManager?.getPlan(planId);
      if (plan?.syncProgress && services.graphInterface) {
        try {
          await services.graphInterface.updateLearningPointAfterReview(
            pointId,
            correct,
            result.newBox
          );
        } catch (graphError) {
          console.error('Error syncing review to graph:', graphError);
        }
      }

      return {
        success: true,
        result: result,
      };
    } catch (error) {
      console.error('Error recording review:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Pause/resume a learning plan
   */
  ipcMain.handle('learning-plan-toggle-status', async (event, params) => {
    try {
      const { planId, status } = params;

      await dbManager?.learningPlanManager?.updatePlanStatus(planId, status);

      return {
        success: true,
        status: status,
      };
    } catch (error) {
      console.error('Error toggling plan status:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Delete a learning plan
   */
  ipcMain.handle('learning-plan-delete', async (event, planId) => {
    try {
      await dbManager?.learningPlanManager?.deletePlan(planId);

      // Remove from graph if exists
      if (services.graphInterface) {
        try {
          await services.graphInterface.deleteLearningPlan(planId);
        } catch (graphError) {
          console.error('Error deleting plan from graph:', graphError);
        }
      }

      return {
        success: true,
      };
    } catch (error) {
      console.error('Error deleting plan:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Get vocabulary sets for selection
   */
  ipcMain.handle('vocabulary-get-sets', async (event, params = {}) => {
    try {
      const { token } = params;
      // Use the getVocabularySetByQuery function from VocabularySetManager
      const { getVocabularySetByQuery } = require('../db/VocabularySetManager');
      const result = getVocabularySetByQuery('', 1, 100, token);

      // Map to expected format with count of words per set
      const { getVocabulariesBySetId } = require('../db/VocabularyManager');
      const sets = (result?.data || []).map((set) => {
        // Get count of vocabularies in this set
        const vocabs = getVocabulariesBySetId(set.id, token) || [];
        return {
          id: set.id,
          name: set.name,
          count: vocabs.length,
          score: set.score,
          lastTimeAt: set.lastTimeAt,
          createdAt: set.createdAt,
        };
      });

      return sets;
    } catch (error) {
      console.error('Error getting vocabulary sets:', error);
      return [];
    }
  });

  /**
   * Get books for selection in Learning Plan wizard
   */
  ipcMain.handle('book-list', async (event, params = {}) => {
    try {
      const { page = 1, limit = 50, token } = params;
      // Use the getBooks function from BookManager
      const { getBooks } = require('../db/BookManager');
      const books = getBooks(token);

      // Map books to expected format (field name: 'title' from db column 'name')
      const items = (books || []).map((book) => ({
        id: book.id,
        title: book.name || book.title,
        author: book.author,
        cover: book.cover,
        format: book.format,
        path: book.path,
      }));

      // Return in expected format
      return {
        items,
        total: items.length,
        page,
        limit,
      };
    } catch (error) {
      console.error('Error getting books:', error);
      return {
        items: [],
        total: 0,
        page: 1,
        limit: 50,
        error: error.message,
      };
    }
  });

  // ============================================
  // Study Session Handlers
  // Using existing LearningSessionManager methods
  // ============================================

  /**
   * Start a new study session
   * Uses startLearningSession from LearningSessionManager
   */
  ipcMain.handle('study-session-start', async (event, params) => {
    try {
      const { planId, mode, itemCount, token } = params;

      // Use the existing LearningSessionManager
      const LearningSessionManager = require('../db/LearningSessionManager');

      const session = LearningSessionManager.startLearningSession({
        planId: planId || null,
        topicId: planId || 'study_session', // Required field
        sessionType: mode || 'standard',
        itemsNew: 0,
      }, token);

      if (session.error) {
        return {
          success: false,
          error: session.error,
        };
      }

      return {
        success: true,
        sessionId: session.id,
        session: session,
      };
    } catch (error) {
      console.error('Error starting study session:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Complete a study session
   * Uses completeLearningSession from LearningSessionManager
   */
  ipcMain.handle('study-session-complete', async (event, params) => {
    try {
      const { sessionId, stats, token } = params;

      const LearningSessionManager = require('../db/LearningSessionManager');

      const result = LearningSessionManager.completeLearningSession(
        sessionId,
        {
          itemsReviewed: stats?.itemsReviewed || 0,
          itemsCorrect: stats?.correctCount || 0,
          itemsNew: stats?.newCount || 0,
          sessionData: {
            duration: stats?.duration || 0,
            avgRating: stats?.avgRating || 0,
            ratings: stats?.ratings || {},
          },
        },
        token
      );

      if (result.error) {
        return {
          success: false,
          error: result.error,
        };
      }

      return {
        success: true,
        session: result,
      };
    } catch (error) {
      console.error('Error completing study session:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Get session history
   * Uses getRecentSessions from LearningSessionManager
   */
  ipcMain.handle('study-session-history', async (event, params) => {
    try {
      const { planId, limit = 10, token } = params || {};

      const LearningSessionManager = require('../db/LearningSessionManager');

      // Get recent sessions (last 30 days by default)
      let sessions = LearningSessionManager.getRecentSessions(token, 30);

      // Filter by planId if provided
      if (planId && planId !== 'all') {
        sessions = sessions.filter(s => s.planId === planId);
      }

      // Apply limit
      sessions = sessions.slice(0, limit);

      return {
        success: true,
        sessions: sessions || [],
      };
    } catch (error) {
      console.error('Error getting session history:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Get daily review data for calendar heatmap
   * Aggregates from LearningSessionManager.getDailyActivity
   */
  ipcMain.handle('learning-plan-daily-data', async (event, params) => {
    try {
      const { startDate, endDate, planId, token } = params;

      const LearningSessionManager = require('../db/LearningSessionManager');

      // Calculate days between dates
      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

      // Get daily activity data
      const dailyActivity = LearningSessionManager.getDailyActivity(token, daysDiff);

      // Convert to date-keyed object
      const data = {};
      for (const activity of dailyActivity) {
        const dateKey = activity.date.toISOString().split('T')[0];

        // Filter by planId/topicId if provided
        if (planId && planId !== 'all' && activity.topicId !== planId) {
          continue;
        }

        // Aggregate multiple sessions on same day
        if (!data[dateKey]) {
          data[dateKey] = {
            reviewed: 0,
            correct: 0,
            sessions: 0,
            duration: 0,
          };
        }

        data[dateKey].reviewed += activity.itemsReviewed || 0;
        data[dateKey].correct += activity.itemsCorrect || 0;
        data[dateKey].sessions += activity.sessionsCount || 0;
        data[dateKey].duration += activity.totalMinutes || 0;
      }

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      console.error('Error getting daily review data:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Get forecast for upcoming reviews
   * Calculates based on learning points' next review dates
   */
  ipcMain.handle('learning-plan-forecast', async (event, params) => {
    try {
      const { days = 7, planId, token } = params || {};

      const forecast = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Try to get due items from learning plan manager
      let allDueItems = [];
      if (dbManager?.learningPlanManager?.getDueItems) {
        allDueItems = await dbManager.learningPlanManager.getDueItems(planId, 1000);
      }

      // Group due items by their nextReview date
      const dueByDate = {};
      for (const item of allDueItems) {
        const nextReview = item.nextReview ? new Date(item.nextReview) : today;
        const dateKey = nextReview.toISOString().split('T')[0];
        if (!dueByDate[dateKey]) {
          dueByDate[dateKey] = [];
        }
        dueByDate[dateKey].push(item);
      }

      // Build forecast for each day
      for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        const dateKey = date.toISOString().split('T')[0];

        // Count items due on this date or earlier (overdue)
        let dueCount = 0;
        for (const [dueDate, items] of Object.entries(dueByDate)) {
          if (dueDate <= dateKey) {
            dueCount += items.length;
          }
        }

        // For day 0 (today), include all overdue items
        // For future days, only count items scheduled for that specific day
        if (i > 0) {
          dueCount = (dueByDate[dateKey] || []).length;
        }

        forecast.push({
          date: dateKey,
          dueCount: dueCount,
          newCount: 0, // Could calculate from introduction schedule
          reviewCount: dueCount,
        });
      }

      return {
        success: true,
        forecast: forecast,
      };
    } catch (error) {
      console.error('Error getting forecast:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  console.log('Learning plan IPC handlers registered');
}

module.exports = { registerLearningPlanHandlers };
