// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA_VQH1y-px8-QF3gMw3VOPjiiU1OefDBo",
  authDomain: "almacena-correcciones-dictado.firebaseapp.com",
  projectId: "almacena-correcciones-dictado",
  storageBucket: "almacena-correcciones-dictado.appspot.com",
  messagingSenderId: "209194920272",
  appId: "1:209194920272:web:ccbec69d0a5aa88789e455",
  measurementId: "G-6PQSKYMDP0"
};

// API configuration
const API_URL = 'https://api-inference.huggingface.co/models/openai/whisper-large-v3-turbo';
const API_KEY = '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';

// AI Improvement Configuration
const AI_API_KEY = 'uFJi9MKJxz6ENwWkQcSFXNykjoeYyT3G';
const AI_AGENT_ID = 'ag:973cb1c2:20241203:asistente-radiologico:5542a3d9';

// Global variables and DOM elements
let firestoreConnection = false;
let db = null;
let unsubscribeSnapshot = null;
let mediaRecorder;
let audioChunks = [];
let startTime;
let timerInterval;
let isRecording = false;
let corrections = new Map();
let transcriptionElement;
let toggleButton;
let statusElement;
let timerElement;
let loadingElement;
let copyButton;
let correctTextButton;
let correctionModal;
let selectedTextElement;
let correctionTextArea;
let saveCorrectionBtn;
let cancelCorrectionBtn;
let improveWithAIButton;
let comparisonModal;
let textComparisonDiv;
let acceptAllChangesButton;
let cancelChangesButton;

// Firebase initialization and management
async function initializeFirebase() {
  try {
    if (!firebase.apps.length) {
      const app = firebase.initializeApp(firebaseConfig);
      db = firebase.firestore();

      db.settings({
        ignoreUndefinedProperties: true,
        merge: true,
        cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
      });

      await db.enablePersistence({
        synchronizeTabs: true
      }).catch(err => {
        console.warn('Offline persistence error:', err.code);
      });

      // Single connection state monitor
      const unsubscribeConnection = db.onSnapshotsInSync(() => {
        if (!firestoreConnection) {
          firestoreConnection = true;
          console.log('Firestore connection successful');
          showSuccessMessage('Conectado a Firestore');
          loadCorrections(); // Load corrections once when first connected
        }
      });

      return db;
    }

    console.log('Firebase already initialized');
    db = firebase.firestore();
    return db;

  } catch (error) {
    console.error('Firebase initialization error:', error);
    return null;
  }
}

// Function to split audio into chunks
async function splitAudioIntoChunks(audioBlob, chunkDuration = 30) {
  const audioContext = new AudioContext();
  const buffer = await audioContext.decodeAudioData(await audioBlob.arrayBuffer());
  const sampleRate = buffer.sampleRate;
  const totalSamples = buffer.length;
  const chunkSize = chunkDuration * sampleRate;

  let chunks = [];

  for (let i = 0; i < totalSamples; i += chunkSize) {
    const chunkBuffer = audioContext.createBuffer(
      buffer.numberOfChannels,
      Math.min(chunkSize, totalSamples - i),
      sampleRate
    );

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      const chunkData = chunkBuffer.getChannelData(channel);
      for (let j = 0; j < chunkBuffer.length; j++) {
        chunkData[j] = channelData[i + j];
      }
    }

    const chunkBlob = await bufferToBlob(chunkBuffer);
    chunks.push(chunkBlob);
  }

  return chunks;
}

async function bufferToBlob(buffer) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Blob([reader.result], { type: 'audio/wav' }));
    reader.readAsArrayBuffer(buffer);
  });
}

// Updated transcribeAudio function to handle long audio
async function transcribeAudio(audioBlob) {
  loadingElement.classList.remove('hidden');
  statusElement.textContent = 'Transcribiendo audio...';

  try {
    // Split audio into chunks
    const audioChunks = await splitAudioIntoChunks(audioBlob);

    let fullTranscription = '';

    // Transcribe each chunk
    for (const chunk of audioChunks) {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'audio/wav'
        },
        body: chunk
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error en la transcripción: ${response.status} ${errorText}`);
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(`Error API: ${result.error}`);
      }

      const rawText = result.text || '';
      fullTranscription += rawText + ' '; // Concatenate transcriptions
    }

    // Process the full transcription
    const processedText = processText(fullTranscription.trim());
    console.log('Final processed and corrected text:', processedText);

    // Insert the text into the transcription element
    const selection = window.getSelection();
    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    const isSelectionInTranscription = range && transcriptionElement.contains(range.commonAncestorContainer);
    const isAtEnd = isSelectionInTranscription &&
      range.startContainer === transcriptionElement &&
      range.startOffset === transcriptionElement.childNodes.length;

    if (isAtEnd || !isSelectionInTranscription) {
      // Cursor at end or no valid selection - append
      const currentContent = transcriptionElement.textContent;
      transcriptionElement.textContent = currentContent +
        (currentContent ? ' ' : '') + processedText.trim();
    } else if (selection.toString().length > 0) {
      // Text is selected - replace selection
      const currentContent = transcriptionElement.textContent;
      const formattedText = getSmartFormattedText(
        currentContent,
        processedText,
        range.startOffset
      );
      transcriptionElement.textContent =
        currentContent.substring(0, range.startOffset) +
        formattedText +
        currentContent.substring(range.endOffset);
    } else {
      // Cursor is positioned - insert at cursor
      const currentContent = transcriptionElement.textContent;
      const formattedText = getSmartFormattedText(
        currentContent,
        processedText,
        range.startOffset
      );
      transcriptionElement.textContent =
        currentContent.substring(0, range.startOffset) +
        formattedText +
        currentContent.substring(range.startOffset);
    }

    // Move cursor to the end
    const newRange = document.createRange();
    newRange.selectNodeContents(transcriptionElement);
    newRange.collapse(false); // collapse to end
    selection.removeAllRanges();
    selection.addRange(newRange);
    transcriptionElement.focus();

    statusElement.textContent = 'Transcripción completada';

  } catch (error) {
    console.error('Error en la transcripción:', error);
    transcriptionElement.textContent = `Error: ${error.message}`;
    statusElement.textContent = 'Error en la transcripción';
    statusElement.classList.add('error');
  } finally {
    loadingElement.classList.add('hidden');
    setTimeout(() => {
      statusElement.classList.remove('error');
      statusElement.textContent = 'Listo para grabar';
    }, 3000);
  }
}

// Text Processing Functions
function processText(text) {
  console.log('Original text:', text);

  // Step 1: Remove dots and commas, convert to lowercase
  let processed = text.toLowerCase().replace(/[.,]/g, '');

  // Step 2: Handle "punto y aparte", "punto y seguido", and "punto"
  processed = processed
    // Handle "punto y aparte" first
    .replace(/punto y aparte/gi, '.\n\n')
    // Then handle "punto y seguido" and single "punto"
    .replace(/punto y seguido/gi, '.')
    .replace(/\b(?<!y\s)punto\b/gi, '.');
  console.log('Step 2 - After punto replacements:', processed);

  processed = processed
    // Handle "coma"
    .replace(/\bcoma\b/gi, ',');
  console.log('Step 2c - After coma:', processed);

  // Step 3: Handle line spacing but don't automatically add periods
  processed = processed
    .split(/\n+/)
    .map(line => {
      line = line.trim();
      return line;
    })
    .join('\n\n');  // Add double newline between paragraphs

  // Step 4: Capitalize properly
  processed = processed
    .split(/\n+/)
    .map(paragraph => {
      return paragraph
        .split(/\.\s+/)
        .map(sentence => {
          sentence = sentence.trim();
          if (sentence) {
            return sentence.charAt(0).toUpperCase() + sentence.slice(1);
          }
          return sentence;
        })
        .join('. ');
    })
    .join('\n\n');  // Ensure paragraphs are separated by double newline

  // Step 5: Add proper spacing after punctuation
  processed = processed
    .replace(/,(\S)/g, ', $1')
    .replace(/\.(\S)/g, '. $1');

  // Step 6: Remove duplicate punctuation
  processed = processed
    .replace(/\.+/g, '.')
    .replace(/,+/g, ',');

  // Step 7: Final cleanup and apply corrections
  processed = processed
    .split(/\n+/)
    .map(paragraph => {
      paragraph = paragraph.replace(/\s+([.,])/g, '$1');
      paragraph = paragraph.replace(/([.,])(\S)/g, '$1 $2');
      paragraph = paragraph.charAt(0).toUpperCase() + paragraph.slice(1);
      return paragraph.trim();
    })
    .join('\n')  // Double newline between paragraphs
    .replace(/\n\s*\n\s*\n+/g, '\n\n'); // Remove excessive newlines

  // Apply corrections if available
  if (corrections.size > 0) {
    corrections.forEach((correction, original) => {
      const regex = new RegExp(original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      processed = processed.replace(regex, correction);
    });
  }

  return processed;
}

function getSmartFormattedText(existingText, newText, position) {
  // Remove any trailing periods from the new text
  newText = newText.trim().replace(/\.$/, '');

  // Determine if we should capitalize based on context
  const shouldCapitalize = position === 0 ||
    (position > 0 && existingText.charAt(position - 1) === '.');

  // Add space if needed (not at start and previous char isn't space, period or newline)
  const needsSpace = position > 0 &&
    ![' ', '.', '\n'].includes(existingText.charAt(position - 1));

  let formattedText = newText.trim();
  if (shouldCapitalize) {
    formattedText = formattedText.charAt(0).toUpperCase() + formattedText.slice(1);
  } else {
    formattedText = formattedText.charAt(0).toLowerCase() + formattedText.slice(1);
  }

  if (needsSpace) {
    formattedText = ' ' + formattedText;
  }

  return formattedText;
}

// Audio Recording Functions
async function initializeRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
      await transcribeAudio(audioBlob);
    };

    toggleButton.disabled = false;
    statusElement.textContent = 'Listo para grabar';
  } catch (error) {
    console.error('Error al acceder al micrófono:', error);
    statusElement.textContent = 'Error: No se pudo acceder al micrófono';
    statusElement.classList.add('error');
    toggleButton.disabled = true;
  }
}

function toggleRecording() {
  if (!mediaRecorder) {
    console.error('MediaRecorder no está inicializado');
    showSuccessMessage('Error: El micrófono no está disponible', { type: 'error' });
    return;
  }

  if (!isRecording) {
    startRecording();
  } else {
    stopRecording();
  }
}

function startRecording() {
  if (!mediaRecorder || mediaRecorder.state === 'recording') {
    console.error('MediaRecorder no está listo o ya está grabando');
    return;
  }

  try {
    audioChunks = [];
    mediaRecorder.start();
    isRecording = true;
    toggleButton.classList.add('recording');
    toggleButton.innerHTML = `
      <svg class="stop-icon" viewBox="0 0 24 24">
        <rect x="6" y="6" width="12" height="12"/>
      </svg>
      Detener Grabación
    `;
    statusElement.textContent = 'Grabando...';

    startTime = Date.now();
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
  } catch (error) {
    console.error('Error al iniciar la grabación:', error);
    showSuccessMessage('Error al iniciar la grabación', { type: 'error' });
  }
}

function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state !== 'recording') {
    console.error('MediaRecorder no está grabando');
    return;
  }

  try {
    mediaRecorder.stop();
    isRecording = false;
    toggleButton.classList.remove('recording');
    toggleButton.innerHTML = `
      <svg class="mic-icon" viewBox="0 0 24 24">
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
      </svg>
      Iniciar Grabación
    `;
    statusElement.textContent = 'Grabación detenida';

    clearInterval(timerInterval);
  } catch (error) {
    console.error('Error al detener la grabación:', error);
    showSuccessMessage('Error al detener la grabación', { type: 'error' });
  }
}

function updateTimer() {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const seconds = (elapsed % 60).toString().padStart(2, '0');
  timerElement.textContent = `${minutes}:${seconds}`;
}

// Utility Functions
function showSuccessMessage(message, options = {}) {
  const container = document.querySelector('.container');
  const { type = 'success' } = options;

  const successMessage = document.createElement('div');
  successMessage.className = `status-message ${type}`;
  successMessage.textContent = message;
  container.appendChild(successMessage);

  setTimeout(() => {
    successMessage.classList.add('show');
  }, 100);

  setTimeout(() => {
    successMessage.classList.remove('show');
    setTimeout(() => successMessage.remove(), 300);
  }, 3000);
}

// Cleanup Function
function cleanup() {
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
  }

  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
}

// Theme Management
function initializeTheme() {
  const themeToggle = document.getElementById('themeToggle');
  const themeLabel = document.getElementById('themeLabel');

  // Check for saved theme preference or system preference
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  // Set initial theme
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeToggle.checked = true;
    themeLabel.textContent = '☀️';
  }

  // Theme toggle handler
  themeToggle.addEventListener('change', (e) => {
    if (e.target.checked) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
      themeLabel.textContent = '☀️';
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
      themeLabel.textContent = '🌙';
    }
  });
}

// Keyboard Shortcuts
document.addEventListener('keydown', function (event) {
  if (event.shiftKey && event.metaKey && event.key === 'Shift') {
   
