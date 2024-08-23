import customStorage from '../../store/customStorage';
import { QuizType } from '../../../commons/model/DataTypes';
/**
 * from:
 *  {
      question: string;
      options: {
        optionA : string;
        optionB : string;
        optionC : string;
        optionD : string;
      },
      answer: string;
      myChoice: string;
    }
 *
    to :

    {
      "type": "radiogroup",
      "name": "libertyordeath",
      "title": "Whose quote is this: \"Give me liberty, or give me death\"?",
      "choicesOrder": "random",
      "choices": [
        "John Hancock",
        "James Madison",
        "Patrick Henry",
        "Samuel Adams"
      ],
      "correctAnswer": "Patrick Henry",
      "enableIf": "{libertyordeath} empty"
    }

 * @param {*} question
 */
export function questionToSurveyJs(qid, question) {
  return {
    type: 'radiogroup',
    name: qid,
    title: question.question,
    choicesOrder: 'random',
    choices: [
      question.options.optionA,
      question.options.optionB,
      question.options.optionC,
      question.options.optionD,
    ],
    correctAnswer: question.options[question.answer],
    score: 1,
  };
}

/**
 *
 */
export async function quizToSurveyJs(/** a list of a set of problems */) {
  const problems = [];
  for (let i = 0; i < arguments.length; i++) {
    const arg = arguments[i];
    if (Array.isArray(arg)) problems.push(...arg);
    else problems.push(arg);
  }
  const showProgressBar =
    (await customStorage.getItem('quiz_showProgressBar')) || 'off';
  const showTimerPanel =
    (await customStorage.getItem('quiz_showTimerPanel')) || 'none';

  const progressBarType = showProgressBar === 'off' ? false : 'pages';
  const progressBarShowPageNumbers = true;
  const progressBarShowPageTitles = false;

  const quizType = await customStorage.getItem('quiz_type');
  const surveyQuiz = {
    title: 'Quiz',
    showProgressBar,
    progressBarType,
    progressBarShowPageNumbers,
    progressBarShowPageTitles,
    showTimerPanel,
    firstPageIsStarted: true,
    pages: [],
    completedHtml:
      quizType === QuizType.ScoredQuiz
        ? '<h4>You got <b>{totalScore}</b> out of <b>{maxScore}</b> points.</h4>'
        : '<h4>You got <b>{correctAnswers}</b> out of <b>{questionCount}</b> correct answers.</h4>',
    completedHtmlOnCondition:
      quizType === QuizType.ScoredQuiz
        ? [
            {
              expression: '{totalScore} > 0',
              html: 'You got {totalScore} out of {maxScore} points.</br></br>Congratulation! You did great!',
            },
          ]
        : [
            {
              expression: '{correctAnswers} == 0',
              html: '<h4>Congratulations.</h4>',
            },
            {
              expression: '{correctAnswers} == {questionCount}',
              html: '<h4>Congratulations! You answered all the questions correctly!</h4>',
            },
          ],
  };
  for (let i = 0; i < problems.length; i++) {
    const p = problems[i];
    const p2 = questionToSurveyJs(`qid-${i + 1}`, p);
    const page = {
      elements: [p2],
    };
    surveyQuiz.pages.push(page);
  }
  return surveyQuiz;
}

export function suerveyJsToQuiz() {}
