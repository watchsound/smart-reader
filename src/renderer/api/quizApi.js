/* eslint-disable promise/param-names */
/* eslint-disable prettier/prettier */
import { matchSorter } from "match-sorter";
import sortBy from "sort-by";
import { v4 as uuid } from 'uuid';
import customStorage from '../store/customStorage';



export async function getQuizProblemByQuery({ query, page, limit }) {
  const r = await customStorage.getQuizProblemByQuery({ query, page, limit });
  return r??[];
  // let quizzes = await customStorage.queryCollection("quiz_problem", query, "question");
  // if (!quizzes) quizzes = [];
  // return quizzes.sort(sortBy("createdAt"));
}

export async function getQuizProblemById(id) {
  const r = await customStorage.getQuizProblemById(id);
  return r;
  // const r = await customStorage.getOneInCollection("quiz_problem", 'id', id);
  // return r ?? null;
}

export async function createQuizProblem(quizProblem) {
  const r = await customStorage.createQuizProblem(quizProblem);
  return r;
  // if (typeof quizProblem.id === 'undefined')
  //   quizProblem.id = uuid();
  // if (typeof quizProblem.createdAt === 'undefined')
  //   quizProblem.createdAt = Date.now();
  // const c = await customStorage.upSertCollectionInStore('quiz_problem', 'id', quizProblem.id, quizProblem);
  // return c;
}

export async function updateQuizProblem(id, field, value) {
  const r = await customStorage.updateQuizProblem(id, field, value);
  return r;
  // if( typeof id === 'string' && updates){
  //   const c = await customStorage.upSertCollectionInStore('quiz_problem', 'id', id, updates);
  //   return c;
  // }
  // if( typeof id.id === 'string' ){
  //   const c = await customStorage.upSertCollectionInStore('quiz_problem', 'id', id.id, id);
  //   return c;
  // }
  // throw new Error("input parameters are wrong for updateNote. id = ", id);
}


export async function deleteQuizProblem(id) {
  const r = await customStorage.deleteQuizProblemById(id);
  return r;
  // await customStorage.deleteCollectionInStore('quiz_problem', 'id', id);
  // return true;
}

export async function deleteAllQuizProblem() {
  const r = await customStorage.deleteAllQuizProblem();
  return r;
  // customStorage.removeItem('quiz_problem');
}


export async function getQuizProblemsBySourceKey(id) {
  const r = await customStorage.getQuizProblemBySourceKeyAndSourceType(id, 'note');
  return r;
  // const prompts = await customStorage.queryCollection("quiz_problem", id, "sourceKey");
  // return prompts || [];
}
