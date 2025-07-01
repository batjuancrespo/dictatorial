// --- Variables Globales de la App de Dictado (declaradas una vez) ---
let startRecordBtn, pauseResumeBtn, retryProcessBtn, copyPolishedTextBtn, correctTextSelectionBtn, resetReportBtn,
    undoButton, redoButton, 
    statusDiv, polishedTextarea, audioPlayback, audioPlaybackSection, 
    themeSwitch, volumeMeterBar, volumeMeterContainer, recordingTimeDisplay, 
    headerArea, techniqueButtonsContainer, clearHeaderButton, 
    mainTitleImage, mainTitleImageDark,
    vocabManagerModal, vocabManagerList, modalCloseButtonVocab, modalAddNewRuleButtonVocab, manageVocabButton,
    templatesContainer, manageTemplatesButton, templateManagerModal, templateManagerList,
    modalCloseButtonTemplate, modalAddNewTemplateButton;

let mediaRecorder;
let audioChunks = [];
let currentAudioBlob = null;
let audioContext, analyser, microphoneSource;
let animationFrameId;
let isRecording = false, isPaused = false;
let recordingTimerInterval; 
let recordingSeconds = 0;  
const userApiKey = 'AIzaSyASbB99MVIQ7dt3MzjhidgoHUlMXIeWvGc'; // API Key de Gemini

// --- Variables para el Vocabulario y Plantillas del Usuario ---
let currentUserId = null;      
let customVocabulary = {};      // Corresponderá a rulesMap
let learnedCorrections = {};    // Corresponderá a learnedMap 
let commonMistakeNormalization = {}; // Corresponderá a normalizations
let userTemplates = {}; 

// --- Variables para Debounce, Dictado por Selección/Inserción y Deshacer/Rehacer ---
let isProcessingClick = false; 
const CLICK_DEBOUNCE_MS = 300; 
let isDictatingForReplacement = false;
let replacementSelectionStart = 0;
let replacementSelectionEnd = 0;
let insertionPoint = 0; 
let historyStack = [];
let redoStack = [];
let isUndoingRedoing = false;


document.addEventListener('DOMContentLoaded', () => {
    console.log("DEBUG: DOMContentLoaded event fired.");

    // --- Selección DOM ---
    startRecordBtn = document.getElementById('startRecordBtn');
    pauseResumeBtn = document.getElementById('pauseResumeBtn');
    retryProcessBtn = document.getElementById('retryProcessBtn');
    copyPolishedTextBtn = document.getElementById('copyPolishedTextBtn'); 
    correctTextSelectionBtn = document.getElementById('correctTextSelectionBtn');
    resetReportBtn = document.getElementById('resetReportBtn');
    undoButton = document.getElementById('undoButton');
    redoButton = document.getElementById('redoButton');
    statusDiv = document.getElementById('status');
    polishedTextarea = document.getElementById('polishedText');
    audioPlayback = document.getElementById('audioPlayback');
    audioPlaybackSection = document.querySelector('.audio-playback-section'); 
    themeSwitch = document.getElementById('themeSwitch'); 
    volumeMeterBar = document.getElementById('volumeMeterBar');
    volumeMeterContainer = document.getElementById('volumeMeterContainer'); 
    recordingTimeDisplay = document.getElementById('recordingTimeDisplay'); 
    headerArea = document.getElementById('headerArea'); 
    techniqueButtonsContainer = document.getElementById('techniqueButtons'); 
    clearHeaderButton = document.getElementById('clearHeaderButton'); 
    mainTitleImage = document.getElementById('mainTitleImage'); 
    mainTitleImageDark = document.getElementById('mainTitleImageDark'); 
    manageVocabButton = document.getElementById('manageVocabButton'); 
    vocabManagerModal = document.getElementById('vocabManagerModal');
    vocabManagerList = document.getElementById('vocabManagerList');
    modalCloseButtonVocab = document.getElementById('modalCloseButtonVocab'); 
    modalAddNewRuleButtonVocab = document.getElementById('modalAddNewRuleButtonVocab');
    templatesContainer = document.getElementById('templatesContainer');
    manageTemplatesButton = document.getElementById('manageTemplatesButton');
    templateManagerModal = document.getElementById('templateManagerModal');
    templateManagerList = document.getElementById('templateManagerList');
    modalCloseButtonTemplate = document.getElementById('modalCloseButtonTemplate');
    modalAddNewTemplateButton = document.getElementById('modalAddNewTemplateButton');

    // --- Verificación de Elementos ---
    const elementsMap = { startRecordBtn, pauseResumeBtn, retryProcessBtn, copyPolishedTextBtn, correctTextSelectionBtn, resetReportBtn, undoButton, redoButton, statusDiv, polishedTextarea, audioPlayback, audioPlaybackSection, themeSwitch, volumeMeterBar, volumeMeterContainer, recordingTimeDisplay, headerArea, techniqueButtonsContainer, clearHeaderButton, mainTitleImage, mainTitleImageDark, manageVocabButton, vocabManagerModal, vocabManagerList, modalCloseButtonVocab, modalAddNewRuleButtonVocab, templatesContainer, manageTemplatesButton, templateManagerModal, templateManagerList, modalCloseButtonTemplate, modalAddNewTemplateButton };
    if (Object.values(elementsMap).some(el => !el)) {
        console.error("Error crítico: Uno o más elementos HTML no se encontraron al cargar el DOM.", elementsMap);
        alert("Error crítico: Fallo al cargar la interfaz. Revisa la consola.");
        return; 
    }
    console.log("DEBUG: Todos los elementos HTML principales fueron encontrados en DOMContentLoaded.");

    // --- Inicialización de Tema ---
    const preferredTheme = localStorage.getItem('theme') || 'dark'; 
    applyTheme(preferredTheme); 
    setAccentRGB(); 
    new MutationObserver(setAccentRGB).observe(document.body, { attributes: true, attributeFilter: ['data-theme']});
    themeSwitch.addEventListener('change', () => applyTheme(themeSwitch.checked ? 'dark' : 'light'));
});


document.addEventListener('firebaseReady', () => {
    initializeAuthAndApp();
});

function initializeAuthAndApp() {
    console.log("DEBUG: initializeAuthAndApp - INICIO de la función.");
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const loginEmailInput = document.getElementById('login-email');
    const loginPasswordInput = document.getElementById('login-password');
    const signupEmailInput = document.getElementById('signup-email');
    const signupPasswordInput = document.getElementById('signup-password');
    const loginButton = document.getElementById('loginButton'); 
    const signupButton = document.getElementById('signupButton'); 
    const showSignupLink = document.getElementById('showSignupLink');
    const showLoginLink = document.getElementById('showLoginLink');
    const loginErrorDiv = document.getElementById('login-error');
    const signupErrorDiv = document.getElementById('signup-error');
    const userDisplaySpan = document.getElementById('userDisplay');
    const logoutButton = document.getElementById('logoutButton');

    const auth = window.auth;
    const { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } = window;

    showSignupLink.addEventListener('click', (e) => { e.preventDefault(); loginForm.style.display = 'none'; signupForm.style.display = 'block'; loginErrorDiv.textContent = ''; signupErrorDiv.textContent = ''; });
    showLoginLink.addEventListener('click', (e) => { e.preventDefault(); signupForm.style.display = 'none'; loginForm.style.display = 'block'; loginErrorDiv.textContent = ''; signupErrorDiv.textContent = ''; });

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault(); const email = signupEmailInput.value; const password = signupPasswordInput.value;
        signupErrorDiv.textContent = ''; signupButton.disabled = true; signupButton.textContent = 'Registrando...';
        try { await createUserWithEmailAndPassword(auth, email, password); }
        catch (error) { signupErrorDiv.textContent = getFirebaseErrorMessage(error); }
        finally { signupButton.disabled = false; signupButton.textContent = 'Registrarse'; }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); const email = loginEmailInput.value; const password = loginPasswordInput.value;
        loginErrorDiv.textContent = ''; loginButton.disabled = true; loginButton.textContent = 'Iniciando...';
        try { await signInWithEmailAndPassword(auth, email, password); }
        catch (error) { loginErrorDiv.textContent = getFirebaseErrorMessage(error); }
        finally { loginButton.disabled = false; loginButton.textContent = 'Iniciar Sesión'; }
    });

    logoutButton.addEventListener('click', async () => {
        try { await signOut(auth); }
        catch (error) { console.error('DEBUG: Error al cerrar sesión:', error); alert("Error al cerrar sesión."); }
    });
    
    onAuthStateChanged(auth, async (user) => { 
        if (user) {
            currentUserId = user.uid; 
            document.body.classList.remove('logged-out'); document.body.classList.add('logged-in');
            authContainer.style.display = 'none'; appContainer.style.display = 'flex'; 
            userDisplaySpan.textContent = `${user.email || 'Usuario'}`;
            await loadUserData(currentUserId); 
            if (!window.dictationAppInitialized) {
                initializeDictationAppLogic(currentUserId); 
                window.dictationAppInitialized = true;
            } else {
                if (typeof updateButtonStates === "function") updateButtonStates("initial"); 
            }
        } else {
            currentUserId = null; customVocabulary = {}; learnedCorrections = {}; commonMistakeNormalization = {}; userTemplates = {};
            document.body.classList.remove('logged-in'); document.body.classList.add('logged-out');
            authContainer.style.display = 'block'; appContainer.style.display = 'none';
            if (userDisplaySpan) userDisplaySpan.textContent = '';
            if (window.currentMediaRecorder && window.currentMediaRecorder.state !== "inactive") {
                try { window.currentMediaRecorder.stop(); } 
                catch(e) { console.warn("DEBUG: onAuthStateChanged - Error al detener MediaRecorder en logout:", e); }
            }
            window.dictationAppInitialized = false; 
        }
    });

    function getFirebaseErrorMessage(error) {
        switch (error.code) {
            case 'auth/invalid-email': return 'Email inválido.';
            case 'auth/user-not-found': return 'Usuario no encontrado.';
            case 'auth/wrong-password': return 'Contraseña incorrecta.';
            case 'auth/email-already-in-use': return 'Email ya registrado.';
            default: return "Error de autenticación.";
        }
    }
} 

function initializeDictationAppLogic(userId) {
    console.log(`DEBUG: initializeDictationAppLogic para usuario: ${userId} - Asignando listeners.`);
    const debounceSaveState = debounce(saveState, 500);
    
    if (!startRecordBtn.dataset.listenerAttached) { startRecordBtn.addEventListener('click', () => { if (isProcessingClick) return; isProcessingClick = true; toggleRecordingState(); setTimeout(() => { isProcessingClick = false; }, CLICK_DEBOUNCE_MS); }); startRecordBtn.dataset.listenerAttached = 'true';}
    if (!pauseResumeBtn.dataset.listenerAttached) { pauseResumeBtn.addEventListener('click', () => { if (isProcessingClick) return; isProcessingClick = true; handlePauseResume(); setTimeout(() => { isProcessingClick = false; }, CLICK_DEBOUNCE_MS); }); pauseResumeBtn.dataset.listenerAttached = 'true';}
    if (!retryProcessBtn.dataset.listenerAttached) { retryProcessBtn.addEventListener('click', () => { if (currentAudioBlob) { if (isRecording || isPaused) { alert("Detén la grabación actual."); return; } processAudioBlobAndInsertText(currentAudioBlob); }}); retryProcessBtn.dataset.listenerAttached = 'true';}
    if (!copyPolishedTextBtn.dataset.listenerAttached) { copyPolishedTextBtn.addEventListener('click', async () => { const h = headerArea.value.trim(); const r = polishedTextarea.value.trim(); let t = ""; if(h){t+=h;} if(r){if(t){t+="\n\n";} t+=r;} if(t===''){setStatus("Nada que copiar.", "idle", 2000); return;} try{await navigator.clipboard.writeText(t); setStatus("¡Texto copiado!", "success", 2000);}catch(e){console.error('Error copia:',e);setStatus("Error copia.", "error", 3000);}}); copyPolishedTextBtn.dataset.listenerAttached = 'true';}
    if (!correctTextSelectionBtn.dataset.listenerAttached) { correctTextSelectionBtn.addEventListener('click', handleCorrectTextSelection); correctTextSelectionBtn.dataset.listenerAttached = 'true';}
    if (!resetReportBtn.dataset.listenerAttached) { resetReportBtn.addEventListener('click', () => { if (confirm("¿Borrar contenido de Técnica e Informe?")) { headerArea.value = ""; polishedTextarea.value = ""; saveState(); setStatus("Informe reseteado.", "idle", 2000); }}); resetReportBtn.dataset.listenerAttached = 'true';}
    if (!undoButton.dataset.listenerAttached) { undoButton.addEventListener('click', undo); undoButton.dataset.listenerAttached = 'true'; }
    if (!redoButton.dataset.listenerAttached) { redoButton.addEventListener('click', redo); redoButton.dataset.listenerAttached = 'true'; }
    if (!techniqueButtonsContainer.dataset.listenerAttached) { techniqueButtonsContainer.addEventListener('click', (e) => { if (e.target.tagName === 'BUTTON' && e.target.dataset.techniqueText) { headerArea.value = e.target.dataset.techniqueText; saveState(); }}); techniqueButtonsContainer.dataset.listenerAttached = 'true';}
    if (!clearHeaderButton.dataset.listenerAttached) { clearHeaderButton.addEventListener('click', () => { headerArea.value = ""; saveState(); }); clearHeaderButton.dataset.listenerAttached = 'true';}
    if (!manageVocabButton.dataset.listenerAttached) { manageVocabButton.addEventListener('click', openVocabManager); manageVocabButton.dataset.listenerAttached = 'true'; manageVocabButton.disabled = false; }
    if (!modalCloseButtonVocab.dataset.listenerAttached) { modalCloseButtonVocab.addEventListener('click', closeVocabManager); modalCloseButtonVocab.dataset.listenerAttached = 'true'; }
    if (!modalAddNewRuleButtonVocab.dataset.listenerAttached) { modalAddNewRuleButtonVocab.addEventListener('click', handleAddNewVocabRule); modalAddNewRuleButtonVocab.dataset.listenerAttached = 'true'; }
    if (!vocabManagerModal.dataset.listenerAttached) { vocabManagerModal.addEventListener('click', (e) => { if (e.target === vocabManagerModal) closeVocabManager(); }); vocabManagerModal.dataset.listenerAttached = 'true'; }
    if (!manageTemplatesButton.dataset.listenerAttached) { manageTemplatesButton.addEventListener('click', openTemplateManager); manageTemplatesButton.dataset.listenerAttached = 'true'; manageTemplatesButton.disabled = false; }
    if (!templatesContainer.dataset.listenerAttached) { templatesContainer.addEventListener('click', handleTemplateButtonClick); templatesContainer.dataset.listenerAttached = 'true'; }
    if (!modalCloseButtonTemplate.dataset.listenerAttached) { modalCloseButtonTemplate.addEventListener('click', closeTemplateManager); modalCloseButtonTemplate.dataset.listenerAttached = 'true'; }
    if (!modalAddNewTemplateButton.dataset.listenerAttached) { modalAddNewTemplateButton.addEventListener('click', handleAddNewTemplate); modalAddNewTemplateButton.dataset.listenerAttached = 'true'; }
    if (!templateManagerModal.dataset.listenerAttached) { templateManagerModal.addEventListener('click', (e) => { if (e.target === templateManagerModal) closeTemplateManager(); }); templateManagerModal.dataset.listenerAttached = 'true'; }
    if (!polishedTextarea.dataset.inputListenerAttached) { polishedTextarea.addEventListener('input', debounceSaveState); polishedTextarea.dataset.inputListenerAttached = 'true'; }
    if (!headerArea.dataset.inputListenerAttached) { headerArea.addEventListener('input', debounceSaveState); headerArea.dataset.listenerAttached = 'true'; }
    
    if (!document.body.dataset.keydownListenerAttached) { 
        document.addEventListener('keydown', function(event) {
            if (event.shiftKey && (event.metaKey || event.ctrlKey) && event.key === 'Shift') { event.preventDefault(); if (document.body.classList.contains('logged-in') && startRecordBtn && !startRecordBtn.disabled) { if (isProcessingClick) return; isProcessingClick = true; toggleRecordingState(); setTimeout(() => { isProcessingClick = false; }, CLICK_DEBOUNCE_MS); } }
            else if (event.shiftKey && event.altKey && event.key.toUpperCase() === 'P') { event.preventDefault(); if (document.body.classList.contains('logged-in') && pauseResumeBtn && !pauseResumeBtn.disabled) { if (isProcessingClick) return; isProcessingClick = true; handlePauseResume(); setTimeout(() => { isProcessingClick = false; }, CLICK_DEBOUNCE_MS); } }
        });
        document.body.dataset.keydownListenerAttached = 'true'; 
    }
    
    saveState();
    updateButtonStates("initial"); 
} 

function applyTheme(theme) { document.body.setAttribute('data-theme', theme); localStorage.setItem('theme', theme); if (themeSwitch) themeSwitch.checked = theme === 'dark'; if (mainTitleImage && mainTitleImageDark) { mainTitleImage.style.display = theme === 'light' ? 'inline-block' : 'none'; mainTitleImageDark.style.display = theme === 'dark' ? 'inline-block' : 'none'; } }
function setAccentRGB() { try { const bS = getComputedStyle(document.body); if (!bS) return; const aC = bS.getPropertyValue('--accent-color').trim(); if (aC.startsWith('#')) { const r = parseInt(aC.slice(1,3),16), g = parseInt(aC.slice(3,5),16), b = parseInt(aC.slice(5,7),16); document.documentElement.style.setProperty('--accent-color-rgb',`${r},${g},${b}`); } else if (aC.startsWith('rgb')) { const p = aC.match(/[\d.]+/g); if (p && p.length >=3) document.documentElement.style.setProperty('--accent-color-rgb',`${p[0]},${p[1]},${p[2]}`);}} catch (e) { console.warn("Failed to set --accent-color-rgb:", e); }}
function setStatus(message, type = "idle", duration = 0) { if (!statusDiv) return; statusDiv.textContent = message; statusDiv.className = ''; statusDiv.classList.add(`status-${type}`); if (duration > 0) { setTimeout(() => { if (statusDiv.textContent === message) updateButtonStates("initial"); }, duration); }}
function startRecordingTimer() { stopRecordingTimer(); updateRecordingTimeDisplay(); recordingTimerInterval = setInterval(() => { if (!isPaused) { recordingSeconds++; updateRecordingTimeDisplay();}}, 1000); }
function stopRecordingTimer() { clearInterval(recordingTimerInterval); }
function updateRecordingTimeDisplay() { const m=Math.floor(recordingSeconds/60), s=recordingSeconds%60; recordingTimeDisplay.textContent = isRecording||isPaused ? `Tiempo: ${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}` : ""; }
function resetRecordingTimerDisplay() { recordingTimeDisplay.textContent = ""; recordingSeconds = 0; }
function setupVolumeMeter(stream) { volumeMeterContainer.style.display='block'; if(!audioContext) audioContext=new(window.AudioContext||window.webkitAudioContext)(); if(audioContext.state==='suspended') audioContext.resume(); analyser=audioContext.createAnalyser(); microphoneSource=audioContext.createMediaStreamSource(stream); microphoneSource.connect(analyser); analyser.fftSize=256; analyser.smoothingTimeConstant=0.3; const l=analyser.frequencyBinCount, d=new Uint8Array(l); function draw(){if(!isRecording||isPaused){if(isPaused){volumeMeterBar.classList.add('paused'); volumeMeterBar.style.background='var(--button-default-bg)';}else{volumeMeterBar.classList.remove('paused'); volumeMeterBar.style.background='var(--volume-bar-gradient)';} animationFrameId=requestAnimationFrame(draw); return;} animationFrameId=requestAnimationFrame(draw); analyser.getByteFrequencyData(d); let s=0; for(let i=0;i<l;i++){s+=d[i];} let a=s/l; let v=(a/130)*100; v=Math.min(100,Math.max(0,v)); volumeMeterBar.style.width=v+'%'; volumeMeterBar.classList.remove('paused'); volumeMeterBar.style.background='var(--volume-bar-gradient)';} draw(); }
function stopVolumeMeter() { if(animationFrameId) cancelAnimationFrame(animationFrameId); if(microphoneSource){microphoneSource.disconnect(); microphoneSource=null;} volumeMeterBar.style.width='0%'; volumeMeterBar.classList.remove('paused'); volumeMeterContainer.style.display='none';}
function toggleRecordingState() { if(isRecording){if(mediaRecorder&&(mediaRecorder.state==="recording"||mediaRecorder.state==="paused")){mediaRecorder.stop();setStatus("Deteniendo...","processing");}else{isRecording=false;isPaused=false;updateButtonStates("initial");}}else{startActualRecording();}}
async function startActualRecording() { if (polishedTextarea.selectionStart !== polishedTextarea.selectionEnd) { isDictatingForReplacement = true; replacementSelectionStart = polishedTextarea.selectionStart; replacementSelectionEnd = polishedTextarea.selectionEnd; setStatus("Dicte el reemplazo...", "processing"); } else { isDictatingForReplacement = false; insertionPoint = polishedTextarea.selectionStart; } isPaused = false; audioChunks = []; currentAudioBlob = null; recordingSeconds = 0; audioPlaybackSection.style.display = 'none'; if (audioPlayback.src) { URL.revokeObjectURL(audioPlayback.src); audioPlayback.src = ''; audioPlayback.removeAttribute('src');} if (!userApiKey) { alert('API Key?'); setStatus("Error Key","error"); updateButtonStates("initial"); isDictatingForReplacement = false; return; } try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); isRecording = true; setupVolumeMeter(stream); startRecordingTimer(); mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' }); window.currentMediaRecorder = mediaRecorder; mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); }; mediaRecorder.onpause = () => { setStatus(isDictatingForReplacement ? 'Reemplazo pausado.' : 'Dictado pausado.', 'idle'); isPaused = true; volumeMeterBar.classList.add('paused'); volumeMeterBar.style.background = 'var(--button-default-bg)'; updateButtonStates("paused"); }; mediaRecorder.onresume = () => { setStatus(isDictatingForReplacement ? 'Dictando reemplazo...' : 'Grabando... (Reanudado)', 'processing'); isPaused = false; volumeMeterBar.classList.remove('paused'); volumeMeterBar.style.background = 'var(--volume-bar-gradient)'; updateButtonStates("recording"); }; mediaRecorder.onstop = async () => { isRecording = false; isPaused = false; stopVolumeMeter(); stopRecordingTimer(); setStatus('Grabación detenida. Procesando...', 'processing'); if (audioChunks.length === 0) { setStatus("No audio.", "error", 3000); updateButtonStates("stopped_error"); isDictatingForReplacement = false; return; } currentAudioBlob = new Blob(audioChunks, { type: 'audio/webm' }); if (currentAudioBlob.size === 0) { setStatus("Audio vacío.", "error", 3000); updateButtonStates("stopped_error"); isDictatingForReplacement = false; return; } const audioURL = URL.createObjectURL(currentAudioBlob); audioPlayback.src = audioURL; await processAudioBlobAndInsertText(currentAudioBlob); }; mediaRecorder.onerror = e => { isRecording = false; isPaused = false; isDictatingForReplacement = false; stopVolumeMeter(); stopRecordingTimer(); resetRecordingTimerDisplay(); setStatus(`Error MediaRec: ${e.error.name}`, "error", 4000); updateButtonStates("error"); }; mediaRecorder.start(); updateButtonStates("recording"); } catch (e) { isRecording = false; isPaused = false; isDictatingForReplacement = false; stopVolumeMeter(); stopRecordingTimer(); resetRecordingTimerDisplay(); setStatus(`Error Mic: ${e.message}.`, "error", 4000); updateButtonStates("initial"); } }
async function processAudioBlobAndInsertText(audioBlob) { updateButtonStates("processing_audio"); try { const base64Audio = await blobToBase64(audioBlob); if (!base64Audio || base64Audio.length < 100) throw new Error("Fallo Base64."); let processedNewText = await transcribeAndPolishAudio(base64Audio); const currentContent = polishedTextarea.value; if (isDictatingForReplacement) { const textBeforeSelection = currentContent.substring(0, replacementSelectionStart); const textAfterSelection = currentContent.substring(replacementSelectionEnd); if (processedNewText.length > 0) { const charBefore = textBeforeSelection.trim().slice(-1); const needsCapital = replacementSelectionStart === 0 || charBefore === '.' || charBefore === '!' || charBefore === '?' || textBeforeSelection.trim().endsWith('\n'); if (needsCapital) { processedNewText = processedNewText.charAt(0).toUpperCase() + processedNewText.slice(1); } else { if (processedNewText.charAt(0) === processedNewText.charAt(0).toUpperCase() && processedNewText.charAt(0) !== processedNewText.charAt(0).toLowerCase()) { processedNewText = processedNewText.charAt(0).toLowerCase() + processedNewText.slice(1); } } } let smartSpaceBefore = ""; if (textBeforeSelection.length > 0 && !/\s$/.test(textBeforeSelection) && processedNewText.length > 0 && !/^\s/.test(processedNewText) && !/^[,.;:!?)]/.test(processedNewText)) { smartSpaceBefore = " "; } let smartSpaceAfter = ""; if (textAfterSelection.length > 0 && !/^\s/.test(textAfterSelection) && processedNewText.length > 0 && !/\s$/.test(processedNewText) && !/[([{]$/.test(processedNewText)) { smartSpaceAfter = " "; } polishedTextarea.value = textBeforeSelection + smartSpaceBefore + processedNewText + smartSpaceAfter + textAfterSelection; const newCursorPos = replacementSelectionStart + smartSpaceBefore.length + processedNewText.length; polishedTextarea.selectionStart = polishedTextarea.selectionEnd = newCursorPos; setStatus('Texto reemplazado.', 'success', 3000); } else { const textBeforeCursor = currentContent.substring(0, insertionPoint); const textAfterCursor = currentContent.substring(insertionPoint); if (processedNewText.length > 0) { const charBefore = textBeforeCursor.trim().slice(-1); const needsCapital = insertionPoint === 0 || charBefore === '.' || charBefore === '!' || charBefore === '?' || textBeforeCursor.trim().endsWith('\n'); if (needsCapital) { processedNewText = processedNewText.charAt(0).toUpperCase() + processedNewText.slice(1); } else { if (processedNewText.charAt(0) === processedNewText.charAt(0).toUpperCase() && processedNewText.charAt(0) !== processedNewText.charAt(0).toLowerCase()) { processedNewText = processedNewText.charAt(0).toLowerCase() + processedNewText.slice(1); } } } let smartSpaceBefore = ""; if (textBeforeCursor.length > 0 && !/\s$/.test(textBeforeCursor) && processedNewText.length > 0 && !/^\s/.test(processedNewText) && !/^[,.;:!?)]/.test(processedNewText) ) { smartSpaceBefore = " "; } let smartSpaceAfter = ""; if (textAfterCursor.length > 0 && !/^\s/.test(textAfterCursor) && processedNewText.length > 0 && !/\s$/.test(processedNewText) && !/[([{]$/.test(processedNewText)) { smartSpaceAfter = " "; } polishedTextarea.value = textBeforeCursor + smartSpaceBefore + processedNewText + smartSpaceAfter + textAfterCursor; const newCursorPos = insertionPoint + smartSpaceBefore.length + processedNewText.length; polishedTextarea.selectionStart = polishedTextarea.selectionEnd = newCursorPos; setStatus('Texto insertado/añadido.', 'success', 3000); } saveState(); updateButtonStates("success_processing"); } catch (error) { console.error('Error en processAudioBlobAndInsertText:', error); setStatus(`Error Proc: ${error.message}`, "error", 4000); if (!isDictatingForReplacement && currentContent.trim() === "") { polishedTextarea.value = `Error: ${error.message}`; } updateButtonStates("error_processing"); } finally { isDictatingForReplacement = false; } }
function handlePauseResume() { if(!mediaRecorder||!isRecording)return;if(mediaRecorder.state==="recording"){mediaRecorder.pause();}else if(mediaRecorder.state==="paused"){mediaRecorder.resume();}}
function updateButtonStates(state) { startRecordBtn.disabled=true;pauseResumeBtn.disabled=true;retryProcessBtn.disabled=true;copyPolishedTextBtn.disabled=false;correctTextSelectionBtn.disabled=true; if(resetReportBtn) resetReportBtn.disabled = false; startRecordBtn.textContent="Empezar Dictado";startRecordBtn.classList.remove("stop-style");pauseResumeBtn.textContent="Pausar";let showPlayer=false;if(currentAudioBlob){if(["initial","stopped_success","error_processing","success_processing","stopped_error"].includes(state)){showPlayer=true;}}if(audioPlaybackSection)audioPlaybackSection.style.display=showPlayer?'block':'none';else console.warn("audioPlaybackSection null en updateButtonStates");switch(state){case "initial":startRecordBtn.disabled=false;if(statusDiv&&statusDiv.textContent.toLowerCase()!=="listo"&&!statusDiv.textContent.toLowerCase().includes("error")&&!statusDiv.textContent.toLowerCase().includes("pausada")&&!statusDiv.textContent.toLowerCase().includes("reemplazo"))setStatus("Listo","idle");resetRecordingTimerDisplay();stopVolumeMeter();retryProcessBtn.disabled=!currentAudioBlob;correctTextSelectionBtn.disabled=polishedTextarea.value.trim()==="";break;case "recording":startRecordBtn.disabled=false;startRecordBtn.textContent=isDictatingForReplacement?"Detener Reemplazo":"Detener Dictado";startRecordBtn.classList.add("stop-style");pauseResumeBtn.disabled=false;retryProcessBtn.disabled=true;correctTextSelectionBtn.disabled=true;if(resetReportBtn) resetReportBtn.disabled=true;if(!isDictatingForReplacement&&statusDiv.textContent.toLowerCase()!=='grabando...'&&statusDiv.textContent.toLowerCase()!=='dicte el reemplazo...')setStatus('Grabando...','processing');break;case "paused":startRecordBtn.disabled=false;startRecordBtn.textContent=isDictatingForReplacement?"Detener Reemplazo":"Detener Dictado";startRecordBtn.classList.add("stop-style");pauseResumeBtn.disabled=false;pauseResumeBtn.textContent="Reanudar";retryProcessBtn.disabled=true;correctTextSelectionBtn.disabled=polishedTextarea.value.trim()==="";if(resetReportBtn) resetReportBtn.disabled=true;if(!isDictatingForReplacement&&statusDiv.textContent.toLowerCase()!=='reemplazo pausado.'&&statusDiv.textContent.toLowerCase()!=='dictado pausado.')setStatus('Grabación pausada.','idle');break;case "stopped_success":startRecordBtn.disabled=false;retryProcessBtn.disabled=!currentAudioBlob;correctTextSelectionBtn.disabled=polishedTextarea.value.trim()==="";break;case "stopped_error":startRecordBtn.disabled=false;resetRecordingTimerDisplay();stopVolumeMeter();retryProcessBtn.disabled=!currentAudioBlob;correctTextSelectionBtn.disabled=true;break;case "processing_audio":startRecordBtn.disabled=true;pauseResumeBtn.disabled=true;retryProcessBtn.disabled=true;correctTextSelectionBtn.disabled=true;if(resetReportBtn) resetReportBtn.disabled=true;break;case "error_processing":startRecordBtn.disabled=false;retryProcessBtn.disabled=!currentAudioBlob;correctTextSelectionBtn.disabled=polishedTextarea.value.trim()==="";break;case "success_processing":startRecordBtn.disabled=false;retryProcessBtn.disabled=!currentAudioBlob;correctTextSelectionBtn.disabled=polishedTextarea.value.trim()==="";break;case "error":startRecordBtn.disabled=false;resetRecordingTimerDisplay();stopVolumeMeter();retryProcessBtn.disabled=!currentAudioBlob;correctTextSelectionBtn.disabled=true;break;default:startRecordBtn.disabled=false;resetRecordingTimerDisplay();stopVolumeMeter();retryProcessBtn.disabled=!currentAudioBlob;correctTextSelectionBtn.disabled=polishedTextarea.value.trim()==="";break;}}
async function handleCorrectTextSelection(){if(!polishedTextarea)return;const sS=polishedTextarea.selectionStart;const sE=polishedTextarea.selectionEnd;const sT=polishedTextarea.value.substring(sS,sE).trim();if(!sT){setStatus("Selecciona texto.","idle",3000);return;}const cTU=prompt(`Corregir:\n"${sT}"\n\nCorrección:` ,sT);if(cTU===null){setStatus("Cancelado.","idle",2000);return;}const fCT=cTU.trim();const ruleKey = sT.toLowerCase(); if(sT.toLowerCase()===fCT.toLowerCase()&&sT!==fCT){saveState();}else if(sT.toLowerCase()!==fCT.toLowerCase()||fCT==="" || !customVocabulary.hasOwnProperty(ruleKey) || customVocabulary[ruleKey] !== fCT ){customVocabulary[ruleKey]=fCT; const nK = ruleKey.replace(/[.,:;!?()"'-]/g, '').replace(/\s+/g, ' ').trim(); if (nK) { if (!learnedCorrections[nK]) learnedCorrections[nK] = { correctKey: fCT, count: 0 }; learnedCorrections[nK].count++; } await saveUserData();setStatus(`Regla guardada: "${ruleKey}"➔"${fCT}"`,"success",3000);}else{setStatus("No cambios para guardar.","idle",2000);}const tB=polishedTextarea.value.substring(0,sS);const tA=polishedTextarea.value.substring(sE);polishedTextarea.value=tB+fCT+tA;saveState();polishedTextarea.selectionStart=polishedTextarea.selectionEnd=sS+fCT.length;polishedTextarea.focus();}
function blobToBase64(b){return new Promise((res,rej)=>{if(!b||b.size===0)return rej(new Error("Blob nulo"));const r=new FileReader();r.onloadend=()=>{if(r.result){const s=r.result.toString().split(',')[1];if(!s)return rej(new Error("Fallo Base64"));res(s);}else rej(new Error("FileReader sin resultado"));};r.onerror=e=>rej(e);r.readAsDataURL(b);});}
async function callGeminiAPI(p,isTxt=false){if(!userApiKey)throw new Error('No API Key');const u=`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${userApiKey}`;const t=isTxt?0.1:0.2;const y={contents:[{parts:p}],generationConfig:{temperature:t}};const resp=await fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(y)});if(!resp.ok){const eD=await resp.json();console.error("Error Gemini API:",eD);throw new Error(`Error API:${eD.error?.message||resp.statusText}(${resp.status})`);}const d=await resp.json();if(d.candidates?.[0]?.content?.parts?.[0]?.text)return d.candidates[0].content.parts[0].text;if(d.promptFeedback?.blockReason)throw new Error(`Bloqueado:${d.promptFeedback.blockReason}.${d.promptFeedback.blockReasonMessage||''}`);if(d.candidates?.[0]?.finishReason&&d.candidates[0].finishReason!=="STOP")throw new Error(`Gemini fin:${d.candidates[0].finishReason}.`);if(d.candidates?.[0]?.finishReason==="STOP"&&!d.candidates?.[0]?.content?.parts?.[0]?.text)return"";throw new Error('Gemini respuesta inesperada.');}
function cleanupArtifacts(text) { if (!text || typeof text !== 'string') return text || ""; let cleanedText = text; let trimmedForQuotesCheck = cleanedText.trim(); if (trimmedForQuotesCheck.startsWith('"') && trimmedForQuotesCheck.endsWith('"') && trimmedForQuotesCheck.length > 2) { cleanedText = trimmedForQuotesCheck.substring(1, trimmedForQuotesCheck.length - 1).trim(); } cleanedText = cleanedText.replace(/(\s[pP])+[ \t]*$/gm, ""); cleanedText = cleanedText.replace(/[pP]{2,}[ \t]*$/gm, ""); cleanedText = cleanedText.replace(/\s+[pP][\s.]*$/gm, ""); const trimmedTextForPunctuationCheck = cleanedText.trim(); const wordCount = trimmedTextForPunctuationCheck.split(/\s+/).filter(Boolean).length; if (wordCount > 0 && wordCount <= 5) { if (trimmedTextForPunctuationCheck.endsWith('.') && !trimmedTextForPunctuationCheck.endsWith('..') && !trimmedTextForPunctuationCheck.endsWith('...') && (trimmedTextForPunctuationCheck.length === 1 || (trimmedTextForPunctuationCheck.length > 1 && trimmedTextForPunctuationCheck.charAt(trimmedTextForPunctuationCheck.length - 2) !== '.'))) { if (trimmedTextForPunctuationCheck.length <= 1 || !/[.!?]$/.test(trimmedTextForPunctuationCheck.substring(0, trimmedTextForPunctuationCheck.length -1).trim())) { cleanedText = trimmedTextForPunctuationCheck.slice(0, -1); } } } cleanedText = cleanedText.replace(/\n+$/, ""); cleanedText = cleanedText.replace(/\s+([.!?])$/, "$1"); cleanedText = cleanedText.replace(/ +/g, ' '); return cleanedText.trim(); }
function capitalizeSentencesProperly(text) { if (!text || typeof text !== 'string' || text.trim() === "") { return text || ""; } let processedText = text.trim(); processedText = processedText.replace( /([.!?])(\s*)([a-záéíóúüñ])/g, (match, punctuation, whitespace, letter) => { return punctuation + whitespace + letter.toUpperCase(); }); return processedText; }
async function transcribeAndPolishAudio(base64Audio){ let tTxt=''; try{ setStatus('Transcribiendo...','processing'); const tP=[{text:"Transcribe el siguiente audio a texto con la MÁXIMA LITERALIDAD POSIBLE. Ignora sonidos de respiración o carraspeos. Si el hablante dice 'coma', 'punto', etc., transcríbelo tal cual como texto, no como el signo de puntuación. El objetivo es una transcripción fiel palabra por palabra. Si el audio termina abruptamente sin una palabra de puntuación, NO añadas ninguna."},{inline_data:{mime_type:"audio/webm",data:base64Audio}}]; tTxt=await callGeminiAPI(tP,false); tTxt = cleanupArtifacts(tTxt); }catch(e){ console.error("Error transcripción:",e);throw new Error(`Fallo transcripción:${e.message}`); } if(!tTxt||tTxt.trim()==="") throw new Error("Transcripción vacía después de limpieza inicial."); let pAI=''; try{ setStatus('Puliendo...','processing'); const pP=[{text:`Por favor, revisa el siguiente texto. Aplica las siguientes modificaciones ÚNICAMENTE:\n1. Interpreta y reemplaza las siguientes palabras dictadas como signos de puntuación y formato EXACTAMENTE como se indica: 'coma' -> ',', 'punto' -> '.', 'punto y aparte' -> '.\\n\\n', 'nueva línea' -> '\\n\\n', 'dos puntos' -> ':', 'punto y coma' -> ';', 'interrogación' -> '?', 'exclamación' -> '!'.\n2. Corrige ÚNICAMENTE errores ortográficos evidentes y objetivos.\n3. Corrige ÚNICAMENTE errores gramaticales OBJETIVOS Y CLAROS que impidan la comprensión.\n4. NO CAMBIES la elección de palabras del hablante si son gramaticalmente correctas y comprensibles.\n5. NO REESTRUCTURES frases si son gramaticalmente correctas.\n6. PRESERVA el estilo y las expresiones exactas del hablante. NO intentes "mejorar" el texto.\n7. Al reemplazar palabras clave de puntuación (como "coma" por ","), asegúrate de que no resulten en signos de puntuación duplicados consecutivos (ej. ",," o ".."). Si esto ocurre, mantén solo un signo de puntuación.\n8. Capitaliza la primera letra de una oración SOLO si sigue a un '.', '?', o '!' dictados explícitamente y que hayas insertado, o si es el inicio absoluto del texto completo.\n9. CRUCIAL: NO AÑADAS NINGÚN SIGNO DE PUNTUACIÓN (especialmente un punto final '.') AL FINAL DEL TEXTO PROCESADO A MENOS QUE LA PALABRA "punto" (o equivalente) HAYA SIDO DICTADA EXPLÍCITAMENTE COMO LA ÚLTIMA PARTE DE LA TRANSCRIPCIÓN ORIGINAL.\n\nTexto a procesar:\n"${tTxt}"`}]; pAI=await callGeminiAPI(pP,true); }catch(e){ console.error("Error pulido IA:",e); setStatus(`Fallo pulido IA:${e.message}. Usando transcripción limpia.`,"error",4000); pAI=tTxt; } let postAIPolish = pAI.replace(/,\s*,\s*,/g,',').replace(/,\s*,/g,',').replace(/,,+/g,',').replace(/(?<!\.)\.\.(?!\.)/g,'.').replace(/\.\s+\./g,'.').replace(/\s+([,.;:!?])/g,'$1').replace(/([,.;:!?])([a-zA-Z0-9À-ÿ])/g,'$1 $2'); let cleanedAgain = cleanupArtifacts(postAIPolish); let capitalizedText = capitalizeSentencesProperly(cleanedAgain); let customCorrectedText = applyAllUserCorrections(capitalizedText); let finalText = customCorrectedText.replace(/\s*\n\s*\n/g,'\n\n').replace(/\s+\n/g,'\n').replace(/\n{3,}/g,'\n\n'); return finalText; }
async function loadUserData(userId) { if (!userId || !window.db) { customVocabulary = {}; learnedCorrections = {}; commonMistakeNormalization = {}; userTemplates = {}; return; } const docRef = window.doc(window.db, "userVocabularies", userId); try { const docSnap = await window.getDoc(docRef); if (docSnap.exists()) { const data = docSnap.data(); customVocabulary = data.rulesMap || {}; learnedCorrections = data.learnedMap || {}; commonMistakeNormalization = data.normalizations || {}; userTemplates = data.templates || {}; console.log("DEBUG: Datos de usuario cargados."); } else { customVocabulary = {}; learnedCorrections = {}; commonMistakeNormalization = {}; userTemplates = {}; console.log("DEBUG: No existe documento de datos para el usuario."); } } catch (error) { console.error("Error cargando datos de usuario:", error); customVocabulary = {}; learnedCorrections = {}; commonMistakeNormalization = {}; userTemplates = {}; setStatus("Error al cargar personalizaciones.", "error", 3000); } populateTemplateButtons(); }
async function saveUserData() { if (!currentUserId || !window.db) return; const docRef = window.doc(window.db, "userVocabularies", currentUserId); const dataToSave = { rulesMap: customVocabulary, learnedMap: learnedCorrections, normalizations: commonMistakeNormalization, templates: userTemplates }; try { await window.setDoc(docRef, dataToSave); console.log(`DEBUG: Datos de usuario guardados en Firestore.`); } catch (error) { console.error(`Error guardando datos:`, error); setStatus("Error al guardar datos.", "error", 3000); } }
function escapeRegExp(string) { return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function openVocabManager() { if (!vocabManagerModal) return; populateVocabManagerList(); vocabManagerModal.style.display = 'flex'; }
function closeVocabManager() { if (!vocabManagerModal) return; vocabManagerModal.style.display = 'none'; }
function populateVocabManagerList() { if (!vocabManagerList) return; vocabManagerList.innerHTML = ''; const keys = Object.keys(customVocabulary).sort(); if (keys.length === 0) { vocabManagerList.innerHTML = '<li>No hay reglas personalizadas.</li>'; return; } keys.forEach(key => { const value = customVocabulary[key]; const listItem = document.createElement('li'); listItem.innerHTML = `<span class="vocab-key">${key}</span> <span class="vocab-arrow">➔</span> <span class="vocab-value">${value}</span> <div class="vocab-actions"><button class="edit-vocab-btn" data-key="${key}">Editar</button><button class="delete-vocab-btn" data-key="${key}">Borrar</button></div>`; listItem.querySelector('.edit-vocab-btn').addEventListener('click', () => handleEditVocabRule(key)); listItem.querySelector('.delete-vocab-btn').addEventListener('click', () => handleDeleteVocabRule(key)); vocabManagerList.appendChild(listItem); }); }
async function handleAddNewVocabRule() { const errorKeyRaw = prompt("Texto incorrecto:"); if (!errorKeyRaw || errorKeyRaw.trim() === "") return; const errorKey = errorKeyRaw.trim().toLowerCase(); const correctValueRaw = prompt(`Corrección para "${errorKeyRaw}":`); if (correctValueRaw === null) return; const correctValue = correctValueRaw.trim(); if (customVocabulary[errorKey] === correctValue && correctValue !== "") { alert("Regla ya existe."); return; } customVocabulary[errorKey] = correctValue; await saveUserData(); populateVocabManagerList(); setStatus("Regla añadida.", "success", 2000); }
async function handleEditVocabRule(keyToEdit) { const currentValue = customVocabulary[keyToEdit]; const newErrorKeyRaw = prompt(`Editar CLAVE (original: "${keyToEdit}"):`, keyToEdit); if (newErrorKeyRaw === null) return; const newErrorKey = (newErrorKeyRaw.trim() === "" ? keyToEdit : newErrorKeyRaw.trim()).toLowerCase(); const newCorrectValueRaw = prompt(`Editar VALOR para "${newErrorKey}" (original: "${currentValue}"):`, currentValue); if (newCorrectValueRaw === null) return; const newCorrectValue = newCorrectValueRaw.trim(); if (newErrorKey !== keyToEdit && customVocabulary.hasOwnProperty(newErrorKey)) { alert(`La clave "${newErrorKey}" ya existe.`); return; } if (newErrorKey !== keyToEdit) delete customVocabulary[keyToEdit]; customVocabulary[newErrorKey] = newCorrectValue; await saveUserData(); populateVocabManagerList(); setStatus("Regla actualizada.", "success", 2000); }
async function handleDeleteVocabRule(keyToDelete) { if (confirm(`¿Borrar la regla para "${keyToDelete}"?`)) { delete customVocabulary[keyToDelete]; await saveUserData(); populateVocabManagerList(); setStatus("Regla borrada.", "success", 2000); } }

console.log("DEBUG: Script principal evaluado. Esperando eventos...");
