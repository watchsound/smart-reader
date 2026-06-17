/**
 * LearningBrainAgent - The main brain logic orchestrator
 *
 * Coordinates with existing skills (AdaptiveLearningSkill, LearningGraphSkill)
 * to perform learning analysis during heartbeat.
 *
 * Key responsibilities:
 * - Run BRAIN_CHECKLIST tasks during heartbeat
 * - Coordinate with existing adaptive learning skills
 * - Generate insights and recommendations
 * - Trigger notifications based on patterns
 * - Consolidate episodic memories using LLM synthesis
 */

const ConsolidationService = require('../utils/ConsolidationService');
const MoodBoardOrganizerService = require('./MoodBoardOrganizerService');
const ProductionPromptService = require('./ProductionPromptService');
const {
  createNotification,
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES,
} = require('../db/NotificationManager');

const NOTIF_DEDUP_KEY = 'learningBrain.notifDedup';

// Map the brain's internal nudge `type` to NotificationManager fields.
// Anything not listed falls back to SYSTEM/NORMAL with no actionUrl.
const NUDGE_TYPE_MAP = {
  streakAlert: {
    type: NOTIFICATION_TYPES.STREAK,
    priority: NOTIFICATION_PRIORITIES.HIGH,
    actionUrl: '/vocabulary',
    actionLabel: 'Keep streak',
  },
  dailySummary: {
    type: NOTIFICATION_TYPES.STUDY_REMINDER,
    priority: NOTIFICATION_PRIORITIES.NORMAL,
    actionUrl: '/vocabulary',
    actionLabel: 'Review',
  },
  welcomeBack: {
    type: NOTIFICATION_TYPES.SYSTEM,
    priority: NOTIFICATION_PRIORITIES.NORMAL,
    actionUrl: '/knowledge',
    actionLabel: 'Open dashboard',
  },
  struggleAlert: {
    type: NOTIFICATION_TYPES.STUDY_REMINDER,
    priority: NOTIFICATION_PRIORITIES.NORMAL,
    actionUrl: '/knowledge',
    actionLabel: 'See weak concepts',
  },
};

function getActiveSessionToken() {
  const sessionInfo = global?.shared?.store?.get?.('session_info');
  return sessionInfo?.token || null;
}

class LearningBrainAgent {
  constructor(services = {}) {
    this.services = services;
    this.store = services.store;
    this.aiProvider = services.aiProvider;

    // Existing skill instances (reuse, don't rebuild)
    this.adaptiveLearningSkill = services.adaptiveLearningSkill;
    this.learningGraphSkill = services.learningGraphSkill;

    // Database managers
    this.learningPlanManager = services.learningPlanManager;
    this.sessionAnalyticsManager = services.sessionAnalyticsManager;

    // Episode collector and Neo4j adapter
    this.episodeCollector = services.episodeCollector;
    this.neo4jAdapter = services.neo4jAdapter;

    // Consolidation service (LLM-powered memory synthesis)
    this.consolidationService = new ConsolidationService({
      aiProvider: this.aiProvider,
      episodeCollector: this.episodeCollector,
      neo4jAdapter: this.neo4jAdapter,
      store: this.store,
    });

    // Phase 8 organize loop: suggest MoodBoard organize sessions for
    // clusters of recently-added learning points (one nudge per cluster).
    // triggerEmitter is forwarded so the service also emits an Orb chip
    // alongside the existing in-app notification.
    this.moodBoardOrganizer = new MoodBoardOrganizerService({
      store: this.store,
      episodeCollector: this.episodeCollector,
      triggerEmitter: services.triggerEmitter || null,
    });

    // Phase 8 production loop: pick one well-mastered learning point per
    // heartbeat and prompt the user to explain it in their own words.
    // triggerEmitter is forwarded so the service also emits an Orb chip
    // alongside the existing in-app notification.
    this.productionPromptService = new ProductionPromptService({
      store: this.store,
      episodeCollector: this.episodeCollector,
      triggerEmitter: services.triggerEmitter || null,
    });

    // Cached insights from last heartbeat
    this.cachedInsights = null;
    this.lastAnalysisTime = null;

    // Brain-driven shell: TriggerEmitter (Plan 1 of AI-driven shell skeleton).
    // Set when present in services; Phase 4-8 services read it from the brain
    // instance to push Triggers to the renderer.
    this.triggerEmitter = services.triggerEmitter || null;
  }

  /**
   * Record renderer-side acceptance or dismissal of a Proposal. Persists
   * a per-source accept/dismiss tally to electron-store so trigger TTLs
   * and gating thresholds can be tuned against observed engagement.
   *
   * Storage shape (under `brainShell.triggerTelemetry`):
   *   { bySource: { <source>: { accepted, dismissed, lastEvent, lastEventKind } } }
   *
   * @param {{ proposalId: string, source?: string | null, kind: 'accept' | 'dismiss' }} event
   */
  async recordProposalEvent({ proposalId, source, kind }) {
    const safeSource =
      typeof source === 'string' && source ? source : 'unknown';
    if (!this.store) {
      // eslint-disable-next-line no-console
      console.log('[LearningBrainAgent] proposal event (no store)', {
        proposalId,
        source: safeSource,
        kind,
      });
      return;
    }
    try {
      const TELEMETRY_KEY = 'brainShell.triggerTelemetry';
      const raw = this.store.get(TELEMETRY_KEY, { bySource: {} });
      const telemetry =
        raw && typeof raw === 'object' && raw.bySource ? raw : { bySource: {} };
      const entry = telemetry.bySource[safeSource] || {
        accepted: 0,
        dismissed: 0,
        lastEvent: null,
        lastEventKind: null,
      };
      if (kind === 'accept') entry.accepted += 1;
      else if (kind === 'dismiss') entry.dismissed += 1;
      entry.lastEvent = new Date().toISOString();
      entry.lastEventKind = kind;
      telemetry.bySource[safeSource] = entry;
      this.store.set(TELEMETRY_KEY, telemetry);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        '[LearningBrainAgent] recordProposalEvent persist failed:',
        e?.message || e,
      );
    }
  }

  /**
   * Read trigger telemetry — used by a future Brain dashboard panel or
   * dev tooling to inspect per-source accept/dismiss rates.
   *
   * @returns {{ bySource: Record<string, { accepted: number, dismissed: number, lastEvent: string | null, lastEventKind: string | null }> }}
   */
  getTriggerTelemetry() {
    if (!this.store) return { bySource: {} };
    const raw = this.store.get('brainShell.triggerTelemetry', { bySource: {} });
    return raw && raw.bySource ? raw : { bySource: {} };
  }

  /**
   * Synthesize a "what's next?" suggestion when the user pulls and the
   * queue is empty. Plan 3: LLM-backed when aiProvider is available,
   * with a deterministic Quest-aware fallback.
   *
   * Returns: { title, body, navigate? } | null
   *
   * The result is consumed by the renderer-side triggerBus.pull() which
   * passes it to BrainShell.onOrbClick; consumers can render it as a
   * floating chip, narrate it, or enqueue it as a synthetic Proposal.
   */
  async synthesizePullSuggestion() {
    // Gather lightweight context. Each source is best-effort — failures
    // degrade gracefully to the deterministic fallback.
    let activeQuests = [];
    try {
      // Lazy require to avoid circular import with main brain bootstrap.
      const QuestService = require('../utils/QuestService');
      const questSvc = new QuestService(this.store);
      activeQuests = questSvc.list({ status: 'active' });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[LearningBrainAgent] quest fetch failed:', e?.message || e);
    }

    const deterministicFallback = () => {
      if (activeQuests.length > 0) {
        const q = activeQuests[0];
        const firstBook =
          q.bookIds && q.bookIds.length > 0 ? q.bookIds[0] : null;
        return {
          title: `Continue your quest: ${q.name}`,
          body: q.goal,
          navigate: firstBook ? `reading/${firstBook}` : null,
          source: 'deterministic-fallback',
        };
      }
      return {
        title: "You're caught up",
        body: 'No pending proposals and no active quests. Pick a book to keep going.',
        navigate: 'bookshelf',
        source: 'deterministic-fallback',
      };
    };

    if (!this.aiProvider) return deterministicFallback();

    // Compact context block — kept tight to control prompt cost.
    const questBlock =
      activeQuests.length === 0
        ? '(no active quests)'
        : activeQuests
            .slice(0, 3)
            .map(
              (q, i) =>
                `${i + 1}. "${q.name}" — ${q.goal} (${q.bookIds?.length || 0} books)`,
            )
            .join('\n');

    const prompt = `You are the learner's coach. Suggest ONE specific next action.

Active quests:
${questBlock}

Reply strictly as JSON with this shape:
{
  "title": "short imperative — what to do (max 50 chars)",
  "body": "one sentence why (max 120 chars)",
  "navigate": "route path (e.g. reading/3, vocabulary, knowledge) or null if no specific surface"
}`;

    try {
      const raw = await this.aiProvider.generateContentWithJson(prompt, true);
      const parsed =
        typeof raw === 'string'
          ? JSON.parse(raw)
          : raw && typeof raw === 'object'
            ? raw
            : null;
      if (
        parsed &&
        typeof parsed.title === 'string' &&
        typeof parsed.body === 'string'
      ) {
        return {
          title: String(parsed.title).slice(0, 80),
          body: String(parsed.body).slice(0, 200),
          navigate:
            typeof parsed.navigate === 'string' && parsed.navigate.trim()
              ? parsed.navigate.trim().replace(/^\/+/, '')
              : null,
          source: 'llm',
        };
      }
      // Parsed but didn't match shape — fall through.
      return deterministicFallback();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        '[LearningBrainAgent] synthesizePullSuggestion LLM failed:',
        e?.message || e,
      );
      return deterministicFallback();
    }
  }

  /**
   * Run the heartbeat - main brain logic
   * @param {Object} options
   * @param {boolean} options.isCatchUp - Is this a catch-up run
   * @param {boolean} options.manual - Was this manually triggered
   * @param {string} options.mode - 'service' or 'hybrid'
   * @returns {Promise<Object>}
   */
  async runHeartbeat(options = {}) {
    const { isCatchUp = false, manual = false, mode = 'hybrid' } = options;
    const startTime = Date.now();

    console.log('[LearningBrainAgent] Running heartbeat...', {
      isCatchUp,
      manual,
      mode,
    });

    const results = {
      success: true,
      checklistResults: [],
      insights: null,
      notifications: [],
      duration: 0,
    };

    try {
      // Get user context (single user mode for now)
      const userId = 1;
      const token = 'brain-heartbeat';

      // === BRAIN CHECKLIST ===

      // 1. Check items due for review
      const dueCheck = await this.checkDueItems(userId, token);
      results.checklistResults.push(dueCheck);

      // 2. Analyze recent performance (reuse AdaptiveLearningSkill)
      const perfAnalysis = await this.analyzePerformance(userId, token);
      results.checklistResults.push(perfAnalysis);

      // 3. Detect patterns (reuse AdaptiveLearningSkill)
      const patterns = await this.detectPatterns(userId, token);
      results.checklistResults.push(patterns);

      // 4. Check weak concepts (reuse LearningGraphSkill)
      const weakConcepts = await this.checkWeakConcepts(userId, token);
      results.checklistResults.push(weakConcepts);

      // 5. Update streak status
      const streakCheck = await this.checkStreak(userId, token);
      results.checklistResults.push(streakCheck);

      // 6. Calculate learning velocity
      const velocity = await this.calculateVelocity(userId, token);
      results.checklistResults.push(velocity);

      // 7. Suggest MoodBoard organize sessions for new concept clusters
      const organize = await this.suggestOrganizeSessions(userId, token);
      results.checklistResults.push(organize);

      // 8. Production loop: ask the user to explain one well-mastered point
      const production = await this.schedulePromptForProduction(userId, token);
      results.checklistResults.push(production);

      // === GENERATE INSIGHTS ===

      results.insights = this.generateInsights(results.checklistResults);
      this.cachedInsights = results.insights;
      this.lastAnalysisTime = new Date();

      // === DETERMINE NOTIFICATIONS ===

      results.notifications = this.determineNotifications(results.insights, {
        isCatchUp,
      });
      // Persist the POJOs so they actually show in the user's
      // NotificationsPanel. Without this, every existing nudge type
      // (streak / dailySummary / welcomeBack / struggleAlert) was computed
      // and silently dropped on each heartbeat.
      results.persistedNotifications = this.persistBrainNotifications(
        results.notifications,
      );

      // === MEMORY CONSOLIDATION (if not catch-up) ===

      if (!isCatchUp && !manual) {
        const consolidation = await this.runConsolidation(userId, token);
        results.checklistResults.push(consolidation);
      }

      // Phase 9 Spine: prune the Call Ledger nightly (idempotent if no rows due).
      try {
        const lastPrune = this._lastSpinePruneTs || 0;
        const oneDay = 24 * 3600 * 1000;
        if (Date.now() - lastPrune > oneDay) {
          const CallLedgerStore = require('../db/CallLedgerStore');
          const dropped = CallLedgerStore.prune({
            maxAgeMs: 90 * oneDay,
            maxRows: 10000,
          });
          this._lastSpinePruneTs = Date.now();
          if (dropped > 0) console.log(`[spine] pruned ${dropped} ledger rows`);
        }
      } catch (e) {
        console.warn('[spine] prune failed:', e.message);
      }

      results.duration = Date.now() - startTime;
      console.log(
        '[LearningBrainAgent] Heartbeat completed in',
        results.duration,
        'ms',
      );

      return results;
    } catch (error) {
      console.error('[LearningBrainAgent] Heartbeat error:', error);
      results.success = false;
      results.error = error.message;
      results.duration = Date.now() - startTime;
      return results;
    }
  }

  /**
   * Check items due for review
   * @param {number} userId
   * @param {string} token
   */
  // userId/token kept for signature symmetry with other checklist tasks
  // even though getDueItems doesn't need them.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async checkDueItems(userId, token) {
    const taskName = 'check_due_items';
    console.log(`[LearningBrainAgent] Running ${taskName}...`);

    try {
      let dueCount = 0;
      let overdueCount = 0;

      // getDueItems(planId, limit) — NOT an options object. The previous
      // call shape `getDueItems({userId, limit})` passed the object as
      // `planId`, made the SQL filter fail, and returned 0 every time.
      // Items use `nextReview` (camelCase from JSON), NOT `nextReviewDate`.
      // Params are underscored: getDueItems is plan-level and already
      // scopes by `status = 'active'`; userId/token aren't needed here.
      if (this.learningPlanManager) {
        const due = await this.learningPlanManager.getDueItems(null, 1000);
        dueCount = due.length;

        const now = new Date();
        overdueCount = due.filter((item) => {
          if (!item.nextReview) return false;
          return new Date(item.nextReview) < now;
        }).length;
      }

      return {
        task: taskName,
        success: true,
        result: { dueCount, overdueCount },
      };
    } catch (error) {
      return { task: taskName, success: false, error: error.message };
    }
  }

  /**
   * Analyze recent performance using AdaptiveLearningSkill
   * @param {number} userId
   * @param {string} token
   */
  async analyzePerformance(userId, token) {
    const taskName = 'analyze_performance';
    console.log(`[LearningBrainAgent] Running ${taskName}...`);

    try {
      if (this.adaptiveLearningSkill) {
        // Reuse existing skill
        const context = { userId, token };
        const result = await this.adaptiveLearningSkill.analyzePerformance(
          context,
          {
            days: 7,
          },
        );

        return {
          task: taskName,
          success: true,
          result,
        };
      }

      // Fallback: basic analysis from session analytics.
      // getSessionHistory's signature is (token, {days, limit, offset, topicId})
      // and it returns {sessions, total, hasMore}. The previous shape passed
      // {userId, startDate} as the token, used a startDate option that the
      // function ignores, and then called .reduce on the wrapper object
      // instead of the inner array — so this branch silently failed every
      // heartbeat. Same token-resolution trick as calculateVelocity.
      if (this.sessionAnalyticsManager) {
        const sessionInfo = global?.shared?.store?.get?.('session_info');
        const effectiveToken = sessionInfo?.token || token;
        const { sessions = [] } =
          this.sessionAnalyticsManager.getSessionHistory(effectiveToken, {
            days: 7,
          }) || {};

        const totalReviews = sessions.reduce(
          (sum, s) => sum + (s.itemsReviewed || 0),
          0,
        );
        const avgAccuracy =
          sessions.length > 0
            ? sessions.reduce(
                (sum, s) => sum + parseFloat(s.accuracy || 0),
                0,
              ) / sessions.length
            : 0;

        return {
          task: taskName,
          success: true,
          result: {
            totalReviews,
            avgAccuracy: Math.round(avgAccuracy),
            sessionCount: sessions.length,
          },
        };
      }

      return { task: taskName, success: true, result: { noData: true } };
    } catch (error) {
      return { task: taskName, success: false, error: error.message };
    }
  }

  /**
   * Detect learning patterns using AdaptiveLearningSkill
   * @param {number} userId
   * @param {string} token
   */
  async detectPatterns(userId, token) {
    const taskName = 'detect_patterns';
    console.log(`[LearningBrainAgent] Running ${taskName}...`);

    try {
      if (this.adaptiveLearningSkill) {
        const context = { userId, token };
        const result = await this.adaptiveLearningSkill.detectPatterns(
          context,
          {
            days: 30,
          },
        );

        return {
          task: taskName,
          success: true,
          result,
        };
      }

      // No skill available - return empty patterns
      return {
        task: taskName,
        success: true,
        result: { patterns: [], message: 'Pattern detection not available' },
      };
    } catch (error) {
      return { task: taskName, success: false, error: error.message };
    }
  }

  /**
   * Check weak concepts using LearningGraphSkill
   * @param {number} userId
   * @param {string} token
   */
  async checkWeakConcepts(userId, token) {
    const taskName = 'check_weak_concepts';
    console.log(`[LearningBrainAgent] Running ${taskName}...`);

    try {
      if (this.learningGraphSkill) {
        const context = { userId, token };
        const result = await this.learningGraphSkill.getWeakConcepts(context, {
          limit: 10,
        });

        return {
          task: taskName,
          success: true,
          result,
        };
      }

      // Try the Neo4j adapter only if it actually exposes the method —
      // GraphInterface doesn't (detectWeakConcepts lives on
      // GraphLearningFeatures and operates on Concept nodes, not
      // LearningPoint). The previous unconditional call threw TypeError
      // and silently returned 0 weak concepts forever.
      if (
        this.services.neo4jAdapter &&
        typeof this.services.neo4jAdapter.detectWeakConcepts === 'function'
      ) {
        const weak = await this.services.neo4jAdapter.detectWeakConcepts(
          10,
          token,
        );
        return {
          task: taskName,
          success: true,
          result: { weakConcepts: weak },
        };
      }

      // Default-deployment fallback: in production the brain is
      // constructed with `learningGraphSkill: null` and
      // `neo4jAdapter: graphInterface` (which lacks detectWeakConcepts),
      // so both blocks above skip. We previously fell through to a raw
      // SQL query on `learning_point`, but LearningPointService writes
      // only to the graph backend since the migration — the SQLite
      // table is empty for post-migration users and the query returned
      // `[]` forever. Read via the service instead; filter in JS to
      // match the original criteria.
      // eslint-disable-next-line global-require
      const learningPointService =
        require('../utils/LearningPointService').default ||
        require('../utils/LearningPointService');
      const page = await learningPointService.getAll(token, {
        pageSize: 5000,
      });
      const items = Array.isArray(page?.items) ? page.items : [];
      const weakConcepts = items
        .filter(
          (it) =>
            it &&
            typeof it.reviewCount === 'number' &&
            it.reviewCount >= 3 &&
            typeof it.masteryLevel === 'number' &&
            it.masteryLevel > 0 &&
            it.masteryLevel < 40,
        )
        .sort((a, b) => a.masteryLevel - b.masteryLevel)
        .slice(0, 10)
        .map((it) => ({
          id: it.id,
          title: it.title,
          name: it.title,
          masteryLevel: it.masteryLevel,
          reviewCount: it.reviewCount,
          domainType: it.domainType,
        }));
      return {
        task: taskName,
        success: true,
        result: { weakConcepts },
      };
    } catch (error) {
      return { task: taskName, success: false, error: error.message };
    }
  }

  /**
   * Check streak status
   * @param {number} userId
   * @param {string} token
   */
  async checkStreak(userId, token) {
    const taskName = 'check_streak';
    console.log(`[LearningBrainAgent] Running ${taskName}...`);

    try {
      let streakDays = 0;
      let streakAtRisk = false;

      // Real session token — the heartbeat passes a synthetic one that
      // getUserIdFromToken doesn't recognize. Same trick as the other
      // brain services that talk to the SQLite-backed managers.
      const effectiveToken = getActiveSessionToken() || token;

      // Streak count: profile.globalProfile.streakRecord is the canonical
      // field. Older comments here referenced a non-existent `getProfile`
      // method and a `currentStreak` field that no LearnerProfile schema
      // exposes — fixed to use the real exported getGlobalProfile API.
      const mgr = this.services.learnerProfileManager;
      if (mgr && typeof mgr.getGlobalProfile === 'function') {
        const profile = mgr.getGlobalProfile(effectiveToken);
        streakDays = profile?.globalProfile?.streakRecord || 0;
      }

      // Last study date: not on the profile, so query learning_session
      // directly. One row, indexed by (user_id, started_at).
      if (streakDays > 0) {
        try {
          // eslint-disable-next-line global-require
          const { default: db } = require('../db/dbManager');
          const row = db
            .prepare(
              `SELECT MAX(started_at) AS lastStartedAt
                 FROM learning_session WHERE user_id = ?`,
            )
            .get(userId);
          if (row?.lastStartedAt) {
            const today = new Date().toDateString();
            const lastDay = new Date(row.lastStartedAt).toDateString();
            if (lastDay !== today) {
              const hourOfDay = new Date().getHours();
              streakAtRisk = hourOfDay >= 18; // Evening
            }
          }
        } catch (err) {
          // Don't let a streak-source hiccup poison the rest of the heartbeat.
          console.error('[LearningBrainAgent] streak source failed:', err);
        }
      }

      return {
        task: taskName,
        success: true,
        result: { streakDays, streakAtRisk },
      };
    } catch (error) {
      return { task: taskName, success: false, error: error.message };
    }
  }

  /**
   * Calculate learning velocity
   * @param {number} userId
   * @param {string} token
   */
  async calculateVelocity(userId, token) {
    const taskName = 'calculate_velocity';
    console.log(`[LearningBrainAgent] Running ${taskName}...`);

    try {
      if (this.sessionAnalyticsManager) {
        const sessionInfo = global?.shared?.store?.get?.('session_info');
        const effectiveToken = sessionInfo?.token || token;
        const velocity =
          this.sessionAnalyticsManager.getAggregateVelocity(effectiveToken);

        return {
          task: taskName,
          success: true,
          result: velocity,
        };
      }

      return { task: taskName, success: true, result: { noData: true } };
    } catch (error) {
      return { task: taskName, success: false, error: error.message };
    }
  }

  /**
   * Phase 8: detect (book, domain) clusters of recently-added learning
   * points and emit a MoodBoard organize-session nudge for each new one.
   * Idempotent — re-running won't re-notify the same cluster.
   *
   * @param {number} userId
   * @param {string} token
   */
  async suggestOrganizeSessions(userId, token) {
    const taskName = 'suggest_organize_sessions';
    console.log(`[LearningBrainAgent] Running ${taskName}...`);

    try {
      if (!this.moodBoardOrganizer) {
        return {
          task: taskName,
          success: true,
          result: { skipped: 'no service' },
        };
      }
      // Use a real user token so createNotification can resolve userId.
      // The brain runs under userId=1 in single-user mode; downstream
      // notification IPC will accept the synthetic 'brain-heartbeat' token
      // only if getUserIdFromToken tolerates it — fall back to skipping
      // on failure rather than crashing the heartbeat.
      const result = this.moodBoardOrganizer.suggestOrganize(userId, token);
      return { task: taskName, success: true, result };
    } catch (error) {
      console.error(
        '[LearningBrainAgent] suggestOrganizeSessions error:',
        error,
      );
      return { task: taskName, success: false, error: error.message };
    }
  }

  /**
   * Phase 8 production loop: at most one "explain it in your own words"
   * nudge per heartbeat, drawn from learning points the user has already
   * passed recognition on. See ProductionPromptService for eligibility.
   *
   * @param {number} userId
   * @param {string} token
   */
  async schedulePromptForProduction(userId, token) {
    const taskName = 'schedule_production_prompt';
    console.log(`[LearningBrainAgent] Running ${taskName}...`);

    try {
      if (!this.productionPromptService) {
        return {
          task: taskName,
          success: true,
          result: { skipped: 'no service' },
        };
      }
      const result = await this.productionPromptService.schedulePrompt(
        userId,
        token,
      );
      return { task: taskName, success: true, result };
    } catch (error) {
      console.error(
        '[LearningBrainAgent] schedulePromptForProduction error:',
        error,
      );
      return { task: taskName, success: false, error: error.message };
    }
  }

  /**
   * Run memory consolidation using LLM-powered episode synthesis
   * Groups episodes by concept, detects context shifts, and uses AI to create
   * higher-level consolidated memories.
   *
   * @param {number} userId
   * @param {string} token
   * @param {Object} options
   * @param {number} options.periodDays - Look-back period (default: 7)
   * @param {number} options.minEpisodes - Min episodes to consolidate (default: 3)
   */
  async runConsolidation(userId, token, options = {}) {
    const taskName = 'memory_consolidation';
    console.log(`[LearningBrainAgent] Running ${taskName}...`);

    try {
      // Check if consolidation service is ready
      if (!this.consolidationService) {
        console.warn(
          '[LearningBrainAgent] Consolidation service not initialized',
        );
        return {
          task: taskName,
          success: false,
          result: { error: 'Consolidation service not available' },
        };
      }

      // Check if AI provider is available
      if (!this.aiProvider) {
        console.warn(
          '[LearningBrainAgent] AI provider not available for consolidation',
        );
        // Still run consolidation - it will use fallback synthesis
      }

      // Run consolidation
      const result = await this.consolidationService.consolidateEpisodes(
        userId,
        token,
        {
          periodDays: options.periodDays || 7,
          minEpisodes: options.minEpisodes || 3,
          contextShiftHours: options.contextShiftHours || 24,
        },
      );

      // If consolidation ran, also archive old episodes
      if (result.success && result.consolidated > 0) {
        const archiveResult =
          await this.consolidationService.archiveOldEpisodes(token);
        result.archived = archiveResult.archived || 0;
        result.deletedOld = archiveResult.deleted || 0;
      }

      return {
        task: taskName,
        success: result.success,
        result: {
          consolidated: result.consolidated || 0,
          totalEpisodes: result.totalEpisodes || 0,
          message:
            result.message ||
            `Consolidated ${result.consolidated || 0} memory clusters`,
          archived: result.archived || 0,
          deletedOld: result.deletedOld || 0,
        },
      };
    } catch (error) {
      console.error('[LearningBrainAgent] Consolidation error:', error);
      return {
        task: taskName,
        success: false,
        result: { error: error.message },
      };
    }
  }

  /**
   * Manually trigger consolidation (can be called from Settings UI)
   * @param {string} token
   * @param {Object} options
   */
  async triggerManualConsolidation(token, options = {}) {
    const userId = 1; // Single user mode for now
    return this.runConsolidation(userId, token, {
      ...options,
      manual: true,
    });
  }

  /**
   * Get consolidation statistics
   * @param {string} token
   */
  getConsolidationStats(token) {
    if (!this.consolidationService) {
      return { error: 'Consolidation service not available' };
    }
    return this.consolidationService.getStats(token);
  }

  /**
   * Generate insights from checklist results
   * @param {Array} checklistResults
   * @returns {Object}
   */
  generateInsights(checklistResults) {
    const insights = {
      dueItemsCount: 0,
      overdueCount: 0,
      streakDays: 0,
      streakAtRisk: false,
      weeklyReviews: 0,
      weeklyAccuracy: 0,
      weakConcepts: [],
      patterns: [],
      velocity: null,
      lastUpdated: new Date().toISOString(),
    };

    for (const result of checklistResults) {
      if (!result.success || !result.result) continue;

      switch (result.task) {
        case 'check_due_items':
          insights.dueItemsCount = result.result.dueCount || 0;
          insights.overdueCount = result.result.overdueCount || 0;
          break;

        case 'analyze_performance':
          insights.weeklyReviews = result.result.totalReviews || 0;
          insights.weeklyAccuracy = result.result.avgAccuracy || 0;
          break;

        case 'detect_patterns':
          insights.patterns = result.result.patterns || [];
          break;

        case 'check_weak_concepts':
          insights.weakConcepts = result.result.weakConcepts || [];
          break;

        case 'check_streak':
          insights.streakDays = result.result.streakDays || 0;
          insights.streakAtRisk = result.result.streakAtRisk || false;
          break;

        case 'calculate_velocity':
          insights.velocity = result.result.noData ? null : result.result;
          break;
      }
    }

    return insights;
  }

  /**
   * Determine which notifications to send
   * @param {Object} insights
   * @param {Object} options
   * @returns {Array}
   */
  determineNotifications(insights, options = {}) {
    const { isCatchUp = false } = options;
    const notifications = [];
    const config = this.store?.get('learningBrain.notifications', {}) || {};

    // Streak at risk
    if (
      insights.streakAtRisk &&
      insights.streakDays > 0 &&
      config.streakAlert !== false
    ) {
      notifications.push({
        type: 'streakAlert',
        title: `Your ${insights.streakDays}-day streak ends soon!`,
        message: `Just a quick review to keep it going.`,
        urgency: 'high',
      });
    }

    // Due items reminder
    if (
      insights.dueItemsCount > 0 &&
      config.dailySummary !== false &&
      !isCatchUp
    ) {
      notifications.push({
        type: 'dailySummary',
        title: 'SmartReader',
        message: `${insights.dueItemsCount} items ready for review!${insights.streakDays > 0 ? ` Streak: ${insights.streakDays} days` : ''}`,
      });
    }

    // Welcome back (catch-up)
    if (isCatchUp && config.welcomeBack !== false) {
      notifications.push({
        type: 'welcomeBack',
        title: 'Welcome back to SmartReader!',
        message: `${insights.dueItemsCount} items are waiting for you.`,
      });
    }

    // Weak concepts alert
    if (insights.weakConcepts.length >= 3 && config.struggleAlert !== false) {
      notifications.push({
        type: 'struggleAlert',
        title: 'Focus Area Detected',
        message: `You might need extra practice with "${insights.weakConcepts[0]?.name || 'some concepts'}"`,
      });
    }

    return notifications;
  }

  /**
   * Persist brain-determined nudge POJOs as real notifications in
   * NotificationManager, with per-day per-type dedup so the same alert
   * doesn't fire on every heartbeat tick.
   *
   * Returns {created, skipped, errors} for diagnostics.
   *
   * @param {Array} notifications POJOs from determineNotifications
   */
  persistBrainNotifications(notifications) {
    // `byType` is keyed by the brain's internal nudge.type (streakAlert,
    // dailySummary, welcomeBack, struggleAlert, ...) — NOT the
    // NotificationManager type. This is what the user actually sees
    // labeled in the Settings diagnostic.
    const out = { created: 0, skipped: 0, errors: 0, byType: {} };
    if (!Array.isArray(notifications) || notifications.length === 0) return out;

    const token = getActiveSessionToken();
    if (!token) {
      // Nobody signed in — same skip-rather-than-crash pattern the other
      // brain services use. The heartbeat keeps running.
      return { ...out, reason: 'no session' };
    }

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const dedup = this.store?.get(NOTIF_DEDUP_KEY, {}) || {};
    const bumpType = (type, field) => {
      if (!out.byType[type]) {
        out.byType[type] = { created: 0, skipped: 0, errors: 0 };
      }
      out.byType[type][field] += 1;
    };

    notifications.forEach((nudge) => {
      const dedupKey = `${today}:${nudge.type}`;
      if (dedup[dedupKey]) {
        out.skipped += 1;
        bumpType(nudge.type, 'skipped');
        return;
      }
      const mapping = NUDGE_TYPE_MAP[nudge.type] || {
        type: NOTIFICATION_TYPES.SYSTEM,
        priority: NOTIFICATION_PRIORITIES.NORMAL,
      };
      const priority =
        nudge.urgency === 'high'
          ? NOTIFICATION_PRIORITIES.HIGH
          : mapping.priority;
      try {
        const created = createNotification(
          {
            type: mapping.type,
            priority,
            title: nudge.title,
            message: nudge.message,
            actionUrl: mapping.actionUrl,
            actionLabel: mapping.actionLabel,
            persistent: false,
            dismissible: true,
          },
          token,
        );
        dedup[dedupKey] = {
          notificationId: created?.id || null,
          firedAt: new Date().toISOString(),
        };
        out.created += 1;
        bumpType(nudge.type, 'created');

        // Brain-driven shell: also emit an atomic-chip Trigger so the
        // Orb surfaces this nudge alongside the in-app notification.
        // Same daily dedup as the notification path (no double-emit).
        if (this.triggerEmitter) {
          const navigate = mapping.actionUrl
            ? mapping.actionUrl.replace(/^\/+/, '')
            : null;
          this.triggerEmitter.emit({
            id: `notif:${nudge.type}:${today}`,
            source: `notification-${nudge.type}`,
            unit: 'atomic-chip',
            surfaceTarget: { kind: 'global' },
            priority:
              priority === NOTIFICATION_PRIORITIES.HIGH ? 'high' : 'normal',
            freshness: 24 * 60 * 60 * 1000,
            payload: {
              title: nudge.title,
              body: nudge.message,
              actions: navigate
                ? [
                    {
                      label: mapping.actionLabel || 'Open',
                      navigate,
                      primary: true,
                    },
                  ]
                : [],
              nudgeType: nudge.type,
              notificationId: created?.id || null,
            },
          });
        }
      } catch (err) {
        out.errors += 1;
        bumpType(nudge.type, 'errors');
        console.error(
          '[LearningBrainAgent] persistBrainNotifications failed:',
          nudge.type,
          err?.message || err,
        );
      }
    });

    // Trim dedup map: keep only today + yesterday so it doesn't grow forever.
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .slice(0, 10);
    const trimmed = {};
    Object.entries(dedup).forEach(([key, value]) => {
      if (key.startsWith(today) || key.startsWith(yesterday)) {
        trimmed[key] = value;
      }
    });
    if (this.store) this.store.set(NOTIF_DEDUP_KEY, trimmed);

    return out;
  }

  /**
   * Get cached insights
   * @returns {Object|null}
   */
  getInsights() {
    return this.cachedInsights;
  }

  /**
   * Get the time of last analysis
   * @returns {Date|null}
   */
  getLastAnalysisTime() {
    return this.lastAnalysisTime;
  }
}

module.exports = LearningBrainAgent;
