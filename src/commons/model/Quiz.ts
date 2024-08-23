export interface QuizProblem {
  id: string;
  sourceKey: string;
  sourceType: string;
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
