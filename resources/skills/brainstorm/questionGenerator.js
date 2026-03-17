/**
 * Question Generator for the Brainstorm Skill.
 *
 * Generates smart follow-up questions based on domain and question type
 * to gather context before brainstorming.
 *
 * Converted from Python to JavaScript for SmartReader integration.
 */

const { QueryAnalyzer, DomainType, QuestionType } = require('./queryAnalyzer');

// Domain-specific questions
const DOMAIN_QUESTIONS = {
  [DomainType.BUSINESS]: [
    'What type of business model do you have (B2B/B2C, SaaS/service/product)?',
    'What key metrics or KPIs matter most for this?',
    'Who are your main competitors or alternatives?',
    'What\'s your team size and structure for this area?',
    'What budget or resource constraints exist?',
  ],
  [DomainType.TECHNICAL]: [
    'What\'s your current tech stack or architecture?',
    'What scale are you operating at (users, requests, data size)?',
    'What are your performance or reliability requirements?',
    'What\'s the team\'s experience level with relevant technologies?',
    'Are there any technical constraints or legacy systems to consider?',
  ],
  [DomainType.SCIENTIFIC]: [
    'What\'s the current state of knowledge or research in this area?',
    'What data or evidence do you have available?',
    'What hypotheses have been considered or tested?',
    'What methodological constraints exist?',
    'Who is the target audience for this work?',
  ],
  [DomainType.CREATIVE]: [
    'What\'s the intended audience or user for this?',
    'What tone or style are you aiming for?',
    'What existing work or inspiration should I know about?',
    'What constraints exist (format, length, medium)?',
    'What emotional response or impact do you want?',
  ],
  [DomainType.PHILOSOPHICAL]: [
    'What\'s your current position or intuition on this?',
    'What assumptions are you willing to question?',
    'Is this for academic/theoretical or practical purposes?',
    'What related concepts or frameworks are relevant?',
    'What would change your mind or perspective?',
  ],
  [DomainType.GENERAL]: [
    'Can you tell me more about the context or background?',
    'What prompted this question or challenge?',
    'Who are the key stakeholders involved?',
    'What would an ideal outcome look like?',
    'What\'s the timeline or urgency?',
  ],
};

// Question-type-specific questions
const QUESTION_TYPE_QUESTIONS = {
  [QuestionType.IMPROVE]: [
    'What have you already tried, and what were the results?',
    'What\'s working well that you want to preserve?',
    'What does \'improved\' look like specifically (metrics, outcomes)?',
  ],
  [QuestionType.WHY]: [
    'When did you first notice this issue or pattern?',
    'What changed around the time this started?',
    'What explanations have you considered or ruled out?',
  ],
  [QuestionType.HOW_TO]: [
    'What resources or capabilities do you have available?',
    'What approaches have you considered?',
    'What\'s the most important constraint (time, cost, quality)?',
  ],
  [QuestionType.WHAT_IF]: [
    'What\'s your current baseline or starting point?',
    'What would success look like in this scenario?',
    'What risks or downsides are you most concerned about?',
  ],
  [QuestionType.EXPLAIN]: [
    'What\'s your current level of understanding?',
    'What specific aspects are most confusing?',
    'How will you use this understanding?',
  ],
  [QuestionType.COMPARE]: [
    'What criteria matter most for this comparison?',
    'What\'s your current leaning or preference?',
    'What context will this decision be made in?',
  ],
  [QuestionType.CREATIVE]: [
    'What constraints or requirements must be met?',
    'What ideas have you already considered?',
    'What would make this truly remarkable or unique?',
  ],
  [QuestionType.GENERAL]: [
    'What\'s the most important aspect to focus on?',
    'What constraints or limitations should I know about?',
    'What does success look like for this brainstorm?',
  ],
};

// Universal closing questions
const CLOSING_QUESTIONS = [
  'Anything else important I should know before we dive in?',
  'Any other context that might be relevant?',
];

class QuestionGenerator {
  /**
   * Generates context-gathering follow-up questions.
   */

  constructor() {
    this.analyzer = new QueryAnalyzer();
  }

  /**
   * Generate follow-up questions for a query.
   * @param {string} query - The user's brainstorming question
   * @param {number} maxQuestions - Maximum number of questions to generate (default 4)
   * @returns {Object} FollowUpQuestions with smart, targeted questions
   */
  generate(query, maxQuestions = 4) {
    // Analyze the query
    const analysis = this.analyzer.analyze(query);
    const domain = analysis.domain;
    const questionType = analysis.questionType;

    const questions = [];

    // Add 1-2 domain-specific questions
    const domainQs = DOMAIN_QUESTIONS[domain] || DOMAIN_QUESTIONS[DomainType.GENERAL];
    questions.push(...domainQs.slice(0, 2));

    // Add 1-2 question-type-specific questions
    const typeQs = QUESTION_TYPE_QUESTIONS[questionType] || QUESTION_TYPE_QUESTIONS[QuestionType.GENERAL];
    questions.push(...typeQs.slice(0, 2));

    // Add closing question if room
    if (questions.length < maxQuestions) {
      questions.push(CLOSING_QUESTIONS[0]);
    }

    // Trim to max
    const finalQuestions = questions.slice(0, maxQuestions);

    return {
      query,
      questions: finalQuestions,
      domain,
      questionType,
      formatForDisplay: () => this._formatForDisplay(finalQuestions),
    };
  }

  /**
   * Format questions for user display.
   * @param {string[]} questions - List of questions
   * @returns {string} Formatted output
   */
  _formatForDisplay(questions) {
    const lines = [
      'I\'d like to understand your situation better before brainstorming.',
      'A few quick questions:',
      '',
    ];
    questions.forEach((q, i) => {
      lines.push(`${i + 1}. ${q}`);
    });
    lines.push('');
    lines.push('(Feel free to answer briefly - even partial answers help!)');
    return lines.join('\n');
  }
}

module.exports = {
  QuestionGenerator,
  DOMAIN_QUESTIONS,
  QUESTION_TYPE_QUESTIONS,
  CLOSING_QUESTIONS,
};
