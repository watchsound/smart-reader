/* eslint-disable promise/param-names */
/* eslint-disable prettier/prettier */
import { matchSorter } from "match-sorter";
import sortBy from "sort-by";
import { v4 as uuid } from 'uuid';
import customStorage from '../store/customStorage';



export async function getMoodBoardsByQuery(query, page, limit) {
  const r = await customStorage.getMoodBoardsByQuery(query || '', page, limit);
  return r??[];
}

export async function getMoodBoardById(id) {
  const r = await customStorage.getMoodBoardById(id);
  return r;
}

export async function createMoodBoard(board) {
  const r = await customStorage.createMoodBoard(board);
  return r;
}

export async function updateMoodBoard(id, field, value) {
  const r = await customStorage.updateMoodBoard(id, field, value);
  return r;
}


export async function deleteMoodBoardById(id) {
  const r = await customStorage.deleteMoodBoardById(id);
  return r;
}

export async function deleteAllMoodBoards() {
  const r = await customStorage.deleteAllMoodBoards();
  return r;
}
