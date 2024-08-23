/* eslint-disable promise/param-names */
/* eslint-disable prettier/prettier */
import { matchSorter } from "match-sorter";
import sortBy from "sort-by";
import { v4 as uuid } from 'uuid';
import customStorage from '../store/customStorage';


export async function login(email, password, dispatch) {
  const userInfo = await customStorage.login(email, password, dispatch);
  return userInfo;
}

export async function logout(token) {
  const r = await customStorage.logout(token);
  return r;
}

export async function register(user, email, password) {
  const success = await customStorage.register(user, email, password);

  return success;
}
