import React from 'react';
import { Model, Serializer } from 'survey-core';
import { Survey } from 'survey-react-ui';
import 'survey-core/defaultV2.min.css';
import './index.css';
import customStorage from '../../store/customStorage';

// const sampleJson = {
//   title: 'How Big of a Star Wars Fan You Are',
//   logoPosition: 'right',
//   showProgressBar: 'off',
//   showTimerPanel: 'top',
//   maxTimeToFinishPage: 20,
//   completedHtmlOnCondition: [
//     {
//       expression: '{totalScore} > 14',
//       html: 'You got {totalScore} out of {maxScore} points.</br></br>Congratulation! You did great!',
//     },
//     {
//       expression: '{totalScore} > 7',
//       html: 'You got {totalScore} out of {maxScore} points.</br></br>Well Done! <i>Your focus determines your reality.</i> And this is the way you passed the quiz.',
//     },
//     {
//       expression: '{totalScore} <= 7',
//       html: "You got {totalScore} out of {maxScore} points.</br></br><i>In my experience</i>, as Obi-Wan Kenobi said, <i>there's no such thing as luck.</i>",
//     },
//   ],
//   pages: [
//     {
//       name: 'startPage',
//       elements: [
//         {
//           type: 'html',
//           name: 'welcomeMsg',
//           html: "<b>Take this funny quiz to find out how well you know Star Wars.</b></br></br><i>May the Force be with you.</i></br><img src=' https://surveyjs.io/Content/Images/examples/scored-quiz/introImg.jpg' width='100%' height='auto',></img>\n",
//         },
//       ],
//     },
//     {
//       elements: [
//         {
//           type: 'radiogroup',
//           name: 'qFirstMovieReleaseYear',
//           title: 'What year did the first Star Wars movie come out?',
//           choices: [1980, 2015, 1977],
//           correctAnswer: 1977,
//           score: 5,
//         },
//       ],
//     },
//     {
//       elements: [
//         {
//           type: 'radiogroup',
//           name: 'qBabyYodaName',
//           score: 3,
//           title: "What is Baby Yoda's real name?",
//           correctAnswer: 'grogu',
//           choices: [
//             {
//               value: 'mike',
//               text: 'Mike',
//             },
//             {
//               value: 'grogu',
//               text: 'Grogu',
//             },
//             {
//               value: 'din',
//               text: 'Din',
//             },
//           ],
//         },
//       ],
//     },
//     {
//       elements: [
//         {
//           type: 'rating',
//           name: 'qSithLordsCount',
//           score: 3,
//           title:
//             'According to Yoda, how many Sith Lords there always are? No more. No less.',
//           correctAnswer: 2,
//           rateValues: [0, 1, 2, 3, 4],
//         },
//       ],
//     },
//     {
//       elements: [
//         {
//           type: 'boolean',
//           name: 'qBobaFettSurvival',
//           score: 4,
//           title: 'Boba Fett survived the Sarlacc pit. True or false?',
//           labelTrue: 'True',
//           labelFalse: 'False',
//           correctAnswer: true,
//         },
//       ],
//     },
//     {
//       elements: [
//         {
//           type: 'image',
//           name: 'falconImage',
//           imageLink:
//             'https://surveyjs.io/Content/Images/examples/scored-quiz/millenium-falcon.jpg',
//         },
//         {
//           type: 'radiogroup',
//           name: 'qHanSolosShipName',
//           score: 5,
//           startWithNewLine: false,
//           title: "What is the name of Han Solo's ship?",
//           correctAnswer: 'falcon',
//           choices: [
//             {
//               value: 'corfe',
//               text: 'The Corfe Castle',
//             },
//             {
//               value: 'blackPearl',
//               text: 'The Black Pearl',
//             },
//             {
//               value: 'falcon',
//               text: 'The Millennium Falcon',
//             },
//           ],
//         },
//       ],
//     },
//   ],
//   firstPageIsStarted: true,
// };

// Add a custom `score` property to survey questions
Serializer.addProperty('question', {
  name: 'score:number',
});

/**
 *
 * @param {*} param0
 * @returns
 */
function ScoredQuiz({ quizJson, quizProblems }) {
  const [survey, setSurvey] = React.useState(null);

  function calculateMaxScore(questions) {
    let maxScore = 0;
    questions.forEach((question) => {
      if (question.score) {
        maxScore += question.score;
      }
    });
    return maxScore;
  }
  function calculateTotalScore(data) {
    let totalScore = 0;
    Object.keys(data).forEach((qName, index) => {
      const question = survey.getQuestionByValueName(qName);
      if (question.isAnswerCorrect()) {
        if (question.score) {
          totalScore += question.score;
        }
      }
      try {
        const qz = quizProblems[index];
        customStorage.updateQuizProblem(
          qz.id,
          'correct',
          question.isAnswerCorrect() ? 1 : -1,
        );
      } catch (e) {
        console.log(e);
      }
    });
    return totalScore;
  }
  React.useEffect(() => {
    if (!quizJson) return;
    const s = new Model(quizJson);
    s.onComplete.add((sender, options) => {
      console.log(JSON.stringify(sender.data, null, 3));
    });
    s.onCompleting.add((sender) => {
      const totalScore = calculateTotalScore(sender.data);
      const maxScore = calculateMaxScore(sender.getAllQuestions());

      // Save the scores in survey results
      sender.setValue('maxScore', maxScore);
      sender.setValue('totalScore', totalScore);
    });
    setSurvey(s);
  }, [quizJson]);

  if (!survey) return null;
  return <Survey model={survey} />;
}

export default ScoredQuiz;
