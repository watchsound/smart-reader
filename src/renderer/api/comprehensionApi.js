/**
 * comprehensionApi — renderer-side client for Phase 6 comprehension IPC.
 *
 * generateQuestion: asks main to call the AI and produce an open-ended question.
 * gradeAnswer: asks main to grade the reader's free-text answer.
 *
 * Both return the raw payload from the handler (success or { error }).
 */

const comprehensionApi = {
  /**
   * @param {{ chapterTitle: string, textExcerpt: string, bookTitle?: string }} params
   * @returns {Promise<{ question: string } | { error: string }>}
   */
  async generateQuestion({ chapterTitle, textExcerpt, bookTitle = '' }) {
    return window.electron.ipcRenderer.invoke(
      'comprehension-generate-question',
      {
        chapterTitle,
        textExcerpt,
        bookTitle,
      },
    );
  },

  /**
   * @param {{ chapterTitle: string, textExcerpt: string, bookTitle?: string, question: string, answer: string, learningPointId?: string|null, questionId?: string|null }} params
   * @returns {Promise<{ score: number, strengths: string[], gaps: string[], feedback: string } | { error: string }>}
   */
  async gradeAnswer({
    chapterTitle,
    textExcerpt,
    bookTitle = '',
    question,
    answer,
    learningPointId = null,   // Phase 13: attribution — passed through to mastery_event writer
    questionId = null,        // Phase 13: attribution — passed through to mastery_event writer
  }) {
    return window.electron.ipcRenderer.invoke('comprehension-grade-answer', {
      chapterTitle,
      textExcerpt,
      bookTitle,
      question,
      answer,
      learningPointId,
      questionId,
    });
  },
};

export default comprehensionApi;
