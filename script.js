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
let recordingStartTime;
let timerInterval;
let isRecording = false;
let corrections = new Map();
let chunkDuration = 45000; // 45 seconds in milliseconds
let chunkInterval;
let allTranscriptions = []; // Array to store all chunk transcriptions

// DOM elements
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

// Updated Side Buttons Event Listener
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize all DOM element references
  transcriptionElement = document.getElementById('transcription');
  toggleButton = document.getElementById('toggleRecord');
  statusElement = document.getElementById('recordingStatus');
  timerElement = document.getElementById('timer');
  loadingElement = document.getElementById('loading');
  copyButton = document.getElementById('copyText');
  correctTextButton = document.getElementById('correctText');
  correctionModal = document.getElementById('correctionModal');
  selectedTextElement = document.getElementById('selectedText');
  correctionTextArea = document.getElementById('correctionText');
  saveCorrectionBtn = document.getElementById('saveCorrectionBtn');
  cancelCorrectionBtn = document.getElementById('cancelCorrectionBtn');
  improveWithAIButton = document.getElementById('improveWithAI');
  comparisonModal = document.getElementById('comparisonModal');
  textComparisonDiv = document.getElementById('textComparison');
  acceptAllChangesButton = document.getElementById('acceptAllChanges');
  cancelChangesButton = document.getElementById('cancelChanges');

  // Set up side button event listeners
  document.querySelectorAll('.side-button').forEach(button => {
    button.addEventListener('click', () => {
      const textToInsert = button.getAttribute('data-text');
      
      // Remove active state from all buttons
      document.querySelectorAll('.side-button').forEach(btn => {
        btn.classList.remove('active');
      });
      
      // Mark current button as active
      button.classList.add('active');
      
      // Get current transcription content
      const currentText = transcriptionElement.textContent;

      // If there is existing text, try to replace the template at start only
      if (currentText) {
        // Match any of the templates at the start of the text
        const templateRegex = /^(Se realiza exploración[^.]+(\.|\n))/;
        const match = currentText.match(templateRegex);
        
        if (match) {
          // Replace only the matched template at start
          transcriptionElement.textContent = currentText.replace(match[0], textToInsert);
        } else {
          // No template found at start, insert new text at beginning
          transcriptionElement.textContent = textToInsert + '\n\n' + currentText;
        }
      } else {
        // Empty transcription, just insert the new text
        transcriptionElement.textContent = textToInsert;
      }
    });
  });

  // Initialize other event listeners
  if (toggleButton) toggleButton.addEventListener('click', toggleRecording);
  
  if (copyButton) {
    copyButton.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(transcriptionElement?.textContent || '');
        showSuccessMessage('Texto copiado al portapapeles');
      } catch (err) {
        console.error('Error al copiar:', err);
      }
    });
  }

  if (correctTextButton) correctTextButton.addEventListener('click', showCorrectionModal);
  if (cancelCorrectionBtn) cancelCorrectionBtn.addEventListener('click', hideCorrectionModal);
  if (saveCorrectionBtn) saveCorrectionBtn.addEventListener('click', handleSaveCorrection);
  if (improveWithAIButton) improveWithAIButton.addEventListener('click', improveWithAI);
  
  if (acceptAllChangesButton && transcriptionElement && comparisonModal) {
    acceptAllChangesButton.addEventListener('click', () => {
      // Get the stored improved text instead of trying to parse the diff
      const improvedText = textComparisonDiv.getAttribute('data-improved-text');
      if (improvedText) {
        transcriptionElement.textContent = improvedText;
        comparisonModal.classList.add('hidden');
        showSuccessMessage('Cambios aplicados correctamente');
      }
    });
  }

  if (cancelChangesButton && comparisonModal) {
    cancelChangesButton.addEventListener('click', () => {
      comparisonModal.classList.add('hidden');
    });
  }

  // Initialize application
  initializeTheme();
  
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
  
  if (transcriptionElement) {
    transcriptionElement.style.whiteSpace = 'pre-wrap';
    transcriptionElement.style.wordBreak = 'break-word';
  }
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
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      // This will be triggered both for chunks and when stopping the recording
      console.log('MediaRecorder stopped');
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
    // Reset for new recording
    audioChunks = [];
    allTranscriptions = [];
    recordingStartTime = Date.now();
    
    // Start recording
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
    
    // Set up chunk interval - create a new chunk every 45 seconds
    chunkInterval = setInterval(() => {
      if (isRecording && mediaRecorder.state === 'recording') {
        console.log('Creating new chunk after 45 seconds');
        
        // Stop the current recording to create a chunk
        mediaRecorder.stop();
        
        // Process the chunk we just created
        const currentChunks = [...audioChunks];
        processAudioChunk(currentChunks);
        
        // Clear the chunks array for the next segment
        audioChunks = [];
        
        // Start a new recording segment after a small delay
        setTimeout(() => {
          if (isRecording) {
            mediaRecorder.start();
            console.log('Started recording new chunk');
          }
        }, 100);
      }
    }, chunkDuration);
    
  } catch (error) {
    console.error('Error al iniciar la grabación:', error);
    showSuccessMessage('Error al iniciar la grabación', {type: 'error'});
  }
}

function stopRecording() {
  if (!mediaRecorder) {
    console.error('MediaRecorder no está inicializado');
    return;
  }

  try {
    // Stop the chunk interval
    clearInterval(chunkInterval);
    
    // Clear the timer interval
    clearInterval(timerInterval);
    
    // Only stop the mediaRecorder if it's recording
    if (mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      
      // Process the final chunk after a small delay
      setTimeout(() => {
        if (audioChunks.length > 0) {
          processAudioChunk(audioChunks, true);
        } else {
          // If no chunks to process, just update UI
          finalizeRecording();
        }
      }, 200);
    } else {
      // If already stopped (due to chunking), just process any remaining chunks
      if (audioChunks.length > 0) {
        processAudioChunk(audioChunks, true);
      } else {
        finalizeRecording();
      }
    }
    
    isRecording = false;
    toggleButton.classList.remove('recording');
    toggleButton.innerHTML = `
      <svg class="mic-icon" viewBox="0 0 24 24">
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
      </svg>
      Iniciar Grabación
    `;
    statusElement.textContent = 'Procesando grabación...';
    
  } catch (error) {
    console.error('Error al detener la grabación:', error);
    showSuccessMessage('Error al detener la grabación', {type: 'error'});
  }
}

async function processAudioChunk(chunks, isFinal = false) {
  // Skip if no chunks
  if (!chunks || chunks.length === 0) {
    console.log('No audio chunks to process');
    return;
  }
  
  try {
    console.log(`Processing audio chunk (isFinal: ${isFinal})`);
    
    // Create a blob from the audio chunks
    const audioBlob = new Blob(chunks, { type: 'audio/wav' });
    
    // Show loading indication only for final chunk to avoid flicker
    if (isFinal) {
      loadingElement.classList.remove('hidden');
    }
    
    // Transcribe this chunk
    const transcriptionText = await transcribeAudio(audioBlob);
    
    if (transcriptionText) {
      // Add this transcription to our collection
      allTranscriptions.push(transcriptionText);
      
      // If this is the final chunk, combine all transcriptions and update the UI
      if (isFinal) {
        finalizeRecording();
      }
    }
  } catch (error) {
    console.error('Error processing audio chunk:', error);
    if (isFinal) {
      showSuccessMessage('Error al procesar el audio', {type: 'error'});
      finalizeRecording();
    }
  }
}

function finalizeRecording() {
  // Combine all transcriptions
  if (allTranscriptions.length > 0) {
    const combinedText = allTranscriptions.join(' ');
    updateTranscriptionText(combinedText);
  }
  
  // Reset state
  audioChunks = [];
  allTranscriptions = [];
  
  // Update UI
  loadingElement.classList.add('hidden');
  statusElement.textContent = 'Listo para grabar';
}

function updateTimer() {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const seconds = (elapsed % 60).toString().padStart(2, '0');
  timerElement.textContent = `${minutes}:${seconds}`;
}

// Text Processing Functions
async function transcribeAudio(audioBlob) {
  console.log(`Transcribing audio chunk of size: ${audioBlob.size} bytes`);
  
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
    
    const rawText = result.text || '';
    console.log('Raw text from API:', rawText);
    
    if (!rawText || rawText.trim() === '') {
      console.log('No text detected in this audio chunk');
      return '';
    }
    
    // Process the text and apply corrections
    const processedText = processText(rawText);
    console.log('Processed text from chunk:', processedText);
    
    return processedText;
    
  } catch (error) {
    console.error('Error en la transcripción:', error);
    statusElement.textContent = 'Error en la transcripción';
    statusElement.classList.add('error');
    return '';
  }
}

function updateTranscriptionText(processedText) {
  if (!processedText || processedText.trim() === '') return;
  
  // Get current selection or cursor position info
  const selection = window.getSelection();
  const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  
  // Only consider selection if it's within our transcription element
  const isSelectionInTranscription = range && transcriptionElement.contains(range.commonAncestorContainer);
  const isAtEnd = isSelectionInTranscription && 
    range.startContainer === transcriptionElement && 
    range.startOffset === transcriptionElement.childNodes.length;

  if (isAtEnd || !isSelectionInTranscription) {
    // Cursor at end or no valid selection - always append
    const currentContent = transcriptionElement.textContent;
    transcriptionElement.textContent = currentContent + 
      (currentContent ? ' ' : '') + processedText.trim();
  } else if (selection.toString().length > 0) {
    // Text is selected - replace selection with smart formatting
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
    // Cursor is positioned - insert at cursor with smart formatting
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
}

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
  const originalText = transcriptionElement?.textContent?.trim();
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
        content: "Eres un experto asistente de transcripción de textos médicos. Este es un texto de dictado bruto de tipo médico, en concreto un informe radiológico. Los signos de puntuación están incluidos en el dictado, no añadas ningun otro y capitaliza el texto correctamente, respetando los saltos de linea tal y como estan. Ten en cuenta que la expresion punto o punto y seguido no implicaran poner un salto de linea, pero si lo haras si se usa la expresión punto y aparte. Además haras una interpretación del texto pudiendo cambiar palabras si crees que el dictado bruto queria decir otra cosa. Por ultimo quiero que me devuelvas la transcripción corregida como tal, sin otros comentarios adicionales tuyos"
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
  // Create arrays of words
  const originalWords = original.split(/(\s+)/);
  const improvedWords = improved.split(/(\s+)/);
  
  // Initialize variables for the diff
  let diffHtml = '';
  let i = 0;
  let j = 0;
  
  while (i < originalWords.length || j < improvedWords.length) {
    if (i >= originalWords.length) {
      // All remaining words in improved are additions
      while (j < improvedWords.length) {
        diffHtml += `<span class="diff-added">${improvedWords[j]}</span>`;
        j++;
      }
      break;
    }
    
    if (j >= improvedWords.length) {
      // All remaining words in original are removals
      while (i < originalWords.length) {
        diffHtml += `<span class="diff-removed">${originalWords[i]}</span>`;
        i++;
      }
      break;
    }
    
    if (originalWords[i] === improvedWords[j]) {
      // Words match, keep as is
      diffHtml += originalWords[i];
      i++;
      j++;
    } else {
      // Words differ, try to find next match
      let found = false;
      
      // Look ahead in improved text
      for (let k = j + 1; k < improvedWords.length && k < j + 3; k++) {
        if (originalWords[i] === improvedWords[k]) {
          // Found match, mark intermediate words as added
          while (j < k) {
            diffHtml += `<span class="diff-added">${improvedWords[j]}</span>`;
            j++;
          }
          found = true;
          break;
        }
      }
      
      if (!found) {
        // Look ahead in original text
        for (let k = i + 1; k < originalWords.length && k < i + 3; k++) {
          if (originalWords[k] === improvedWords[j]) {
            // Found match, mark intermediate words as removed
            while (i < k) {
              diffHtml += `<span class="diff-removed">${originalWords[i]}</span>`;
              i++;
            }
            found = true;
            break;
          }
        }
      }
      
      if (!found) {
        // No match found within window, mark current words as removed/added
        diffHtml += `<span class="diff-removed">${originalWords[i]}</span>`;
        diffHtml += `<span class="diff-added">${improvedWords[j]}</span>`;
        i++;
        j++;
      }
    }
  }
  
  // Store the improved text in a data attribute for later use
  textComparisonDiv.setAttribute('data-improved-text', improved);
  
  textComparisonDiv.innerHTML = `
    <div class="text-diff">
      ${diffHtml}
    </div>
  `;

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
document.addEventListener('keydown', function(event) {
  if (event.shiftKey && event.metaKey && event.key === 'Shift') {
    event.preventDefault();
    toggleButton.click();
  }
});

// Cleanup on page unload
window.addEventListener('unload', cleanup);
