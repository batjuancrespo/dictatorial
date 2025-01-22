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

// Initialize Firebase with connection monitoring
let firestoreConnection = null;
let db = null;
let corrections = new Map();

async function initializeFirebase() {
  try {
    const app = firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();

    // Configure Firestore before performing any operations
    db.settings({
      ignoreUndefinedProperties: true,
      merge: true
    });

    // Enable offline persistence with merge option
    await db.enablePersistence({
      merge: true
    }).catch(err => {
      console.warn('Offline persistence disabled:', err.code);
    });

    // Enable network and set up listeners
    db.enableNetwork();

    db.onSnapshotsInSync(() => {
      firestoreConnection = true;
      console.log('Firestore connection successful');
      showSuccessMessage('Conectado a Firestore');
    });

    return db;

  } catch (error) {
    console.error('Firebase initialization error:', error);
    runInOfflineMode();
    return null;
  }
}

function runInOfflineMode() {
  firestoreConnection = false;
  console.log('Running in offline mode');
  showSuccessMessage('Modo offline activado', { type: 'warning' });
}

// Load corrections from Firestore or local storage
async function loadCorrectionsFromDatabase(db) {
  try {
    if (!firestoreConnection) {
      console.log('Firestore not connected, checking local storage...');
      const localCorrections = localStorage.getItem('corrections');
      if (localCorrections) {
        corrections = new Map(JSON.parse(localCorrections));
        console.log('Corrections loaded from local storage', corrections);
        return;
      }
      throw new Error('No internet connection and no local data');
    }

    const snapshot = await db.collection('corrections').get();
    corrections.clear();
    snapshot.forEach(doc => {
      corrections.set(doc.data().original, doc.data().correction);
    });

    // Save to local storage as backup
    localStorage.setItem('corrections', JSON.stringify([...corrections]));
    console.log('Corrections loaded from Firestore:', corrections);

  } catch (error) {
    console.error('Error loading corrections:', error);
    showSuccessMessage('Error cargando correcciones. Usando modo offline.');
  }
}

// Save a correction to Firestore or locally
async function saveCorrection(db, original, correction) {
  try {
    if (!firestoreConnection) {
      throw new Error('No internet connection');
    }

    await db.collection('corrections').add({
      original,
      correction,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    corrections.set(original, correction);
    localStorage.setItem('corrections', JSON.stringify([...corrections]));
    console.log('Correction saved to Firestore');
    return true;

  } catch (error) {
    console.error('Error saving correction:', error);
    corrections.set(original, correction);
    localStorage.setItem('corrections', JSON.stringify([...corrections]));
    showSuccessMessage('Corrección guardada localmente. Se sincronizará cuando haya conexión.', { type: 'warning' });
    return false;
  }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
  try {
    db = await initializeFirebase();
    await initializeRecording(); // Wait for recording initialization

    if (db) {
      await loadCorrectionsFromDatabase(db).then(() => {
        console.log('Corrections loaded successfully');
      });
    } else {
      console.log('Using offline mode');
      await loadCorrectionsFromDatabase();
    }
  } catch (error) {
    console.error('Error during initialization:', error);
    showSuccessMessage('Error durante la inicialización', { type: 'error' });
  }
});

// API configuration
const API_URL = 'https://api-inference.huggingface.co/models/openai/whisper-large-v3-turbo';
const API_KEY = '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';

// AI Improvement Configuration
const AI_API_KEY = 'uFJi9MKJxz6ENwWkQcSFXNykjoeYyT3G';
const AI_AGENT_ID = 'ag:973cb1c2:20241203:asistente-radiologico:5542a3d9';

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

let mediaRecorder;
let audioChunks = [];
let startTime;
let timerInterval;
let isRecording = false;



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

function processText(text) {
  console.log('Original text:', text);

  // Step 1: Remove dots and commas, convert to lowercase
  let processed = text.toLowerCase().replace(/[.,]/g, '');
  console.log('Step 1 - Lowercase and remove punctuation:', processed);

  // Step 2: Handle "punto y aparte", "punto", and "coma"
  processed = processed
    // Handle "punto y aparte" first
    .replace(/punto y aparte/gi, '.\n');
  console.log('Step 2a - After punto y aparte:', processed);
    
  processed = processed
    // Then handle single "punto"
    .replace(/\b(?<!y\s)punto\b/gi, '.');
  console.log('Step 2b - After punto:', processed);
    
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
  console.log('Step 3 - After line endings and comma spacing:', processed);

  // Step 4: Capitalize properly
  processed = processed
    .split('\n')
    .map(paragraph => {
      return paragraph
        .split('. ')
        .map(sentence => {
          sentence = sentence.trim();
          if (sentence) {
            console.log('Capitalizing sentence:', sentence);
            let capitalized = sentence.charAt(0).toUpperCase() + sentence.slice(1);
            console.log('After capitalization:', capitalized);
            return capitalized;
          }
          return sentence;
        })
        .join('. ');
    })
    .join('\n');
  console.log('Step 4 - After capitalization:', processed);

  // Step 5: Add proper spacing after punctuation
  processed = processed
    .replace(/,(\S)/g, ', $1')
    .replace(/\.(\S)/g, '. $1');
  console.log('Step 5 - After punctuation spacing:', processed);

  // Step 6: Remove duplicate punctuation
  processed = processed
    .replace(/\.+/g, '.')
    .replace(/,+/g, ',');
  console.log('Step 6 - After removing duplicate punctuation:', processed);

  // Step 7: Final cleanup
  processed = processed
    .split('\n')
    .map(paragraph => {
      console.log('Cleaning up paragraph:', paragraph);
      paragraph = paragraph.replace(/\s+([.,])/g, '$1');
      paragraph = paragraph.replace(/([.,])(\S)/g, '$1 $2');
      paragraph = paragraph.charAt(0).toUpperCase() + paragraph.slice(1);
      paragraph = paragraph.trim();
      console.log('After cleanup:', paragraph);
      return paragraph;
    })
    .join('\n')
    .replace(/\n\s*\n/g, '\n');

  console.log('Before applying corrections:', processed);
  processed = applyCorrections(processed);
  console.log('After applying corrections:', processed);

  return processed;
}

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
    toggleButton.disabled = true; // Disable button if mic access fails
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
      // Replace selected text
      const currentContent = transcriptionElement.textContent;
      const beforeSelection = currentContent.substring(0, selectionInfo.range.startOffset);
      const afterSelection = currentContent.substring(selectionInfo.range.endOffset);
      finalText = beforeSelection + processedText + afterSelection;
    } else {
      // Append text
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

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(transcriptionElement.textContent);
    showSuccessMessage('Texto copiado al portapapeles');
  } catch (err) {
    console.error('Error al copiar:', err);
  }
}


// Modify the saveCorrection function to handle offline mode
async function saveCorrection(db, original, correction) {
  try {
    if (!firestoreConnection) {
      throw new Error('No internet connection');
    }

    await db.collection('corrections').add({
      original,
      correction,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    corrections.set(original, correction);
    localStorage.setItem('corrections', JSON.stringify([...corrections]));
    console.log('Correction saved to Firestore');
    return true;

  } catch (error) {
    console.error('Error saving correction:', error);
    corrections.set(original, correction);
    localStorage.setItem('corrections', JSON.stringify([...corrections]));
    showSuccessMessage('Corrección guardada localmente. Se sincronizará cuando haya conexión.', {type: 'warning'});
    return false;
  }
}

// Apply corrections to text
function applyCorrections(text) {
  console.log('Applying corrections to text:', text);
  console.log('Current corrections map:', corrections);
  
  let correctedText = text;
  corrections.forEach((correction, original) => {
    // Create a case-insensitive global regex
    const regex = new RegExp(original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const before = correctedText;
    correctedText = correctedText.replace(regex, correction);
    if (before !== correctedText) {
      console.log(`Applied correction: "${original}" -> "${correction}"`);
      console.log('Text after this correction:', correctedText);
    }
  });
  
  console.log('Text after applying all corrections:', correctedText);
  return correctedText;
}

// Show correction modal
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

// Hide correction modal
function hideCorrectionModal() {
  correctionModal.classList.add('hidden');
  selectedTextElement.textContent = '';
  correctionTextArea.value = '';
}

// Event listeners for correction functionality
correctTextButton.addEventListener('click', showCorrectionModal);
cancelCorrectionBtn.addEventListener('click', hideCorrectionModal);

saveCorrectionBtn.addEventListener('click', async () => {
  const originalText = selectedTextElement.textContent;
  const correctionText = correctionTextArea.value.trim();

  if (originalText === correctionText) {
    alert('La corrección es igual al texto original');
    return;
  }

  const success = await saveCorrection(originalText, correctionText);
  if (success) {
    // Apply the correction to the current text
    const currentText = transcriptionElement.textContent;
    transcriptionElement.textContent = currentText.replace(originalText, correctionText);
    hideCorrectionModal();
    showSuccessMessage('Corrección guardada');
  } else {
    alert('Error al guardar la corrección');
  }
});

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
      max_tokens: 150,
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
  // Clear previous content
  textComparisonDiv.innerHTML = '';

  // Create two text areas side by side
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

  // Show modal
  comparisonModal.classList.remove('hidden');
}

function applyChanges() {
  const improvedText = document.querySelector('.improved-text').value;
  transcriptionElement.textContent = improvedText;
  comparisonModal.classList.add('hidden');
  showSuccessMessage('Cambios aplicados correctamente');
}

function cancelAIChanges() {
  comparisonModal.classList.add('hidden');
}

// Update the showSuccessMessage function to handle different message types
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

// Event Listeners
toggleButton.addEventListener('click', toggleRecording);
copyButton.addEventListener('click', copyToClipboard);
improveWithAIButton.addEventListener('click', improveWithAI);
acceptAllChangesButton.addEventListener('click', applyChanges);
cancelChangesButton.addEventListener('click', cancelAIChanges);

document.addEventListener('keydown', function(event) {
  if (event.shiftKey && event.metaKey && event.key === 'Shift') {
    event.preventDefault();
    toggleButton.click();
  }
});

// Update the DOMContentLoaded event listener to properly sequence initialization
document.addEventListener('DOMContentLoaded', async () => {
  try {
    db = await initializeFirebase();
    await initializeRecording(); // Wait for recording initialization
    
    if (db) {
      await loadCorrections(db).then(() => {
        console.log('Corrections loaded successfully');
      });
    } else {
      console.log('Using offline mode');
      await loadCorrections();
    }
  } catch (error) {
    console.error('Error during initialization:', error);
    showSuccessMessage('Error durante la inicialización', {type: 'error'});
  }
});
