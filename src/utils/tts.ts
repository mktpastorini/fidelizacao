export const speak = (text: string) => {
  if ('speechSynthesis' in window) {
    // Cancela qualquer fala anterior para evitar sobreposição
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1; // Velocidade da fala
    utterance.pitch = 1; // Tom da fala
    
    window.speechSynthesis.speak(utterance);
  } else {
    console.warn("Seu navegador não suporta a API de Síntese de Voz.");
  }
};