/* eslint-disable no-restricted-syntax */
import { matchSorter } from "match-sorter";
import sortBy from "sort-by";
import JSON5 from 'json5';
import customStorage from '../store/customStorage';

const defaultShelf = {
  New: null,
  Study: [],
  Work: [],
  Entertainment: [],
};



export async function queryNote(query) {
  let notes = await customStorage.getItem("note");
  if (!notes) notes = [];
  if (query) {
     notes = notes.filter( contact => {
      const {cards} = contact;
      if( cards && cards.length > 0) {
        for(let i = 0; i < cards.length; i++){
          if( cards[i] && cards[1].indexOf(query) >= 0) return true;
        }
      }
      const {tags} = contact;
      if( tags && tags.length > 0) {
        for(let i = 0; i < tags.length; i++){
          if( tags[i] && tags[1].indexOf(query) >= 0) return true;
        }
      }
      return false;
    });
  }
  return notes.sort(sortBy("date", "bookKey"));
}

export async function setShelf(shelfTitle , bookKey ) {
  const json = await customStorage.getItem("shelfList") as string;
  const obj = JSON5.parse(json!) || defaultShelf;
  if (obj[shelfTitle] === undefined) {
    obj[shelfTitle] = [];
  }
  if (obj[shelfTitle].indexOf(bookKey) === -1) {
    obj[shelfTitle].unshift(bookKey);
  }
  customStorage.setItem("shelfList", JSON.stringify(obj));
}
export async function getShelf() {
  const json = await customStorage.getItem("shelfList") as string;
  const obj = (json &&JSON5.parse(json!)) || defaultShelf;
  return obj;
}

export async function clearShelf(shelfIndex , bookKey ) {
  const json = await customStorage.getItem("shelfList") as string;
  const obj = JSON5.parse(json!) || defaultShelf;
  const shelfTitle = Object.keys(obj);
  const currentShelfTitle = shelfTitle[shelfIndex];
  const index = obj[currentShelfTitle].indexOf(bookKey);
  obj[currentShelfTitle].splice(index, 1);
  customStorage.setItem("shelfList", JSON.stringify(obj));
}

export async function deleteFromAllShelf(bookKey) {
  const json = await customStorage.getItem("shelfList") as string;
  const obj = JSON5.parse(json!) || defaultShelf;
  const shelfTitle = Object.keys(obj);
  shelfTitle.splice(0, 1);
  shelfTitle.forEach((item) => {
    const index = obj[item].indexOf(bookKey);
    if (index > -1) {
      obj[item].splice(index, 1);
    }
  });
  customStorage.setItem("shelfList", JSON.stringify(obj));
}

export async function removeShelf(shelfTitle: string) {
  const json = await customStorage.getItem("shelfList") as string;
  const obj = JSON5.parse(json!) || defaultShelf;
  delete obj[shelfTitle];
  customStorage.setItem("shelfList", JSON.stringify(obj));
}

export async function getBookPosition(bookKey) {
  const json = await customStorage.getItem("shelfList") as string;
  const obj = JSON5.parse(json!) || defaultShelf;
  const shelfList = [];
  for (const item in obj) {
    if (obj[item] && obj[item].indexOf(bookKey) > -1) {
      shelfList.push(item);
    }
  }
  return shelfList;
}

