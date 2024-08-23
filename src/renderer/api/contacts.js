/* eslint-disable prettier/prettier */

import { matchSorter } from "match-sorter";
import sortBy from "sort-by";
import customStorage from '../store/customStorage';

function set(contacts) {
  return customStorage.setItem("contacts", contacts);
}

export async function getContacts(query) {
  let contacts =  await customStorage.getItem("contacts");
  if (!contacts) contacts = [];
  if (query) {
    contacts = matchSorter(contacts, query, { keys: ["first", "last"] });
  }
  return contacts.sort(sortBy("last", "createdAt"));
}

export async function createContact() {
  const id = Math.random().toString(36).substring(2, 9);
  const contact = { id, createdAt: Date.now() };
  const contacts = await getContacts();
  contacts.unshift(contact);
  await set(contacts);
  return contact;
}

export async function getContact(id) {
  const contacts = await customStorage.getItem("contacts");
  const contact = contacts.find(c => c.id === id);
  return contact ?? null;
}

export async function updateContact(id, updates) {
  const contacts = await customStorage.getItem("contacts");
  const contact = contacts.find(c => c.id === id);
  if (!contact) throw new Error("No contact found for", id);
  Object.assign(contact, updates);
  await set(contacts);
  return contact;
}

export async function deleteContact(id) {
  const contacts = await customStorage.getItem("contacts");
  const index = contacts.findIndex(contact => contact.id === id);
  if (index > -1) {
    contacts.splice(index, 1);
    await set(contacts);
    return true;
  }
  return false;
}


