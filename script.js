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

// DOM Elements
const toggleButton = document.getElementById('toggleRecord');
const statusElement = document.getElementById('recordingStatus');
const timerElement = document.getElementById('timer');
const transcriptionElement = document.getElementById('transcription');
const loadingElement = document.getElementById('loading');
const copyButton = document.getElementById('copyText');
const saveCorrectionsButton = document.getElementById('saveCorrections');
const correctTextButton = document.getElementById('correctText');
const correctionModal = document.getElementById('correctionModal');
const selectedTextElement = document.getElementById('selectedText');
const correctionTextArea = document.getElementById('correctionText');
const saveCorrectionBtn = document.getElementById('saveCorrectionBtn');
const cancelCorrectionBtn = document.getElementById('cancelCorrectionBtn');
const improveWithAIButton = document.getElementById('improveWithAI');
const comparisonModal = document.getElementById('comparisonModal');
const textComparisonDiv = document.getElementById('textComparison');
const acceptAllChangesButton = document.getElementById('acceptAllChanges');
const cancelChangesButton = document.getElementById('cancelChanges');

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

// Updated Side Buttons Event Listener
document.querySelectorAll('.side-button').forEach(button => {
  button.addEventListener('click', () => {
    const textToInsert = button.getAttribute('data-text');
    
    // Remove active state from all buttons
    document.querySelectorAll('.side-button').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // Mark current button as active
    button.classList.add('active');
    
    // Set the text at the beginning of the transcription
    transcriptionElement.textContent = textToInsert + '\n\n';
  });
});


// Corrections management
async function loadCorrections() {
  console.log('Loading corrections...');
  try {
    if (!db) {
      console.log('No database connection available');
      return;
    }

    // Clean up existing snapshot listener if any
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
    }

    // Set up a single snapshot listener for corrections
    unsubscribeSnapshot = db.collection('corrections')
      .onSnapshot((snapshot) => {
        corrections.clear();
        snapshot.forEach(doc => {
          const correction = doc.data();
          corrections.set(correction.original, correction.correction);
        });
        console.log('Corrections updated:', Array.from(corrections.entries()));
      }, (error) => {
        console.error('Error in corrections snapshot:', error);
      });

  } catch (error) {
    console.error('Error loading corrections:', error);
    corrections = new Map();
    showSuccessMessage('Error cargando correcciones', {type: 'error'});
  }
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
    showSuccessMessage('Error: El micrófono no está disponible', {type: 'error'});
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
    showSuccessMessage('Error al iniciar la grabación', {type: 'error'});
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
    showSuccessMessage('Error al detener la grabación', {type: 'error'});
  }
}

function updateTimer() {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const seconds = (elapsed % 60).toString().padStart(2, '0');
  timerElement.textContent = `${minutes}:${seconds}`;
}

async function transcribeAudio(audioBlob) {
  loadingElement.classList.remove('hidden');
  statusElement.textContent = 'Transcribiendo audio...';
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'audio/wav'
      },
      body: audioBlob
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error en la transcripción: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    
    if (result.error) {
      throw new Error(`Error API: ${result.error}`);
    }
    
    const rawText = result.text || 'No se detectó texto en el audio';
    console.log('Raw text from API:', rawText);
    
    // Process the text and apply corrections
    const processedText = processText(rawText);
    console.log('Final processed and corrected text:', processedText);
    
    // Handle text replacement or append
    const selectionInfo = getSelectionInfo();
    let finalText;
    
    if (selectionInfo) {
      const currentContent = transcriptionElement.textContent;
      const beforeSelection = currentContent.substring(0, selectionInfo.range.startOffset);
      const afterSelection = currentContent.substring(selectionInfo.range.endOffset);
      finalText = beforeSelection + processedText + afterSelection;
    } else {
      const currentContent = transcriptionElement.textContent;
      const separator = currentContent && !currentContent.endsWith('\n') ? '\n' : '';
      finalText = currentContent + separator + processedText;
    }
    
    transcriptionElement.textContent = finalText;
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

function getSelectionInfo() {
  const selection = window.getSelection();
  const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  
  if (range && transcriptionElement.contains(range.commonAncestorContainer)) {
    return {
      text: selection.toString(),
      range: range
    };
  }
  return null;
}


// Text Processing Functions
function processText(text) {
  console.log('Original text:', text);

  // Step 1: Remove dots and commas, convert to lowercase
  let processed = text.toLowerCase().replace(/[.,]/g, '');
  
  // Step 2: Handle "punto y aparte", "punto y seguido", and "punto"
  processed = processed
    // Handle "punto y aparte" first
    .replace(/punto y aparte/gi, '.\n');
  console.log('Step 2a - After punto y aparte:', processed);
    
  processed = processed
    // Then handle "punto y seguido" and single "punto"
    .replace(/punto y seguido/gi, '.')
    .replace(/\b(?<!y\s)punto\b/gi, '.');
  console.log('Step 2b - After punto y seguido and punto:', processed);
    
  processed = processed
    // Handle "coma"
    .replace(/\bcoma\b/gi, ',');
  console.log('Step 2c - After coma:', processed);

  // Step 3: Add period at end of lines and fix comma spacing
  processed = processed
    .split('\n')
    .map(line => {
      line = line.trim();
      if (!line.endsWith('.')) {
        line += '.';
      }
      line = line.replace(/\s*,\s*/g, ',');
      return line;
    })
    .join('\n');

  // Step 4: Capitalize properly
  processed = processed
    .split('\n')
    .map(paragraph => {
      return paragraph
        .split('. ')
        .map(sentence => {
          sentence = sentence.trim();
          if (sentence) {
            return sentence.charAt(0).toUpperCase() + sentence.slice(1);
          }
          return sentence;
        })
        .join('. ');
    })
    .join('\n');

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
    .split('\n')
    .map(paragraph => {
      paragraph = paragraph.replace(/\s+([.,])/g, '$1');
      paragraph = paragraph.replace(/([.,])(\S)/g, '$1 $2');
      paragraph = paragraph.charAt(0).toUpperCase() + paragraph.slice(1);
      return paragraph.trim();
    })
    .join('\n')
    .replace(/\n\s*\n/g, '\n');

  // Apply corrections if available
  if (corrections.size > 0) {
    corrections.forEach((correction, original) => {
      const regex = new RegExp(original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      processed = processed.replace(regex, correction);
    });
  }
  
  return processed;
}

// Correction Functions
async function saveCorrection(original, correction) {
  try {
    if (!db || !firestoreConnection) {
      console.error('No database connection available');
      showSuccessMessage('Error: No hay conexión a la base de datos', {type: 'error'});
      return false;
    }

    await db.collection('corrections').add({
      original,
      correction,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    corrections.set(original, correction);
    console.log('Correction saved to Firestore');
    return true;

  } catch (error) {
    console.error('Error saving correction:', error);
    showSuccessMessage('Error al guardar la corrección', {type: 'error'});
    return false;
  }
}

function showCorrectionModal() {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  if (!selectedText) {
    alert('Por favor, selecciona el texto que deseas corregir');
    return;
  }

  selectedTextElement.textContent = selectedText;
  correctionTextArea.value = selectedText;
  correctionModal.classList.remove('hidden');
}

function hideCorrectionModal() {
  correctionModal.classList.add('hidden');
  selectedTextElement.textContent = '';
  correctionTextArea.value = '';
}

async function handleSaveCorrection() {
  const originalText = selectedTextElement.textContent;
  const correctionText = correctionTextArea.value.trim();

  if (originalText === correctionText) {
    alert('La corrección es igual al texto original');
    return;
  }

  const success = await saveCorrection(originalText, correctionText);
  if (success) {
    const currentText = transcriptionElement.textContent;
    transcriptionElement.textContent = currentText.replace(originalText, correctionText);
    hideCorrectionModal();
    showSuccessMessage('Corrección guardada');
  }
}


// AI Improvement Functions
async function improveWithAI() {
  const originalText = transcriptionElement.textContent.trim();
  if (!originalText) {
    showSuccessMessage('No hay texto para mejorar');
    return;
  }

  loadingElement.classList.remove('hidden');
  statusElement.textContent = 'Mejorando texto con IA...';

  try {
    const requestBody = {
      max_tokens: 3000,
      stream: false,
      messages: [{
        role: "system",
        content: "Eres un experto asistente de transcripción de textos médicos. Este es un texto de dictado bruto de tipo médico, en concreto un informe radiológico. Los signos de puntuación están incluidos en el dictado, no añadas ningun otro y capitaliza el texto correctamente. Ten en cuenta que la expresion punto o punto y seguido no implicaran poner un salto de linea, pero si lo haras si se usa la expresión puno y aparte. Además harasuna interpretación del texto pudiendo cambiar palabras si crees que el dictado bruto queria decir otra cosa. Por ultimo quiero que me devuelvas la transcripción corregida como tal, sin otros comentarios adicionales tuyos"
      }, {
        role: "user",
        content: originalText
      }],
      response_format: {
        type: "text"
      },
      agent_id: AI_AGENT_ID
    };

    const response = await fetch('https://api.mistral.ai/v1/agents/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Error API: ${response.status}`);
    }

    const data = await response.json();
    if (data.choices && data.choices[0] && data.choices[0].message) {
      const improvedText = data.choices[0].message.content;
      showImprovedText(originalText, improvedText);
    } else {
      throw new Error('Formato de respuesta inválido');
    }
  } catch (error) {
    console.error('Error al mejorar el texto:', error);
    showSuccessMessage('Error al procesar el texto con IA');
  } finally {
    loadingElement.classList.add('hidden');
    statusElement.textContent = 'Listo para grabar';
  }
}

function showImprovedText(original, improved) {
  textComparisonDiv.innerHTML = '';

  const container = document.createElement('div');
  container.className = 'improved-text-container';

  const originalTextArea = document.createElement('textarea');
  originalTextArea.className = 'text-diff original-text';
  originalTextArea.value = original;
  originalTextArea.readOnly = true;

  const improvedTextArea = document.createElement('textarea');
  improvedTextArea.className = 'text-diff improved-text';
  improvedTextArea.value = improved;
  improvedTextArea.readOnly = true;

  container.appendChild(originalTextArea);
  container.appendChild(improvedTextArea);
  textComparisonDiv.appendChild(container);

  comparisonModal.classList.remove('hidden');
}

// Utility Functions
function showSuccessMessage(message, options = {}) {
  const container = document.querySelector('.container');
  const {type = 'success'} = options;
  
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

// Event Listeners
toggleButton.addEventListener('click', toggleRecording);
copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(transcriptionElement.textContent);
    showSuccessMessage('Texto copiado al portapapeles');
  } catch (err) {
    console.error('Error al copiar:', err);
  }
});
correctTextButton.addEventListener('click', showCorrectionModal);
cancelCorrectionBtn.addEventListener('click', hideCorrectionModal);
saveCorrectionBtn.addEventListener('click', handleSaveCorrection);
improveWithAIButton.addEventListener('click', improveWithAI);
acceptAllChangesButton.addEventListener('click', () => {
  const improvedText = document.querySelector('.improved-text').value;
  transcriptionElement.textContent = improvedText;
  comparisonModal.classList.add('hidden');
  showSuccessMessage('Cambios aplicados correctamente');
});
cancelChangesButton.addEventListener('click', () => {
  comparisonModal.classList.add('hidden');
});

// Keyboard Shortcuts
document.addEventListener('keydown', function(event) {
  if (event.shiftKey && event.metaKey && event.key === 'Shift') {
    event.preventDefault();
    toggleButton.click();
  }
});

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('Initializing application...');
    await initializeRecording();
    
    console.log('Initializing Firebase...');
    db = await initializeFirebase();
    
    if (!db) {
      console.error('Failed to initialize Firebase');
      showSuccessMessage('Error durante la inicialización', {type: 'error'});
    }
  } catch (error) {
    console.error('Error during initialization:', error);
    showSuccessMessage('Error durante la inicialización', {type: 'error'});
  }
});

// Cleanup on page unload
window.addEventListener('unload', cleanup);
