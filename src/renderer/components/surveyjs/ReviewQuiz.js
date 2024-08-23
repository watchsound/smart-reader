import React from 'react';
import { Model } from 'survey-core';
import { Survey } from 'survey-react-ui';
import 'survey-core/defaultV2.min.css';
import './index.css';

const sampleJson = {
  title: 'American History',
  showProgressBar: 'off',
  showTimerPanel: 'top',
  maxTimeToFinishPage: 10,
  maxTimeToFinish: 25,
  firstPageIsStarted: true,
  startSurveyText: 'Start Quiz',
  pages: [
    {
      elements: [
        {
          type: 'html',
          html: 'You are about to start a quiz on American history. <br>You will have 10 seconds for every question and 25 seconds to end the quiz.<br>Enter your name below and click <b>Start Quiz</b> to begin.',
        },
        {
          type: 'text',
          name: 'username',
          titleLocation: 'hidden',
          isRequired: true,
        },
      ],
    },
    {
      elements: [
        {
          type: 'radiogroup',
          name: 'civilwar',
          title: 'When was the American Civil War?',
          choices: ['1796-1803', '1810-1814', '1861-1865', '1939-1945'],
          correctAnswer: '1861-1865',
        },
      ],
    },
    {
      elements: [
        {
          type: 'radiogroup',
          name: 'libertyordeath',
          title: 'Whose quote is this: "Give me liberty, or give me death"?',
          choicesOrder: 'random',
          choices: [
            'John Hancock',
            'James Madison',
            'Patrick Henry',
            'Samuel Adams',
          ],
          correctAnswer: 'Patrick Henry',
        },
      ],
    },
    {
      elements: [
        {
          type: 'radiogroup',
          name: 'magnacarta',
          title: 'What is Magna Carta?',
          choicesOrder: 'random',
          choices: [
            'The foundation of the British parliamentary system',
            'The Great Seal of the monarchs of England',
            'The French Declaration of the Rights of Man',
            'The charter signed by the Pilgrims on the Mayflower',
          ],
          correctAnswer: 'The foundation of the British parliamentary system',
        },
      ],
    },
  ],
  completedHtml:
    '<h4>You got <b>{correctAnswers}</b> out of <b>{questionCount}</b> correct answers.</h4>',
  completedHtmlOnCondition: [
    {
      expression: '{correctAnswers} == 0',
      html: '<h4>Unfortunately, none of your answers is correct. Please try again.</h4>',
    },
    {
      expression: '{correctAnswers} == {questionCount}',
      html: '<h4>Congratulations! You answered all the questions correctly!</h4>',
    },
  ],
};

/**
 *
 * @param {*} param0
 * @returns
 */
function ReviewQuiz({ quizJson }) {
  const survey = new Model(quizJson || sampleJson);
  survey.onComplete.add((sender, options) => {
    console.log(JSON.stringify(sender.data, null, 3));
  });
  survey.data = {
    civilwar: '1861-1865',
    libertyordeath: 'Samuel Adams',
    magnacarta: 'The foundation of the British parliamentary system',
  };

  survey.mode = 'display';
  survey.questionsOnPageMode = 'singlePage';
  survey.showNavigationButtons = 'none';
  survey.showProgressBar = 'off';
  survey.showTimerPanel = 'none';
  survey.maxTimeToFinishPage = 0;
  survey.maxTimeToFinish = 0;
  const correctStr = 'Correct';
  const inCorrectStr = 'Incorrect';

  function getTextHtml(text, str, isCorrect) {
    if (text.indexOf(str) < 0) return undefined;
    return `${text.substring(0, text.indexOf(str))}<span class='${
      isCorrect ? 'correctAnswer' : 'incorrectAnswer'
    }'>${str}</span>`;
  }

  function renderCorrectAnswer(q) {
    if (!q) return;
    const isCorrect = q.isAnswerCorrect();
    if (!q.prevTitle) {
      q.prevTitle = q.title;
    }
    if (isCorrect === undefined) {
      q.title = q.prevTitle;
    }
    q.title = `${q.prevTitle} ${isCorrect ? correctStr : inCorrectStr}`;
  }

  survey.onValueChanged.add((sender, options) => {
    renderCorrectAnswer(options.question);
  });

  survey.onTextMarkdown.add((sender, options) => {
    const { text } = options;
    let html = getTextHtml(text, correctStr, true);
    if (!html) {
      html = getTextHtml(text, inCorrectStr, false);
    }
    if (html) {
      options.html = html;
    }
  });

  survey.getAllQuestions().forEach((q) => renderCorrectAnswer(q));
  return <Survey model={survey} />;
}

export default ReviewQuiz;
