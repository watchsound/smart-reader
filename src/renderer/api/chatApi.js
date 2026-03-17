/* eslint-disable promise/param-names */
/* eslint-disable prettier/prettier */
// import { matchSorter } from "match-sorter";
import sortBy from "sort-by";
import { v4 as uuid } from 'uuid';
import customStorage from '../store/customStorage';

export async function getPinnedChats( ) {
  const r = await customStorage.getPinnedChats( );
  return r ?? null;
}
export async function getPinnedLearnAbout() {
  const r = await customStorage.getPinnedLearnAbout();
  return r ?? null;
}

;
export async function getLearnAboutByQuery({ query, page, limit }) {
  const r = await customStorage.getLearnAboutByQuery({ query, page, limit });
  return r ?? null;
}

export async function getChatsByQuery({query, page, limit}) {
  const r = await customStorage.getChatsByQuery({query, page, limit});
  return r ?? null;
  // let chats = await customStorage.queryCollection("chat", query, "description");
  // if (!chats) chats = [];
  // return chats.sort(sortBy("createdAt"));
}

export async function getChatById(id) {
  const r = await customStorage.getChatById(id);
  return r ?? null;
  // const r = await customStorage.getOneInCollection("chat", 'id', id);
  // return r ?? null;
}

export async function createChat(chat) {
  const r = await customStorage.createChat(chat);
  return r ?? null;
  // if (typeof chat.id === 'undefined')
  //   chat.id = uuid();
  // if (typeof chat.createdAt === 'undefined')
  //   chat.createdAt = Date.now();
  // const c = await customStorage.upSertCollectionInStore('chat', 'id', chat.id, chat);
  // return c;
}

export async function updateChat({id, field, value}) {
  const r = await customStorage.updateChat(id, field, value);
  return r ?? null;
  // if( typeof id === 'string' && updates){
  //   const c = await customStorage.upSertCollectionInStore('chat', 'id', id, updates);
  //   return c;
  // }
  // if( typeof id.id === 'string' ){
  //   const c = await customStorage.upSertCollectionInStore('chat', 'id', id.id, id);
  //   return c;
  // }
  // throw new Error("input parameters are wrong for updateNote. id = ", id);
}

export async function updateChatPin(id, value) {
  const r = await customStorage.updateChat(id, 'pinned', value ? 1 : 0);
  return r ?? null;
  // const chat  = await getChatById(id);
  // if(!chat) return null;
  // chat.pinned = !chat.pinned;
  // const c = await updateChat(chat);
  // return c;
}
export async function updateChatTokenUsage(id, value) {
  const chat = await this.getChatById(id);
  if(!chat) return chat;
  const r = await customStorage.updateChat(id, 'total_tokens', chat.totalTokens? chat.totalTokens+value: value);
  return r ?? null;

  // const chat = await getChatById(id);
  // if(!chat) return;
  // if (chat.totalTokens) {
  //   chat.totalTokens += value;
  // } else {
  //   chat.totalTokens = value;
  // }
  // updateChat(id, chat);
}

export async function deleteChat(id) {
  const r = await customStorage.deleteChatById(id);
  return r ?? -1;
  // await customStorage.removeItem(`message_${id}`);
  // await customStorage.deleteCollectionInStore('chat', 'id', id);
  // return true;
}

export async function deleteAllChats() {
  const r = await customStorage.deleteAllChat();
  return r ?? -1;
  // const chats = await customStorage.getItem("chat");
  // if(!chats) return;
  // chats.forEach(chat => {
  //   customStorage.removeItem(`message_${chat.id}`);
  // });
  // customStorage.removeItem('chat');
}

export async function getPromptById(id) {
  const r = await customStorage.getPromptById(id);
  return r ?? -1;
  // const r = await customStorage.getOneInCollection("prompt", "id", id);
  // return r ?? null;
}

export async function getPromptsByQuery({query, page, limit}) {
  const r = await customStorage.getPromptsByQuery({query, page, limit});
  return r ?? {
      data: [],
      total: 0,
      totalPages: 0,
      currentPage: 0
  };
  // const prompts = await customStorage.queryCollection("prompt", query, "description");
  // return prompts || [];
}

export async function createPrompt(prompt) {
  const r = await customStorage.createPrompt(prompt);
  return r ?? prompt;
  // if (typeof prompt.id === 'undefined')
  //   prompt.id = uuid();
  // if (typeof prompt.createdAt === 'undefined')
  //   prompt.createdAt = Date.now();
  // const c = await  customStorage.upSertCollectionInStore("prompt", 'id', prompt.id, prompt);
  // return c;
}
export async function deletePrompt(promptId) {
  const r = await customStorage.deletePrompt(promptId);
  return r ?? -1;
  // await customStorage.deleteCollectionInStore('prompt', 'id', promptId)
  // return true;
}
export async function deleteAllPrompts() {
  const r = await customStorage.deleteAllPrompts( );
  return r ?? -1;
  // await  customStorage.setItem("prompt", []);
  // return true;
}

export async function updatePrompt(id, key, value) {
  const r = await customStorage.updatePrompt( id, key, value);
  return r ?? null;
  // if( typeof id === 'string' && updates){
  //   const v = await customStorage.upSertCollectionInStore("prompt", 'id', id, updates);
  //   return v;
  // }
  // if( typeof id.id === 'string' ){
  //   const v = await customStorage.upSertCollectionInStore("prompt", 'id', id.id, id);
  //   return v;
  // }
  // throw new Error("input parameters are wrong for updateNote. id = ", id);
}

//
export async function getMessagesByChatId(id) {
  const r = await customStorage.getMessagesByChatId( id );
  return r ?? [];
  // const messages = await customStorage.getItem(`message_${id}`);
  // if (!messages) return [];
  // return messages.sort(sortBy("createdAt"));
}
export async function getFirstMessageByChatId(id) {
  const r = await customStorage.getMessagesByChatId( id );
  return !r || r.length === 0 ? null : r[0];
  // const messages = await getMessagesByChatId(id);
  // return messages.length === 0 ? null : messages[0];
}
export async function getMessageById( id) {
  const r = await customStorage.getMessageById( id );
  return r ?? null;
  // const messages = await getMessagesByChatId(chatId);
  // const r = messages.find(message => message.id === id);
  // return r ?? null;
}

export async function createMessage(message) { console.log("create message")
  const r = await customStorage.createMessage( message );
  return r ?? null;
  // if (typeof message.id === 'undefined')
  //   message.id = uuid();
  // if (typeof message.createdAt === 'undefined')
  //   message.createdAt = Date.now();
  // const c = await  customStorage.upSertCollectionInStore(`message_${chatId}`, 'id', message.id, message);
  // return c;
}

export async function updateMessage({id, key, value}) {
  const r = await customStorage.updateMessage( id, key, value );
  return r ?? null;
  // const c = await  customStorage.upSertCollectionInStore(`message_${chatId}`, 'id', id, updates);
  // return c;
}
