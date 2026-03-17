/**
 * Tests for LearningReminderSkill
 *
 * Tests notification scheduling, reminder management, and notification preferences.
 */

const LearningReminderSkill = require('../../main/skills/learning/LearningReminderSkill');

// Mock notification manager
const mockNotificationManager = {
  createNotification: jest.fn(),
  getNotifications: jest.fn(),
  getUnreadCount: jest.fn(),
  getDueNotifications: jest.fn(),
  deliverDueNotifications: jest.fn(),
  markAsRead: jest.fn(),
  dismissNotification: jest.fn(),
};

// Mock store
const mockStore = {
  get: jest.fn(),
  set: jest.fn(),
};

describe('LearningReminderSkill', () => {
  let skill;

  beforeEach(() => {
    skill = new LearningReminderSkill();
    skill.context = {
      token: 'test-token',
      store: mockStore,
      services: {
        notificationManager: mockNotificationManager,
      },
    };
    jest.clearAllMocks();

    // Default mock returns
    mockStore.get.mockReturnValue(null);
    mockNotificationManager.createNotification.mockReturnValue({
      id: 'notif_123',
      type: 'study_reminder',
      status: 'pending',
    });
  });

  describe('static properties', () => {
    it('should have correct name', () => {
      expect(LearningReminderSkill.name).toBe('manage_learning_reminders');
    });

    it('should have correct category', () => {
      expect(LearningReminderSkill.category).toBe('learning');
    });

    it('should have required parameters', () => {
      expect(LearningReminderSkill.requiredParams).toContain('action');
    });

    it('should have action enum with all actions', () => {
      const actions = LearningReminderSkill.parameters.action.enum;
      expect(actions).toContain('schedule_daily_reminder');
      expect(actions).toContain('schedule_session_reminder');
      expect(actions).toContain('schedule_review_reminder');
      expect(actions).toContain('create_achievement_notification');
      expect(actions).toContain('create_milestone_notification');
      expect(actions).toContain('create_streak_notification');
      expect(actions).toContain('check_and_deliver');
      expect(actions).toContain('get_pending');
      expect(actions).toContain('get_notifications');
      expect(actions).toContain('mark_read');
      expect(actions).toContain('dismiss');
      expect(actions).toContain('configure_preferences');
      expect(actions).toContain('get_preferences');
    });

    it('should have description', () => {
      expect(LearningReminderSkill.description).toBeDefined();
      expect(LearningReminderSkill.description.length).toBeGreaterThan(50);
    });
  });

  // ===========================================================================
  // schedule_daily_reminder action
  // ===========================================================================

  describe('schedule_daily_reminder action', () => {
    it('should schedule a daily study reminder', async () => {
      const result = await skill.execute({
        action: 'schedule_daily_reminder',
        planId: 'plan_123',
        topicId: 'topic_456',
      });

      expect(result.success).toBe(true);
      expect(result.notification).toBeDefined();
      expect(result.scheduledFor).toBeDefined();
    });

    it('should use custom scheduled time', async () => {
      const scheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const result = await skill.execute({
        action: 'schedule_daily_reminder',
        scheduledFor,
      });

      expect(result.success).toBe(true);
      expect(result.scheduledFor).toBe(scheduledFor);
    });

    it('should use custom title and message', async () => {
      await skill.execute({
        action: 'schedule_daily_reminder',
        title: 'Custom Title',
        message: 'Custom message',
      });

      expect(mockNotificationManager.createNotification).toHaveBeenCalled();
      const notifArg = mockNotificationManager.createNotification.mock.calls[0][0];
      expect(notifArg.title).toBe('Custom Title');
      expect(notifArg.message).toBe('Custom message');
    });

    it('should set notification type to study_reminder', async () => {
      await skill.execute({
        action: 'schedule_daily_reminder',
      });

      const notifArg = mockNotificationManager.createNotification.mock.calls[0][0];
      expect(notifArg.type).toBe('study_reminder');
    });
  });

  // ===========================================================================
  // schedule_session_reminder action
  // ===========================================================================

  describe('schedule_session_reminder action', () => {
    it('should schedule a session reminder', async () => {
      const startTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      const result = await skill.execute({
        action: 'schedule_session_reminder',
        sessionData: {
          startTime,
          sessionType: 'review',
        },
        planId: 'plan_123',
      });

      expect(result.success).toBe(true);
      expect(result.notification).toBeDefined();
    });

    it('should use scheduledFor when provided', async () => {
      const scheduledFor = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      const result = await skill.execute({
        action: 'schedule_session_reminder',
        scheduledFor,
      });

      expect(result.success).toBe(true);
      expect(result.scheduledFor).toBe(scheduledFor);
    });

    it('should require startTime or scheduledFor', async () => {
      await expect(skill.execute({
        action: 'schedule_session_reminder',
        sessionData: {},
      })).rejects.toThrow('Either scheduledFor or sessionData.startTime is required');
    });

    it('should set notification type to session_due', async () => {
      const startTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      await skill.execute({
        action: 'schedule_session_reminder',
        sessionData: { startTime, sessionType: 'quiz' },
      });

      const notifArg = mockNotificationManager.createNotification.mock.calls[0][0];
      expect(notifArg.type).toBe('session_due');
    });

    it('should include session type in title', async () => {
      const startTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      await skill.execute({
        action: 'schedule_session_reminder',
        sessionData: { startTime, sessionType: 'quiz' },
      });

      const notifArg = mockNotificationManager.createNotification.mock.calls[0][0];
      expect(notifArg.title).toContain('Quiz');
    });
  });

  // ===========================================================================
  // schedule_review_reminder action
  // ===========================================================================

  describe('schedule_review_reminder action', () => {
    it('should schedule a review reminder', async () => {
      const result = await skill.execute({
        action: 'schedule_review_reminder',
        reviewData: {
          itemCount: 15,
        },
        topicId: 'topic_123',
      });

      expect(result.success).toBe(true);
      expect(result.notification).toBeDefined();
      expect(result.itemCount).toBe(15);
    });

    it('should include item count in message', async () => {
      await skill.execute({
        action: 'schedule_review_reminder',
        reviewData: { itemCount: 25 },
      });

      const notifArg = mockNotificationManager.createNotification.mock.calls[0][0];
      expect(notifArg.message).toContain('25');
    });

    it('should set high priority for many items', async () => {
      await skill.execute({
        action: 'schedule_review_reminder',
        reviewData: { itemCount: 30 },
      });

      const notifArg = mockNotificationManager.createNotification.mock.calls[0][0];
      expect(notifArg.priority).toBe('high');
    });

    it('should set normal priority for few items', async () => {
      await skill.execute({
        action: 'schedule_review_reminder',
        reviewData: { itemCount: 10 },
      });

      const notifArg = mockNotificationManager.createNotification.mock.calls[0][0];
      expect(notifArg.priority).toBe('normal');
    });
  });

  // ===========================================================================
  // create_achievement_notification action
  // ===========================================================================

  describe('create_achievement_notification action', () => {
    it('should create an achievement notification', async () => {
      const result = await skill.execute({
        action: 'create_achievement_notification',
        achievement: {
          title: 'First Steps',
          description: 'Completed your first lesson',
          icon: 'star',
        },
      });

      expect(result.success).toBe(true);
      expect(result.notification).toBeDefined();
    });

    it('should use achievement data', async () => {
      await skill.execute({
        action: 'create_achievement_notification',
        achievement: {
          title: 'Perfect Score',
          description: 'Got 100% on a quiz',
          icon: 'emoji_events',
        },
      });

      const notifArg = mockNotificationManager.createNotification.mock.calls[0][0];
      expect(notifArg.title).toBe('Perfect Score');
      expect(notifArg.message).toBe('Got 100% on a quiz');
      expect(notifArg.icon).toBe('emoji_events');
    });

    it('should set notification type to achievement', async () => {
      await skill.execute({
        action: 'create_achievement_notification',
        achievement: {},
      });

      const notifArg = mockNotificationManager.createNotification.mock.calls[0][0];
      expect(notifArg.type).toBe('achievement');
    });

    it('should mark achievement as persistent', async () => {
      await skill.execute({
        action: 'create_achievement_notification',
        achievement: {},
      });

      const notifArg = mockNotificationManager.createNotification.mock.calls[0][0];
      expect(notifArg.persistent).toBe(true);
    });
  });

  // ===========================================================================
  // create_milestone_notification action
  // ===========================================================================

  describe('create_milestone_notification action', () => {
    it('should create a milestone notification', async () => {
      const result = await skill.execute({
        action: 'create_milestone_notification',
        milestone: {
          title: 'Phase 1 Complete',
          description: 'You completed the first phase!',
        },
      });

      expect(result.success).toBe(true);
      expect(result.notification).toBeDefined();
    });

    it('should set notification type to milestone', async () => {
      await skill.execute({
        action: 'create_milestone_notification',
        milestone: {},
      });

      const notifArg = mockNotificationManager.createNotification.mock.calls[0][0];
      expect(notifArg.type).toBe('milestone');
    });

    it('should use custom milestone data', async () => {
      await skill.execute({
        action: 'create_milestone_notification',
        milestone: {
          title: 'Halfway There',
          description: 'You are 50% done!',
          icon: 'flag',
          planId: 'plan_123',
        },
      });

      const notifArg = mockNotificationManager.createNotification.mock.calls[0][0];
      expect(notifArg.title).toBe('Halfway There');
      expect(notifArg.planId).toBe('plan_123');
    });
  });

  // ===========================================================================
  // create_streak_notification action
  // ===========================================================================

  describe('create_streak_notification action', () => {
    it('should create a positive streak notification', async () => {
      const result = await skill.execute({
        action: 'create_streak_notification',
        streakData: {
          streakDays: 7,
        },
      });

      expect(result.success).toBe(true);
      expect(result.streakDays).toBe(7);
    });

    it('should include streak count in title', async () => {
      await skill.execute({
        action: 'create_streak_notification',
        streakData: { streakDays: 10 },
      });

      const notifArg = mockNotificationManager.createNotification.mock.calls[0][0];
      expect(notifArg.title).toContain('10');
    });

    it('should show warning for broken streak', async () => {
      await skill.execute({
        action: 'create_streak_notification',
        streakData: { streakDays: 0, broken: true },
      });

      const notifArg = mockNotificationManager.createNotification.mock.calls[0][0];
      expect(notifArg.priority).toBe('high');
      expect(notifArg.icon).toBe('warning');
    });

    it('should show fire icon for maintained streak', async () => {
      await skill.execute({
        action: 'create_streak_notification',
        streakData: { streakDays: 5 },
      });

      const notifArg = mockNotificationManager.createNotification.mock.calls[0][0];
      expect(notifArg.icon).toBe('local_fire_department');
    });
  });

  // ===========================================================================
  // check_and_deliver action
  // ===========================================================================

  describe('check_and_deliver action', () => {
    it('should deliver due notifications', async () => {
      mockNotificationManager.deliverDueNotifications.mockReturnValue([
        { id: 'notif_1', type: 'study_reminder' },
        { id: 'notif_2', type: 'review_due' },
      ]);

      const result = await skill.execute({
        action: 'check_and_deliver',
      });

      expect(result.success).toBe(true);
      expect(result.delivered).toHaveLength(2);
      expect(result.count).toBe(2);
    });

    it('should return empty array when no due notifications', async () => {
      mockNotificationManager.deliverDueNotifications.mockReturnValue([]);

      const result = await skill.execute({
        action: 'check_and_deliver',
      });

      expect(result.success).toBe(true);
      expect(result.delivered).toHaveLength(0);
      expect(result.count).toBe(0);
    });

    it('should fail without token', async () => {
      skill.context.token = null;

      const result = await skill.execute({
        action: 'check_and_deliver',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication required');
    });
  });

  // ===========================================================================
  // get_pending action
  // ===========================================================================

  describe('get_pending action', () => {
    it('should get pending notifications', async () => {
      mockNotificationManager.getNotifications.mockReturnValue([
        { id: 'notif_1', status: 'pending' },
      ]);

      const result = await skill.execute({
        action: 'get_pending',
      });

      expect(result.success).toBe(true);
      expect(result.notifications).toHaveLength(1);
      expect(mockNotificationManager.getNotifications).toHaveBeenCalledWith(
        'test-token',
        expect.objectContaining({ status: 'pending' })
      );
    });
  });

  // ===========================================================================
  // get_notifications action
  // ===========================================================================

  describe('get_notifications action', () => {
    it('should get notifications with filters', async () => {
      mockNotificationManager.getNotifications.mockReturnValue([]);
      mockNotificationManager.getUnreadCount.mockReturnValue(5);

      const result = await skill.execute({
        action: 'get_notifications',
        status: 'delivered',
        limit: 20,
      });

      expect(result.success).toBe(true);
      expect(result.unreadCount).toBe(5);
    });

    it('should use default limit', async () => {
      mockNotificationManager.getNotifications.mockReturnValue([]);
      mockNotificationManager.getUnreadCount.mockReturnValue(0);

      await skill.execute({
        action: 'get_notifications',
      });

      expect(mockNotificationManager.getNotifications).toHaveBeenCalledWith(
        'test-token',
        expect.objectContaining({ limit: 50 })
      );
    });
  });

  // ===========================================================================
  // mark_read action
  // ===========================================================================

  describe('mark_read action', () => {
    it('should mark notification as read', async () => {
      mockNotificationManager.markAsRead.mockReturnValue({
        id: 'notif_123',
        status: 'read',
      });

      const result = await skill.execute({
        action: 'mark_read',
        notificationId: 'notif_123',
      });

      expect(result.success).toBe(true);
      expect(result.notification.status).toBe('read');
    });

    it('should require notificationId', async () => {
      const result = await skill.execute({
        action: 'mark_read',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('notificationId is required');
    });
  });

  // ===========================================================================
  // dismiss action
  // ===========================================================================

  describe('dismiss action', () => {
    it('should dismiss notification', async () => {
      mockNotificationManager.dismissNotification.mockReturnValue({
        id: 'notif_123',
        status: 'dismissed',
      });

      const result = await skill.execute({
        action: 'dismiss',
        notificationId: 'notif_123',
      });

      expect(result.success).toBe(true);
      expect(result.notification.status).toBe('dismissed');
    });

    it('should require notificationId', async () => {
      const result = await skill.execute({
        action: 'dismiss',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('notificationId is required');
    });
  });

  // ===========================================================================
  // configure_preferences action
  // ===========================================================================

  describe('configure_preferences action', () => {
    it('should update preferences', async () => {
      mockStore.get.mockReturnValue({
        enableDailyReminder: true,
        dailyStudyTime: '09:00',
      });

      const result = await skill.execute({
        action: 'configure_preferences',
        preferences: {
          dailyStudyTime: '10:00',
          enableStreakReminder: false,
        },
      });

      expect(result.success).toBe(true);
      expect(mockStore.set).toHaveBeenCalled();
    });

    it('should merge with existing preferences', async () => {
      mockStore.get.mockReturnValue({
        enableDailyReminder: true,
        dailyStudyTime: '09:00',
      });

      await skill.execute({
        action: 'configure_preferences',
        preferences: {
          enableStreakReminder: false,
        },
      });

      const setCall = mockStore.set.mock.calls[0];
      expect(setCall[1].enableDailyReminder).toBe(true);
      expect(setCall[1].dailyStudyTime).toBe('09:00');
      expect(setCall[1].enableStreakReminder).toBe(false);
    });
  });

  // ===========================================================================
  // get_preferences action
  // ===========================================================================

  describe('get_preferences action', () => {
    it('should get preferences', async () => {
      mockStore.get.mockReturnValue({
        dailyStudyTime: '08:00',
        enableDailyReminder: true,
      });

      const result = await skill.execute({
        action: 'get_preferences',
      });

      expect(result.success).toBe(true);
      expect(result.preferences).toBeDefined();
      expect(result.preferences.dailyStudyTime).toBe('08:00');
    });

    it('should return defaults when no preferences stored', async () => {
      mockStore.get.mockReturnValue(null);

      const result = await skill.execute({
        action: 'get_preferences',
      });

      expect(result.success).toBe(true);
      expect(result.preferences.dailyStudyTime).toBe('09:00'); // default
    });
  });

  // ===========================================================================
  // Error handling
  // ===========================================================================

  describe('error handling', () => {
    it('should throw error for unknown action', async () => {
      await expect(skill.execute({
        action: 'invalid_action',
      })).rejects.toThrow('Unknown action');
    });

    it('should handle notification manager errors', async () => {
      mockNotificationManager.getNotifications.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await skill.execute({
        action: 'get_notifications',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
    });

    it('should handle missing notification manager', async () => {
      skill.context.services = {};

      const result = await skill.execute({
        action: 'check_and_deliver',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Notification manager not available');
    });
  });

  // ===========================================================================
  // Helper method tests
  // ===========================================================================

  describe('helper methods', () => {
    it('should get correct session type text', () => {
      expect(skill.getSessionTypeText('review')).toBe('Review');
      expect(skill.getSessionTypeText('learn_new')).toBe('Learning');
      expect(skill.getSessionTypeText('quiz')).toBe('Quiz');
      expect(skill.getSessionTypeText('practice')).toBe('Practice');
      expect(skill.getSessionTypeText('reading')).toBe('Reading');
      expect(skill.getSessionTypeText('project')).toBe('Project');
      expect(skill.getSessionTypeText('assessment')).toBe('Assessment');
      expect(skill.getSessionTypeText('mixed')).toBe('Study');
      expect(skill.getSessionTypeText('unknown')).toBe('Study');
    });
  });
});

// ===========================================================================
// Module integration test
// ===========================================================================

describe('LearningReminderSkill module integration', () => {
  it('should be exported from learning skills index', () => {
    const learningSkills = require('../../main/skills/learning');
    expect(learningSkills.LearningReminderSkill).toBeDefined();
  });

  it('should be included in learningSkills array', () => {
    const { learningSkills } = require('../../main/skills/learning');
    const skillNames = learningSkills.map(s => s.name);
    expect(skillNames).toContain('manage_learning_reminders');
  });
});
