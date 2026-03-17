import { createRewriteHtmlCodeForElementarySchoolPrompt } from '../../../commons/utils/AIPrompts';
import { instanceInRender as aiProviderManager } from '../../../commons/service/AIProviderManager';

export function getTextContentWithTags(element) {
  let textWithTags = '';
  const nodes = element.childNodes;

  nodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      textWithTags += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      const content = getTextContentWithTags(node);
      textWithTags += `<${tag}>${content}</${tag}>`;
    }
  });

  return textWithTags;
}

export function setTranslatedContent(element, translatedText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(translatedText, 'text/html');
  element.innerHTML = doc.body.innerHTML;
}

export default async function rewriteHtmlForElementarySchool(document) {
  const bodyContent = getTextContentWithTags(document.body);

  try {
    const prompt = `${createRewriteHtmlCodeForElementarySchoolPrompt}\n${bodyContent}`;
    const translatedContent = await aiProviderManager.generateContentWithJson(
      prompt,
      false,
    );
    setTranslatedContent(document.body, translatedContent);
  } catch (error) {
    console.error('Translation error:', error);
  }
}
