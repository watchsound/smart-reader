/* eslint-disable prettier/prettier */
import React, {useEffect, useRef, useState} from 'react';
import { Box } from '@mui/material';

import { styled } from '@mui/material/styles';
import { parseMarkdownToHtmlNoCallback } from '../note/NoteUtil';
import { wrapTokensToHtml, wrapWordsInHtml } from './RichTextUtil';

import './animation.css';

const Annotation = styled('div')(({ theme }) => ({
  position: 'relative',
  marginBottom: '20px',
}));

function RichTextCard({
  input,
  isHtml,
  tokenCallback,
  showToken,
  entryEffect,
  emphasisEffect,
}) {
  const [htmlCode, setHtmlCode] =  useState('');
  const [tokens, setTokens] = useState([]);
  const [parentLoc, setParentLoc] = useState({top:0,left:0});

  const containerRef = useRef(null);
  const parentRef = useRef(null);

  // useEffect(() => {
  //  setRepaint(repaint);
  // },[repaint]);

  useEffect(() => {
    const updatePositions = () => {
      const container = containerRef.current;
      if (!container) return;
      const parent = parentRef.current;
      if (!parent) return;
      const parentRect = parent.getBoundingClientRect();
      setParentLoc({top: parentRect.top, left:parentRect.left})
      const exists = parent.querySelectorAll('.zz');
      exists.forEach((el) => el.remove());

      const tokenElements = container.querySelectorAll('.token');
      const newTokens = Array.from(tokenElements).map((el) => {
        const clonedEl = el.cloneNode(true); // Deep clone the element
        // Set the cloned element's position to 'absolute'
        clonedEl.style.position = 'absolute';

        // Copy the top and left values from the original element
        const rect = el.getBoundingClientRect();
        const absoluteTop = rect.top - parentRect.top;// + window.scrollY;
        const absoluteLeft = rect.left - parentRect.left ; // + window.scrollX;

        // Set the cloned element's position to 'absolute'
        clonedEl.style.position = 'absolute';
        clonedEl.style.top = `${absoluteTop}px`;
        clonedEl.style.left = `${absoluteLeft}px`;


        // clonedEl.style.visibility = showToken ? 'visible' : 'hidden';
          // Remove class XX and add class YY
        if (showToken) clonedEl.classList.remove('hidden');
        else clonedEl.classList.add('hidden');
        clonedEl.classList.add('zz');
        parent.appendChild(clonedEl);
        return {
          id: el.id,
          text: el.innerHTML,
          top: absoluteTop,
          left: absoluteLeft,
          el: clonedEl,
        };
      });
      if (tokenCallback) tokenCallback({parentLoc: {top: parentRect.top, left:parentRect.left},
        tokens: newTokens});
      setTokens(newTokens);
    };

    updatePositions();
    window.addEventListener('resize', updatePositions);
    return () => window.removeEventListener('resize', updatePositions);
  }, [htmlCode, showToken]);

  React.useEffect(() => {
    async function t() {
      let html = await parseMarkdownToHtmlNoCallback(input);
      html = wrapWordsInHtml(html, 'token hidden');
      setHtmlCode(html);
      setTokens([]);
    }
    if (!input) return;
    if (Array.isArray(input)) {
      const html = wrapTokensToHtml(input, 'token hidden');
      setHtmlCode(html);
      setTokens([]);
    } else if (isHtml) {
      const html = wrapWordsInHtml(input, 'token hidden');
      setHtmlCode(html);
      setTokens([]);
    } else {
      t();
    }
  }, [input, isHtml]);

  const entryWordByWord = async (effect) => {
    tokens.forEach((word, index) => {
       word.el.style.opacity = 0.01;
    });

    tokens.forEach((word, index) => {
        setTimeout(() => {
            word.el.classList.add(effect);
        }, index * 200); // Delay of 500ms between each word
    });
  };

  useEffect(() => {
    if(!entryEffect) return;
    if (tokens.length === 0) return;
    entryWordByWord(entryEffect);
  },[entryEffect, tokens]);

  const emphasisWordByWord = async (effect) => {
      tokens.forEach((word, index) => {
            setTimeout(() => {
                word.el.classList.add(effect);
            }, index * 200); // Delay of 500ms between each word
        });
  };

  useEffect(() => {
    if(!emphasisEffect) return;
    if (tokens.length === 0) return;
    emphasisWordByWord(emphasisEffect);
  },[emphasisEffect, tokens]);

  return (
    <Box ref={containerRef}>
      <Annotation ref={parentRef}>
        <div
          id="original-layer"
          dangerouslySetInnerHTML={{ __html: htmlCode }}
        />
      </Annotation>
    </Box>
  );
}

export default RichTextCard;
