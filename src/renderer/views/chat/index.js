/* eslint-disable prettier/prettier */
import React, {useEffect, useState} from 'react'
import { useLoaderData } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';


import ChatPageView from './ChatPageView';

import { getChatById, createChat, createMessage } from '../../api/chatApi';
import { chatAdded, chatHandled, messageAdded } from '../../store/reducers/chatSlice';


export async function loader({ params }) {
  const id = params.id || '';
  if ( id === ''){
    return { data: null, fromClipboard: false };
  }
  if ( id === 'fromClipboard'){
    return { data: null, fromClipboard: true };
  }
  const chat = await getChatById(params.id || '');
  // if (!book) {
  //   throw new Response('', {
  //     status: 404,
  //     statusText: `Book Not Found FOR ${params.key}`,
  //   });
  // }
   return { data: chat, fromClipboard: false };
}

function ChatPage() {
  const [curChat, setCurChat] = useState(null);
  const { data: chat, fromClipboard } = useLoaderData();
  const dispatch = useDispatch();

  useEffect(() => {
    async function handleFromClipboard(){
      const content =  navigator.clipboard.readText();
    //  const id = uuid();
      const achat = {
      //  id,
        description: 'New Chat',
        totalTokens: 0,
        createdAt: new Date(),
        pinned: false,
        autoDelete: true,
      };
      const c = await createChat(achat);
      dispatch(chatAdded(c));
      const m = await createMessage({
       // id: uuid(),
        chatId: c.id,
        content,
        role: 'user',
        createdAt: new Date(),
      });
      // navigate({ to: `/chats/${id}` });
      dispatch(messageAdded(m));
      dispatch(chatHandled(c));
      setCurChat(c);
    };

    if (fromClipboard){
      handleFromClipboard();
    } else if ( chat ){
      dispatch(chatHandled(chat));
      setCurChat(chat);
    }
  }, [chat, fromClipboard]);


  // React.useEffect(() => {
  //   if (!chat) return;
  //   async function cdr() {
  //   }
  //   cdr();
  // }, [chat]);

  return (
    <div className="main note__main">
      <ChatPageView  chat={curChat}/>
    </div>
  );
}
export default ChatPage;
