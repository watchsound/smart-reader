/**
 * LearningPlanCreateSkill - Create AI-generated learning plans for topics
 *
 * This skill uses AI to generate comprehensive, personalized learning plans
 * based on the topic, domain type, learner profile, and available content.
 *
 * Features:
 * - Domain-aware plan generation (vocabulary, math, language, knowledge, skill)
 * - Learner profile integration (learning style, pace, weak areas)
 * - Milestone and checkpoint creation
 * - Spaced repetition scheduling
 * - Content source integration (books, vocabulary sets, etc.)
 */

const BaseSkill = require('../BaseSkill');

// Import domain configurations
const DOMAIN_CONFIGS = {
  vocabulary: {
    defaultPhases: 3,
    usesSpacedRepetition: true,
    sessionTypes: ['learn_new', 'review', 'quiz'],
    itemTypes: ['word', 'phrase', 'idiom'],
  },
  math: {
    defaultPhases: 4,
    usesSpacedRepetition: true,
    sessionTypes: ['learn_new', 'practice', 'quiz'],
    itemTypes: ['concept', 'formula', 'problem'],
  },
  language: {
    defaultPhases: 5,
    usesSpacedRepetition: true,
    sessionTypes: ['learn_new', 'practice', 'reading', 'quiz'],
    itemTypes: ['grammar_rule', 'vocabulary', 'passage'],
  },
  knowledge: {
    defaultPhases: 3,
    usesSpacedRepetition: true,
    sessionTypes: ['reading', 'review', 'quiz'],
    itemTypes: ['concept', 'fact', 'relationship'],
  },
  skill: {
    defaultPhases: 4,
    usesSpacedRepetition: false,
    sessionTypes: ['learn_new', 'practice', 'project'],
    itemTypes: ['technique', 'exercise', 'project'],
  },
};

class LearningPlanCreateSkill extends BaseSkill {
  static get name() {
    return 'create_learning_plan';
  }

  static get description() {
    return 'Generate a comprehensive, AI-powered learning plan for a topic. Creates phases, milestones, daily schedules, and item sequences based on domain type and learner profile.';
  }

  static get parameters() {
    return {
      topicId: {
        type: 'string',
        description: 'The ID of the learning topic to create a plan for',
      },
      topicName: {
        type: 'string',
        description: 'Name of the topic (used for plan generation)',
      },
      domainType: {
        type: 'string',
        enum: ['vocabulary', 'math', 'language', 'knowledge', 'skill'],
        description: 'The learning domain type',
      },
      targetDate: {
        type: 'string',
        description: 'Target completion date (ISO format). If not provided, plan will be open-ended.',
      },
      dailyMinutes: {
        type: 'number',
        default: 30,
        description: 'Target daily study time in minutes',
      },
      difficulty: {
        type: 'string',
        enum: ['beginner', 'elementary', 'intermediate', 'advanced', 'expert', 'auto'],
        default: 'auto',
        description: 'Difficulty level or "auto" to detect from content',
      },
      focusAreas: {
        type: 'array',
        description: 'Specific areas to focus on (e.g., ["synonyms", "roots"] for vocabulary)',
      },
      existingKnowledge: {
        type: 'array',
        description: 'Topics/concepts the learner already knows',
      },
      learningStyle: {
        type: 'string',
        enum: ['visual', 'reading', 'hands_on', 'auditory', 'mixed'],
        default: 'mixed',
        description: 'Preferred learning style',
      },
      contentSample: {
        type: 'string',
        description: 'Sample of content to be learned (helps AI understand scope)',
      },
      totalItems: {
        type: 'number',
        description: 'Total number of items to learn (if known)',
      },
    };
  }

  static get requiredParams() {
    return ['topicId', 'topicName', 'domainType'];
  }

  static get category() {
    return 'learning';
  }

  async execute(params) {
    const {
      topicId,
      topicName,
      domainType,
      targetDate,
      dailyMinutes = 30,
      difficulty = 'auto',
      focusAreas = [],
      existingKnowledge = [],
      learningStyle = 'mixed',
      contentSample = '',
      totalItems,
    } = params;

    // Get domain configuration
    const domainConfig = DOMAIN_CONFIGS[domainType] || DOMAIN_CONFIGS.knowledge;

    // Calculate duration and phases
    const { durationDays, estimatedPhases } = this.calculateDuration(
      targetDate,
      totalItems,
      dailyMinutes,
      domainConfig
    );

    // Generate plan with AI
    const aiProvider = this.getAIProvider();
    let aiGeneratedPlan = null;

    if (aiProvider && contentSample) {
      aiGeneratedPlan = await this.generatePlanWithAI(params, domainConfig, durationDays);
    }

    // Build the learning plan
    const plan = this.buildPlan({
      topicId,
      topicName,
      domainType,
      domainConfig,
      durationDays,
      estimatedPhases,
      dailyMinutes,
      difficulty,
      focusAreas,
      existingKnowledge,
      learningStyle,
      totalItems,
      aiGeneratedPlan,
    });

    this.logExecution(
      { topicId, domainType, dailyMinutes },
      { planId: plan.id, phases: plan.planData.totalPhases, duration: durationDays }
    );

    return plan;
  }

  /**
   * Calculate estimated duration and phases
   */
  calculateDuration(targetDate, totalItems, dailyMinutes, domainConfig) {
    let durationDays;

    if (targetDate) {
      const target = new Date(targetDate);
      const now = new Date();
      durationDays = Math.max(7, Math.ceil((target - now) / (1000 * 60 * 60 * 24)));
    } else if (totalItems) {
      // Estimate based on items and daily time
      const itemsPerDay = Math.floor(dailyMinutes / 3);  // ~3 min per new item
      durationDays = Math.ceil(totalItems / itemsPerDay) + 14;  // Add buffer for review
    } else {
      // Default to 30 days
      durationDays = 30;
    }

    // Determine number of phases
    let estimatedPhases;
    if (durationDays <= 14) {
      estimatedPhases = 2;
    } else if (durationDays <= 30) {
      estimatedPhases = domainConfig.defaultPhases;
    } else if (durationDays <= 60) {
      estimatedPhases = domainConfig.defaultPhases + 1;
    } else {
      estimatedPhases = domainConfig.defaultPhases + 2;
    }

    return { durationDays, estimatedPhases };
  }

  /**
   * Build the complete learning plan structure
   */
  buildPlan(config) {
    const {
      topicId,
      topicName,
      domainType,
      domainConfig,
      durationDays,
      estimatedPhases,
      dailyMinutes,
      difficulty,
      focusAreas,
      existingKnowledge,
      learningStyle,
      totalItems,
      aiGeneratedPlan,
    } = config;

    const planId = `plan_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

    // Generate phases
    const phases = this.generatePhases(
      estimatedPhases,
      durationDays,
      domainConfig,
      difficulty,
      aiGeneratedPlan
    );

    // Generate daily schedule
    const dailySchedule = this.generateDailySchedule(
      dailyMinutes,
      domainConfig,
      learningStyle
    );

    // Generate milestones
    const milestones = this.generateMilestones(
      phases,
      totalItems,
      domainType
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      domainType,
      difficulty,
      learningStyle,
      focusAreas,
      aiGeneratedPlan
    );

    // Generate assessment checkpoints
    const assessmentCheckpoints = this.generateAssessmentCheckpoints(
      phases,
      domainConfig
    );

    return {
      id: planId,
      topicId,
      planData: {
        overview: aiGeneratedPlan?.overview || `Comprehensive ${domainType} learning plan for "${topicName}"`,
        estimatedDuration: durationDays,
        totalPhases: phases.length,
        phases,
        dailySchedule,
        milestones,
        recommendations,
        assessmentCheckpoints,
        focusAreas,
        existingKnowledge,
        learningStyle,
        difficulty: difficulty === 'auto' ? 'intermediate' : difficulty,
        domainConfig: {
          usesSpacedRepetition: domainConfig.usesSpacedRepetition,
          sessionTypes: domainConfig.sessionTypes,
          itemTypes: domainConfig.itemTypes,
        },
      },
      currentPhase: 1,
      currentDay: 1,
      status: 'active',
      startedAt: startDate.toISOString(),
      targetCompletionAt: endDate.toISOString(),
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate learning phases
   */
  generatePhases(numPhases, durationDays, domainConfig, difficulty, aiPlan) {
    const phases = [];
    const daysPerPhase = Math.ceil(durationDays / numPhases);

    const phaseNames = {
      vocabulary: ['Foundation', 'Building', 'Mastery', 'Refinement', 'Advanced'],
      math: ['Concepts', 'Practice', 'Application', 'Challenge', 'Mastery'],
      language: ['Basics', 'Building', 'Intermediate', 'Advanced', 'Fluency'],
      knowledge: ['Introduction', 'Exploration', 'Integration', 'Deep Dive', 'Mastery'],
      skill: ['Fundamentals', 'Core Skills', 'Practice', 'Projects', 'Expertise'],
    };

    const domainPhaseNames = phaseNames[domainConfig.type] || phaseNames.knowledge;

    for (let i = 0; i < numPhases; i++) {
      const startDay = i * daysPerPhase + 1;
      const endDay = Math.min((i + 1) * daysPerPhase, durationDays);

      phases.push({
        phaseNumber: i + 1,
        name: aiPlan?.phases?.[i]?.name || domainPhaseNames[i] || `Phase ${i + 1}`,
        description: aiPlan?.phases?.[i]?.description || `Focus on ${domainPhaseNames[i]?.toLowerCase() || 'learning'} during this phase`,
        startDay,
        endDay,
        durationDays: endDay - startDay + 1,
        goals: aiPlan?.phases?.[i]?.goals || this.getPhaseGoals(i, numPhases, domainConfig),
        focusAreas: aiPlan?.phases?.[i]?.focusAreas || [],
        sessionTypes: this.getPhaseSessionTypes(i, numPhases, domainConfig),
        difficultyRange: this.getPhaseDifficultyRange(i, numPhases, difficulty),
        completionCriteria: this.getPhaseCompletionCriteria(i, numPhases, domainConfig),
      });
    }

    return phases;
  }

  getPhaseGoals(phaseIndex, totalPhases, domainConfig) {
    const progressPercent = Math.round(((phaseIndex + 1) / totalPhases) * 100);
    return [
      `Complete ${progressPercent}% of learning content`,
      `Achieve ${60 + phaseIndex * 8}% accuracy on assessments`,
      'Maintain consistent daily practice',
    ];
  }

  getPhaseSessionTypes(phaseIndex, totalPhases, domainConfig) {
    const types = [...domainConfig.sessionTypes];

    // Early phases focus on learning new content
    if (phaseIndex === 0) {
      return ['learn_new', types.includes('review') ? 'review' : types[0]];
    }

    // Middle phases balance learning and practice
    if (phaseIndex < totalPhases - 1) {
      return types.filter(t => t !== 'project');
    }

    // Final phases include more assessment and projects
    return types;
  }

  getPhaseDifficultyRange(phaseIndex, totalPhases, baseDifficulty) {
    const levels = ['beginner', 'elementary', 'intermediate', 'advanced', 'expert'];
    const baseIndex = levels.indexOf(baseDifficulty === 'auto' ? 'intermediate' : baseDifficulty);
    const startIndex = Math.max(0, baseIndex - 1 + Math.floor(phaseIndex / 2));
    const endIndex = Math.min(levels.length - 1, startIndex + 1);

    return {
      min: levels[startIndex],
      max: levels[endIndex],
    };
  }

  getPhaseCompletionCriteria(phaseIndex, totalPhases, domainConfig) {
    const criteria = {
      minAccuracy: 0.6 + (phaseIndex * 0.08),
      minItemsCompleted: 0.9,
      minSessionsCompleted: 0.8,
    };

    if (domainConfig.usesSpacedRepetition) {
      criteria.minRetentionRate = 0.7 + (phaseIndex * 0.05);
    }

    return criteria;
  }

  /**
   * Generate daily schedule template
   */
  generateDailySchedule(dailyMinutes, domainConfig, learningStyle) {
    // Calculate session distribution
    let newItemsPercent, reviewPercent, practicePercent;

    if (domainConfig.usesSpacedRepetition) {
      newItemsPercent = 30;
      reviewPercent = 50;
      practicePercent = 20;
    } else {
      newItemsPercent = 40;
      reviewPercent = 20;
      practicePercent = 40;
    }

    // Adjust based on learning style
    const activities = this.getSuggestedActivities(domainConfig, learningStyle);

    return {
      recommendedSessions: dailyMinutes >= 30 ? 2 : 1,
      sessionDurationMinutes: Math.floor(dailyMinutes / (dailyMinutes >= 30 ? 2 : 1)),
      newItemsPercent,
      reviewPercent,
      practicePercent,
      suggestedActivities: activities,
      optimalTimes: ['morning', 'evening'],  // Can be personalized based on profile
      breakIntervalMinutes: 25,  // Pomodoro-style
      restDayFrequency: 7,  // One rest day per week
    };
  }

  getSuggestedActivities(domainConfig, learningStyle) {
    const baseActivities = {
      vocabulary: ['flashcards', 'word games', 'context sentences', 'etymology exploration'],
      math: ['worked examples', 'practice problems', 'concept mapping', 'self-testing'],
      language: ['reading', 'writing exercises', 'grammar drills', 'conversation practice'],
      knowledge: ['reading', 'note-taking', 'concept mapping', 'self-testing'],
      skill: ['tutorials', 'hands-on exercises', 'mini-projects', 'code review'],
    };

    const styleActivities = {
      visual: ['diagrams', 'mind maps', 'video tutorials', 'color-coded notes'],
      reading: ['articles', 'textbooks', 'documentation', 'written summaries'],
      hands_on: ['exercises', 'projects', 'experiments', 'practice problems'],
      auditory: ['podcasts', 'lectures', 'discussions', 'verbal explanations'],
      mixed: [],
    };

    const activities = baseActivities[domainConfig.type] || baseActivities.knowledge;
    const styleSpecific = styleActivities[learningStyle] || [];

    return [...activities, ...styleSpecific].slice(0, 6);
  }

  /**
   * Generate milestones
   */
  generateMilestones(phases, totalItems, domainType) {
    const milestones = [];

    phases.forEach((phase, index) => {
      // Phase completion milestone
      milestones.push({
        id: `milestone_phase_${index + 1}`,
        type: 'phase_complete',
        title: `Complete ${phase.name} Phase`,
        description: `Successfully complete Phase ${index + 1}: ${phase.name}`,
        targetDay: phase.endDay,
        criteria: phase.completionCriteria,
        reward: this.getMilestoneReward(index, phases.length),
      });

      // Mid-phase checkpoint (for longer phases)
      if (phase.durationDays > 7) {
        const midDay = Math.floor((phase.startDay + phase.endDay) / 2);
        milestones.push({
          id: `milestone_checkpoint_${index + 1}`,
          type: 'checkpoint',
          title: `${phase.name} Checkpoint`,
          description: `Mid-phase progress check`,
          targetDay: midDay,
          criteria: { minProgress: 0.5 },
        });
      }
    });

    // Final milestone
    milestones.push({
      id: 'milestone_complete',
      type: 'topic_complete',
      title: 'Topic Mastery',
      description: 'Successfully complete the entire learning plan',
      targetDay: phases[phases.length - 1].endDay,
      criteria: {
        minAccuracy: 0.85,
        allPhasesComplete: true,
      },
      reward: {
        type: 'achievement',
        title: `${domainType.charAt(0).toUpperCase() + domainType.slice(1)} Master`,
        description: 'Completed an entire learning plan',
      },
    });

    return milestones;
  }

  getMilestoneReward(phaseIndex, totalPhases) {
    const rewards = [
      { type: 'badge', title: 'First Steps', icon: 'star' },
      { type: 'badge', title: 'Building Momentum', icon: 'trending_up' },
      { type: 'badge', title: 'Halfway Hero', icon: 'emoji_events' },
      { type: 'badge', title: 'Almost There', icon: 'local_fire_department' },
      { type: 'achievement', title: 'Excellence', icon: 'workspace_premium' },
    ];

    return rewards[Math.min(phaseIndex, rewards.length - 1)];
  }

  /**
   * Generate AI recommendations
   */
  generateRecommendations(domainType, difficulty, learningStyle, focusAreas, aiPlan) {
    const baseRecommendations = {
      vocabulary: [
        'Use spaced repetition for long-term retention',
        'Learn words in context, not just definitions',
        'Group related words (synonyms, word families)',
        'Practice using words in sentences',
      ],
      math: [
        'Master fundamentals before advancing',
        'Work through many practice problems',
        'Understand concepts, dont just memorize formulas',
        'Review mistakes to identify weak areas',
      ],
      language: [
        'Practice all four skills: reading, writing, listening, speaking',
        'Immerse yourself in authentic content',
        'Learn grammar through usage patterns',
        'Build vocabulary in meaningful contexts',
      ],
      knowledge: [
        'Connect new concepts to existing knowledge',
        'Use active recall instead of passive reading',
        'Create summaries and mind maps',
        'Test yourself frequently',
      ],
      skill: [
        'Learn by doing - prioritize hands-on practice',
        'Build real projects to solidify learning',
        'Break complex skills into smaller sub-skills',
        'Seek feedback on your work',
      ],
    };

    const recommendations = baseRecommendations[domainType] || baseRecommendations.knowledge;

    // Add AI recommendations if available
    if (aiPlan?.recommendations) {
      return [...aiPlan.recommendations, ...recommendations].slice(0, 6);
    }

    return recommendations;
  }

  /**
   * Generate assessment checkpoints
   */
  generateAssessmentCheckpoints(phases, domainConfig) {
    const checkpoints = [];

    phases.forEach((phase, index) => {
      // Phase assessment
      checkpoints.push({
        id: `assessment_phase_${index + 1}`,
        phaseNumber: index + 1,
        type: 'phase_assessment',
        scheduledDay: phase.endDay,
        assessmentTypes: domainConfig.sessionTypes.includes('quiz')
          ? ['quiz', 'review']
          : ['review', 'practice'],
        passingCriteria: {
          minScore: 0.6 + (index * 0.08),
          minItemsAttempted: 0.9,
        },
        retakeAllowed: true,
        retakeDelayDays: 1,
      });
    });

    return checkpoints;
  }

  /**
   * Generate plan with AI for more personalized content
   */
  async generatePlanWithAI(params, domainConfig, durationDays) {
    const aiProvider = this.getAIProvider();
    if (!aiProvider) return null;

    const prompt = this.buildAIPlanPrompt(params, domainConfig, durationDays);

    try {
      const response = await aiProvider.generateContentWithJson(prompt);
      return this.parseAIPlanResponse(response);
    } catch (error) {
      console.error('[LearningPlanCreateSkill] AI plan generation failed:', error);
      return null;
    }
  }

  buildAIPlanPrompt(params, domainConfig, durationDays) {
    const contentSample = params.contentSample?.substring(0, 1000) || '';

    return `Create a personalized learning plan for the following topic.

Topic: ${params.topicName}
Domain: ${params.domainType}
Duration: ${durationDays} days
Daily Time: ${params.dailyMinutes || 30} minutes
Learning Style: ${params.learningStyle || 'mixed'}
Difficulty: ${params.difficulty || 'auto'}
${params.focusAreas?.length ? `Focus Areas: ${params.focusAreas.join(', ')}` : ''}
${params.existingKnowledge?.length ? `Already Knows: ${params.existingKnowledge.join(', ')}` : ''}

${contentSample ? `Content Sample:\n"""\n${contentSample}\n"""` : ''}

Create a learning plan with phases, goals, and recommendations. Return as JSON:
{
  "overview": "Brief description of the learning journey",
  "phases": [
    {
      "name": "Phase name",
      "description": "What this phase covers",
      "goals": ["goal1", "goal2"],
      "focusAreas": ["area1", "area2"]
    }
  ],
  "recommendations": ["recommendation1", "recommendation2"],
  "estimatedDifficulty": "beginner|elementary|intermediate|advanced|expert",
  "keyTopics": ["topic1", "topic2", "topic3"]
}`;
  }

  parseAIPlanResponse(response) {
    try {
      if (typeof response === 'object' && response.overview) {
        return response;
      }

      if (typeof response === 'string') {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }

      if (Array.isArray(response)) {
        const textContent = response
          .filter(block => block.type === 'text')
          .map(block => block.text)
          .join('');
        const jsonMatch = textContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }

      return null;
    } catch (error) {
      console.error('[LearningPlanCreateSkill] Failed to parse AI response:', error);
      return null;
    }
  }
}

module.exports = LearningPlanCreateSkill;
