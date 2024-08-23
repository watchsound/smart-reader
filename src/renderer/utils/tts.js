// src/renderer/utils/tts.js

export default async function speakText(text) {
  console.log('enter speakText in tts.js')
  if ('speechSynthesis' in window) {
    console.log('speakText in window')
    // Cancel any ongoing speech synthesis
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const selectedVoice = voices.find(
      (voice) =>
        voice.name.includes('Google') || voice.name.includes('Microsoft'),
    );

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    } else {
      console.warn('No high-quality voice found, using default voice.');
    }

    // Optional: Set voice and other properties
    // utterance.voice = window.speechSynthesis.getVoices()[0];
    // utterance.pitch = 1;
    // utterance.rate = 1;
    // utterance.volume = 1;

    window.speechSynthesis.speak(utterance);
  } else {
    console.log('Sorry, your browser does not support text to speech!');
  }
}
