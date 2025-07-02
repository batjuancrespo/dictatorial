// --- Variables Globales de la App de Dictado (declaradas una vez) ---
let startRecordBtn, pauseResumeBtn, retryProcessBtn, copyPolishedTextBtn, correctTextSelectionBtn, resetReportBtn, juanizarBtn,
    statusDiv, polishedTextarea, audioPlayback, audioPlaybackSection, 
    themeSwitch, volumeMeterBar, volumeMeterContainer, recordingTimeDisplay, 
    headerArea, techniqueButtonsContainer, clearHeaderButton, 
    mainTitleImage, mainTitleImageDark,
    vocabManagerModal, vocabManagerList, modalCloseButtonVocab, modalAddNewRuleButtonVocab, manageVocabButton;

let mediaRecorder;
let audioChunks = [];
let currentAudioBlob = null;
let audioContext;
let analyser;
let microphoneSource;
let animationFrameId;
let isRecording = false; 
let isPaused = false;
let recordingTimerInterval; 
let recordingSeconds = 0;  
const userApiKey = 'AIzaSyASbB99MVIQ7dt3MzjhidgoHUlMXIeWvGc'; // API Key de Gemini

// --- Variables para el Vocabulario del Usuario ---
let currentUserId = null;      
let customVocabulary = {};
let learnedCorrections = {};
let commonMistakeNormalization = {};

// --- Variables de Estado y UI ---
let isProcessingClick = false; 
const CLICK_DEBOUNCE_MS = 300; 
let isDictatingForReplacement = false;
let replacementSelectionStart = 0;
let replacementSelectionEnd = 0;
let insertionPoint = 0; 
let lastCopiedText = ''; // Variable para el estado del botón de copiar

document.addEventListener('DOMContentLoaded', () => {
    console.log("DEBUG: DOMContentLoaded event fired.");

    startRecordBtn = document.getElementById('startRecordBtn');
    pauseResumeBtn = document.getElementById('pauseResumeBtn');
    retryProcessBtn = document.getElementById('retryProcessBtn');
    copyPolishedTextBtn = document.getElementById('copyPolishedTextBtn'); 
    correctTextSelectionBtn = document.getElementById('correctTextSelectionBtn');
    resetReportBtn = document.getElementById('resetReportBtn');
    juanizarBtn = document.getElementById('juanizarBtn');
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

    const elementsMap = {
        startRecordBtn, pauseResumeBtn, retryProcessBtn, copyPolishedTextBtn, correctTextSelectionBtn, resetReportBtn, juanizarBtn,
        statusDiv, polishedTextarea, audioPlayback, audioPlaybackSection, themeSwitch,
        volumeMeterBar, volumeMeterContainer, recordingTimeDisplay, headerArea,
        techniqueButtonsContainer, clearHeaderButton, mainTitleImage, mainTitleImageDark,
        manageVocabButton, vocabManagerModal, vocabManagerList, modalCloseButtonVocab, modalAddNewRuleButtonVocab
    };

    let allElementsFound = true;
    for (const elementName in elementsMap) {
        if (!elementsMap[elementName]) {
            console.error(`DEBUG: Elemento NO encontrado en DOMContentLoaded: ${elementName}`);
            allElementsFound = false;
        }
    }

    if (!allElementsFound) {
        const errorMessage = "Error crítico: Uno o más elementos HTML de la app no se encontraron al cargar el DOM. Revisa la consola.";
        alert(errorMessage);
        if (statusDiv) { statusDiv.textContent = "Error crítico de UI."; statusDiv.className = 'status-error';}
        return; 
    }
    console.log("DEBUG: Todos los elementos HTML principales fueron encontrados en DOMContentLoaded.");

    const preferredTheme = localStorage.getItem('theme') || 'dark'; 
    applyTheme(preferredTheme); 
    setAccentRGB(); 
    new MutationObserver(setAccentRGB).observe(document.body, { attributes: true, attributeFilter: ['data-theme']});

    if (themeSwitch) {
        themeSwitch.addEventListener('change', () => {
            applyTheme(themeSwitch.checked ? 'dark' : 'light');
        });
    } else {
        console.error("DEBUG: themeSwitch no fue encontrado.");
    }
});


document.addEventListener('firebaseReady', () => {
    console.log("DEBUG: Evento firebaseReady RECIBIDO. Llamando a initializeAuthAndApp...");
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

    const authElements = {authContainer, appContainer, loginForm, signupForm, loginEmailInput, loginPasswordInput, signupEmailInput, signupPasswordInput, loginButton, signupButton, showSignupLink, showLoginLink, loginErrorDiv, signupErrorDiv, userDisplaySpan, logoutButton};
    for (const elName in authElements) {
        if (!authElements[elName]) {
            console.error(`DEBUG: initializeAuthAndApp - Elemento Auth NO encontrado: ${elName}`);
            alert(`Error crítico: Falta el elemento de UI para autenticación: ${elName}`);
            return; 
        }
    }
    console.log("DEBUG: initializeAuthAndApp - Elementos Auth DOM seleccionados correctamente.");

    const auth = window.auth;
    const createUserWithEmailAndPassword = window.createUserWithEmailAndPassword;
    const signInWithEmailAndPassword = window.signInWithEmailAndPassword;
    const signOut = window.signOut;
    const onAuthStateChanged = window.onAuthStateChanged;

    if (!auth || !onAuthStateChanged) {
        console.error("DEBUG: initializeAuthAndApp - Error crítico: Firebase Auth o onAuthStateChanged no están disponibles.");
        alert("Error crítico: Problema al cargar Firebase Auth.");
        return;
    }
    console.log("DEBUG: initializeAuthAndApp - Funciones de Firebase Auth disponibles.");

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
    
    console.log("DEBUG: initializeAuthAndApp - Suscribiendo onAuthStateChanged listener...");
    onAuthStateChanged(auth, async (user) => { 
        console.log("DEBUG: onAuthStateChanged - CALLBACK EJECUTADO. User object:", user ? user.uid : null); 
        if (user) {
            currentUserId = user.uid; 
            console.log("DEBUG: onAuthStateChanged - Usuario ESTÁ autenticado. UID:", currentUserId, "Email:", user.email);
            document.body.classList.remove('logged-out'); document.body.classList.add('logged-in');
            authContainer.style.display = 'none'; appContainer.style.display = 'flex'; 
            userDisplaySpan.textContent = `${user.email || 'Usuario'}`;
            
            await loadUserVocabularyFromFirestore(currentUserId); 

            if (!window.dictationAppInitialized) {
                console.log("DEBUG: onAuthStateChanged - Llamando a initializeDictationAppLogic para el usuario:", currentUserId);
                initializeDictationAppLogic(currentUserId); 
                window.dictationAppInitialized = true;
            } else {
                console.log("DEBUG: onAuthStateChanged - App de dictado ya inicializada. Refrescando estado inicial de botones.");
                if (typeof updateButtonStates === "function") updateButtonStates("initial"); 
            }
        } else {
            currentUserId = null; 
            customVocabulary = {}; 
            learnedCorrections = {};
            commonMistakeNormalization = {};
            console.log("DEBUG: onAuthStateChanged - Usuario NO está autenticado o sesión cerrada.");
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
    console.log("DEBUG: initializeAuthAndApp - onAuthStateChanged listener suscrito.");

    function getFirebaseErrorMessage(error) {
        switch (error.code) {
            case 'auth/invalid-email': return 'El formato del email no es válido.';
            case 'auth/user-disabled': return 'Esta cuenta de usuario ha sido deshabilitada.';
            case 'auth/user-not-found': return 'No se encontró usuario con este email.';
            case 'auth/wrong-password': return 'La contraseña es incorrecta.';
            case 'auth/email-already-in-use': return 'Este email ya está registrado.';
            case 'auth/weak-password': return 'La contraseña es demasiado débil.';
            default: return error.message || "Error desconocido de autenticación.";
        }
    }
} 

function initializeDictationAppLogic(userId) {
    console.log(`DEBUG: initializeDictationAppLogic para usuario: ${userId} - Asignando listeners.`);
    
    if (!startRecordBtn.dataset.listenerAttached) { 
        startRecordBtn.addEventListener('click', () => {
            if (isProcessingClick) { console.warn("DEBUG: startRecordBtn - Clic ignorado (debouncing)"); return; }
            isProcessingClick = true;
            toggleRecordingState();
            setTimeout(() => { isProcessingClick = false; }, CLICK_DEBOUNCE_MS);
        });
        startRecordBtn.dataset.listenerAttached = 'true';
    }
    if (!pauseResumeBtn.dataset.listenerAttached) { 
        pauseResumeBtn.addEventListener('click', () => {
            if (isProcessingClick) { console.warn("DEBUG: pauseResumeBtn - Clic ignorado (debouncing)"); return; }
            isProcessingClick = true;
            handlePauseResume();
            setTimeout(() => { isProcessingClick = false; }, CLICK_DEBOUNCE_MS);
        }); 
        pauseResumeBtn.dataset.listenerAttached = 'true';
    }
    if (!retryProcessBtn.dataset.listenerAttached) { retryProcessBtn.addEventListener('click', () => { if (currentAudioBlob) { if (isRecording || isPaused) { alert("Detén la grabación actual antes de reenviar."); return; } processAudioBlobAndInsertText(currentAudioBlob); }}); retryProcessBtn.dataset.listenerAttached = 'true';}
    if (!copyPolishedTextBtn.dataset.listenerAttached) { 
        copyPolishedTextBtn.addEventListener('click', () => copyFullReportToClipboard(true));
        copyPolishedTextBtn.dataset.listenerAttached = 'true';
    }
    if (resetReportBtn && !resetReportBtn.dataset.listenerAttached) {
        resetReportBtn.addEventListener('click', () => {
            if (headerArea.value.trim() === '' && polishedTextarea.value.trim() === '') {
                setStatus("El informe ya está vacío.", "idle", 2000);
                return;
            }
            if (confirm('¿Estás seguro de que quieres borrar TODO el informe y la técnica? Esta acción no se puede deshacer.')) {
                headerArea.value = '';
                polishedTextarea.value = '';
                copyFullReportToClipboard(false); 
                setStatus('Informe reseteado.', 'success', 2000);
            }
        });
        resetReportBtn.dataset.listenerAttached = 'true';
    }
    if (juanizarBtn && !juanizarBtn.dataset.listenerAttached) {
        juanizarBtn.addEventListener('click', () => {
            const textToJuanize = polishedTextarea.value.trim();
            if (!textToJuanize) {
                alert('No hay texto en el informe para analizar. Por favor, dicte algo primero.');
                return;
            }
            localStorage.setItem('juanizadorInputText', textToJuanize);
            const currentTheme = document.body.getAttribute('data-theme') || 'dark';
            localStorage.setItem('sharedThemePreference', currentTheme);
            window.location.href = 'juanizador.html';
        });
        juanizarBtn.dataset.listenerAttached = 'true';
    }
    if (correctTextSelectionBtn && !correctTextSelectionBtn.dataset.listenerAttached) { correctTextSelectionBtn.addEventListener('click', handleCorrectTextSelection); correctTextSelectionBtn.dataset.listenerAttached = 'true';}
    if (techniqueButtonsContainer && !techniqueButtonsContainer.dataset.listenerAttached) { 
        techniqueButtonsContainer.addEventListener('click', (e) => { 
            if (e.target.tagName === 'BUTTON' && e.target.dataset.techniqueText) { 
                headerArea.value = e.target.dataset.techniqueText; 
                headerArea.focus(); 
                updateCopyButtonState();
            }
        }); 
        techniqueButtonsContainer.dataset.listenerAttached = 'true';
    }
    if (clearHeaderButton && !clearHeaderButton.dataset.listenerAttached) { 
        clearHeaderButton.addEventListener('click', () => { 
            headerArea.value = ""; 
            headerArea.focus();
            updateCopyButtonState();
        }); 
        clearHeaderButton.dataset.listenerAttached = 'true';
    }
    if (headerArea && !headerArea.dataset.syncListener) {
        headerArea.addEventListener('input', updateCopyButtonState);
        headerArea.dataset.syncListener = 'true';
    }
    if (polishedTextarea && !polishedTextarea.dataset.syncListener) {
        polishedTextarea.addEventListener('input', updateCopyButtonState);
        polishedTextarea.dataset.syncListener = 'true';
    }
    
    if (manageVocabButton && !manageVocabButton.dataset.listenerAttached) { manageVocabButton.addEventListener('click', openVocabManager); manageVocabButton.dataset.listenerAttached = 'true'; manageVocabButton.disabled = false; }
    if (modalCloseButtonVocab && !modalCloseButtonVocab.dataset.listenerAttached) { modalCloseButtonVocab.addEventListener('click', closeVocabManager); modalCloseButtonVocab.dataset.listenerAttached = 'true'; }
    if (modalAddNewRuleButtonVocab && !modalAddNewRuleButtonVocab.dataset.listenerAttached) { modalAddNewRuleButtonVocab.addEventListener('click', handleAddNewVocabRule); modalAddNewRuleButtonVocab.dataset.listenerAttached = 'true'; }
    if (vocabManagerModal && !vocabManagerModal.dataset.listenerAttached) { vocabManagerModal.addEventListener('click', (e) => { if (e.target === vocabManagerModal) closeVocabManager(); }); vocabManagerModal.dataset.listenerAttached = 'true'; }
    
    if (!document.body.dataset.keydownListenerAttached) { 
        document.addEventListener('keydown', function(event) {
            if (event.shiftKey && (event.metaKey || event.ctrlKey) && event.key === 'Shift') {
                event.preventDefault(); 
                if (document.body.classList.contains('logged-in') && startRecordBtn && !startRecordBtn.disabled) {
                    if (isProcessingClick) { return; }
                    isProcessingClick = true; toggleRecordingState(); 
                    setTimeout(() => { isProcessingClick = false; }, CLICK_DEBOUNCE_MS); 
                }
            }
            else if (event.shiftKey && event.altKey && event.key.toUpperCase() === 'P') { 
                event.preventDefault();
                if (document.body.classList.contains('logged-in') && pauseResumeBtn && !pauseResumeBtn.disabled) {
                    if (isProcessingClick) { return; }
                    isProcessingClick = true; handlePauseResume(); 
                    setTimeout(() => { isProcessingClick = false; }, CLICK_DEBOUNCE_MS);
                }
            }
        });
        document.body.dataset.keydownListenerAttached = 'true'; 
    }
    
    updateButtonStates("initial"); 
    updateCopyButtonState();
} 

function getCombinedText() {
    if (!headerArea || !polishedTextarea) return "";
    const h = headerArea.value.trim();
    const r = polishedTextarea.value.trim();
    let text = "";
    if (h) text += h;
    if (r) {
        if (text) text += "\n\n";
        text += r;
    }
    return text;
}

function updateCopyButtonState() {
    if (!copyPolishedTextBtn) return;
    const currentText = getCombinedText();
    const isSynced = (currentText === lastCopiedText);

    if (isSynced) {
        copyPolishedTextBtn.classList.add('synced');
        copyPolishedTextBtn.textContent = '✓ Copiado';
        copyPolishedTextBtn.title = 'El contenido está en el portapapeles.';
    } else {
        copyPolishedTextBtn.classList.remove('synced');
        copyPolishedTextBtn.textContent = 'Copiar Todo';
        copyPolishedTextBtn.title = 'Copiar texto completo';
    }
}

async function copyFullReportToClipboard(showStatus = false) {
    const textToCopy = getCombinedText();

    try {
        await navigator.clipboard.writeText(textToCopy);
        lastCopiedText = textToCopy;
        updateCopyButtonState();
        if (showStatus) {
            setStatus("¡Texto copiado!", "success", 2000);
        }
    } catch (e) {
        console.error('Error al copiar el texto:', e);
        updateCopyButtonState();
        if (showStatus) {
            setStatus("Error al copiar el texto.", "error", 3000);
        }
    }
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
async function startActualRecording() { 
    console.log("DEBUG startActualRecording: polishedTextarea.selectionStart =", polishedTextarea.selectionStart, "polishedTextarea.selectionEnd =", polishedTextarea.selectionEnd);
    if (polishedTextarea.selectionStart !== polishedTextarea.selectionEnd) {
        isDictatingForReplacement = true;
        replacementSelectionStart = polishedTextarea.selectionStart;
        replacementSelectionEnd = polishedTextarea.selectionEnd;
        console.log("DEBUG startActualRecording: MODO REEMPLAZO ACTIVADO. Selección de", replacementSelectionStart, "a", replacementSelectionEnd);
        setStatus("Dicte el reemplazo...", "processing");
    } else {
        isDictatingForReplacement = false;
        insertionPoint = polishedTextarea.selectionStart; 
        console.log("DEBUG startActualRecording: MODO INSERCIÓN/AÑADIR. Punto de inserción:", insertionPoint);
        setStatus("Solicitando permiso...", "processing");
    }
    isPaused = false; audioChunks = []; currentAudioBlob = null; recordingSeconds = 0; 
    audioPlaybackSection.style.display = 'none'; 
    if (audioPlayback.src) { URL.revokeObjectURL(audioPlayback.src); audioPlayback.src = ''; audioPlayback.removeAttribute('src');}
    if (!userApiKey) { alert('API Key?'); setStatus("Error Key","error"); updateButtonStates("initial"); isDictatingForReplacement = false; return; } 
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        isRecording = true; setupVolumeMeter(stream); startRecordingTimer(); 
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        window.currentMediaRecorder = mediaRecorder; 
        mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
        mediaRecorder.onpause = () => { setStatus(isDictatingForReplacement ? 'Reemplazo pausado.' : 'Dictado pausado.', 'idle'); isPaused = true; volumeMeterBar.classList.add('paused'); volumeMeterBar.style.background = 'var(--button-default-bg)'; updateButtonStates("paused"); };
        mediaRecorder.onresume = () => { setStatus(isDictatingForReplacement ? 'Dictando reemplazo...' : 'Grabando... (Reanudado)', 'processing'); isPaused = false; volumeMeterBar.classList.remove('paused'); volumeMeterBar.style.background = 'var(--volume-bar-gradient)'; updateButtonStates("recording"); };
        mediaRecorder.onstop = async () => {
            isRecording = false; isPaused = false; 
            stopVolumeMeter(); stopRecordingTimer(); 
            setStatus('Grabación detenida. Procesando...', 'processing');
            if (audioChunks.length === 0) { setStatus("No audio.", "error", 3000); updateButtonStates("stopped_error"); isDictatingForReplacement = false; return; }
            currentAudioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            if (currentAudioBlob.size === 0) { setStatus("Audio vacío.", "error", 3000); updateButtonStates("stopped_error"); isDictatingForReplacement = false; return; }
            const audioURL = URL.createObjectURL(currentAudioBlob);
            audioPlayback.src = audioURL; 
            await processAudioBlobAndInsertText(currentAudioBlob);
        };
        mediaRecorder.onerror = e => { isRecording = false; isPaused = false; isDictatingForReplacement = false; stopVolumeMeter(); stopRecordingTimer(); resetRecordingTimerDisplay(); setStatus(`Error MediaRec: ${e.error.name}`, "error", 4000); updateButtonStates("error"); };
        mediaRecorder.start();
        if (isDictatingForReplacement) {
             setStatus('Dicte el reemplazo...', "processing");
        } else {
             if (statusDiv.textContent.toLowerCase() !== 'solicitando permiso...') {
                setStatus('Grabando...', "processing"); 
             }
        }
        updateButtonStates("recording");      
    } catch (e) {
        isRecording = false; isPaused = false; isDictatingForReplacement = false;
        stopVolumeMeter(); stopRecordingTimer(); resetRecordingTimerDisplay();
        setStatus(`Error Mic: ${e.message}.`, "error", 4000);
        updateButtonStates("initial");
    }
}
async function processAudioBlobAndInsertText(audioBlob) {
    updateButtonStates("processing_audio"); 
    console.log("DEBUG processAudioBlobAndInsertText: isDictatingForReplacement =", isDictatingForReplacement);
    try {
        const base64Audio = await blobToBase64(audioBlob);
        if (!base64Audio || base64Audio.length < 100) throw new Error("Fallo Base64.");
        
        let processedNewText = await transcribeAndPolishAudio(base64Audio); 
        console.log("DEBUG processAudioBlobAndInsertText: Texto recibido de transcribeAndPolishAudio:", JSON.stringify(processedNewText.substring(0,100) + "..."));

        const currentContent = polishedTextarea.value; 

        if (isDictatingForReplacement) {
            console.log("DEBUG processAudioBlobAndInsertText: Ejecutando lógica de REEMPLAZO DE SELECCIÓN.");
            const textBeforeSelection = currentContent.substring(0, replacementSelectionStart);
            const textAfterSelection = currentContent.substring(replacementSelectionEnd);
            
            if (processedNewText.length > 0) {
                const charBefore = textBeforeSelection.trim().slice(-1); 
                const needsCapital = replacementSelectionStart === 0 || charBefore === '.' || charBefore === '!' || charBefore === '?' || textBeforeSelection.trim().endsWith('\n');
                if (needsCapital) {
                    processedNewText = processedNewText.charAt(0).toUpperCase() + processedNewText.slice(1);
                } else {
                    if (processedNewText.charAt(0) === processedNewText.charAt(0).toUpperCase() && processedNewText.charAt(0) !== processedNewText.charAt(0).toLowerCase()) { 
                        processedNewText = processedNewText.charAt(0).toLowerCase() + processedNewText.slice(1);
                    }
                }
            }
            
            let smartSpaceBefore = "";
            if (textBeforeSelection.length > 0 && !/\s$/.test(textBeforeSelection) && processedNewText.length > 0 && !/^\s/.test(processedNewText) && !/^[,.;:!?)]/.test(processedNewText)) { smartSpaceBefore = " "; }
            let smartSpaceAfter = "";
            if (textAfterSelection.length > 0 && !/^\s/.test(textAfterSelection) && processedNewText.length > 0 && !/\s$/.test(processedNewText) && !/[([{]$/.test(processedNewText)) { smartSpaceAfter = " "; }
            
            polishedTextarea.value = textBeforeSelection + smartSpaceBefore + processedNewText + smartSpaceAfter + textAfterSelection;
            const newCursorPos = replacementSelectionStart + smartSpaceBefore.length + processedNewText.length;
            polishedTextarea.selectionStart = polishedTextarea.selectionEnd = newCursorPos;
            setStatus('Texto reemplazado.', 'success', 3000);
        } else { 
            console.log("DEBUG processAudioBlobAndInsertText: Ejecutando lógica de INSERCIÓN/AÑADIR en el punto:", insertionPoint);
            const textBeforeCursor = currentContent.substring(0, insertionPoint);
            const textAfterCursor = currentContent.substring(insertionPoint);

            if (processedNewText.length > 0) {
                const charBefore = textBeforeCursor.trim().slice(-1);
                const needsCapital = insertionPoint === 0 || charBefore === '.' || charBefore === '!' || charBefore === '?' || textBeforeCursor.trim().endsWith('\n');
                if (needsCapital) {
                    processedNewText = processedNewText.charAt(0).toUpperCase() + processedNewText.slice(1);
                } else {
                     if (processedNewText.charAt(0) === processedNewText.charAt(0).toUpperCase() && processedNewText.charAt(0) !== processedNewText.charAt(0).toLowerCase()) { 
                        processedNewText = processedNewText.charAt(0).toLowerCase() + processedNewText.slice(1);
                    }
                }
            }

            let smartSpaceBefore = "";
            if (textBeforeCursor.length > 0 && !/\s$/.test(textBeforeCursor) && processedNewText.length > 0 && !/^\s/.test(processedNewText) && !/^[,.;:!?)]/.test(processedNewText) ) {
                smartSpaceBefore = " ";
            }
             let smartSpaceAfter = "";
            if (textAfterCursor.length > 0 && !/^\s/.test(textAfterCursor) && processedNewText.length > 0 && !/\s$/.test(processedNewText) && !/[([{]$/.test(processedNewText)) {
                smartSpaceAfter = " ";
            }

            polishedTextarea.value = textBeforeCursor + smartSpaceBefore + processedNewText + smartSpaceAfter + textAfterCursor;
            const newCursorPos = insertionPoint + smartSpaceBefore.length + processedNewText.length;
            polishedTextarea.selectionStart = polishedTextarea.selectionEnd = newCursorPos;
            setStatus('Texto insertado/añadido.', 'success', 3000);
        }
        updateCopyButtonState(); 
        updateButtonStates("success_processing");
    } catch (error) {
        console.error('Error en processAudioBlobAndInsertText:', error);
        setStatus(`Error Proc: ${error.message}`, "error", 4000);
        if (!isDictatingForReplacement && !currentContent) { 
             polishedTextarea.value = `Error: ${error.message}`; 
        }
        updateButtonStates("error_processing"); 
    } finally {
        isDictatingForReplacement = false; 
    }
}
function handlePauseResume() { if(!mediaRecorder||!isRecording)return;if(mediaRecorder.state==="recording"){mediaRecorder.pause();}else if(mediaRecorder.state==="paused"){mediaRecorder.resume();}}
function updateButtonStates(state) { startRecordBtn.disabled=true;pauseResumeBtn.disabled=true;retryProcessBtn.disabled=true;copyPolishedTextBtn.disabled=false;correctTextSelectionBtn.disabled=true;startRecordBtn.textContent="Empezar Dictado";startRecordBtn.classList.remove("stop-style");pauseResumeBtn.textContent="Pausar";let showPlayer=false;if(currentAudioBlob){if(["initial","stopped_success","error_processing","success_processing","stopped_error"].includes(state)){showPlayer=true;}}if(audioPlaybackSection)audioPlaybackSection.style.display=showPlayer?'block':'none';else console.warn("audioPlaybackSection null en updateButtonStates");switch(state){case "initial":startRecordBtn.disabled=false;if(statusDiv&&statusDiv.textContent.toLowerCase()!=="listo"&&!statusDiv.textContent.toLowerCase().includes("error")&&!statusDiv.textContent.toLowerCase().includes("pausada")&&!statusDiv.textContent.toLowerCase().includes("reemplazo"))setStatus("Listo","idle");resetRecordingTimerDisplay();stopVolumeMeter();retryProcessBtn.disabled=!currentAudioBlob;correctTextSelectionBtn.disabled=polishedTextarea.value.trim()==="";break;case "recording":startRecordBtn.disabled=false;startRecordBtn.textContent=isDictatingForReplacement?"Detener Reemplazo":"Detener Dictado";startRecordBtn.classList.add("stop-style");pauseResumeBtn.disabled=false;retryProcessBtn.disabled=true;correctTextSelectionBtn.disabled=true;if(!isDictatingForReplacement&&statusDiv.textContent.toLowerCase()!=='grabando...'&&statusDiv.textContent.toLowerCase()!=='dicte el reemplazo...')setStatus('Grabando...','processing');break;case "paused":startRecordBtn.disabled=false;startRecordBtn.textContent=isDictatingForReplacement?"Detener Reemplazo":"Detener Dictado";startRecordBtn.classList.add("stop-style");pauseResumeBtn.disabled=false;pauseResumeBtn.textContent="Reanudar";retryProcessBtn.disabled=true;correctTextSelectionBtn.disabled=polishedTextarea.value.trim()==="";if(!isDictatingForReplacement&&statusDiv.textContent.toLowerCase()!=='reemplazo pausado.'&&statusDiv.textContent.toLowerCase()!=='dictado pausado.')setStatus('Grabación pausada.','idle');break;case "stopped_success":startRecordBtn.disabled=false;retryProcessBtn.disabled=!currentAudioBlob;correctTextSelectionBtn.disabled=polishedTextarea.value.trim()==="";break;case "stopped_error":startRecordBtn.disabled=false;resetRecordingTimerDisplay();stopVolumeMeter();retryProcessBtn.disabled=!currentAudioBlob;correctTextSelectionBtn.disabled=true;break;case "processing_audio":startRecordBtn.disabled=true;pauseResumeBtn.disabled=true;retryProcessBtn.disabled=true;correctTextSelectionBtn.disabled=true;break;case "error_processing":startRecordBtn.disabled=false;retryProcessBtn.disabled=!currentAudioBlob;correctTextSelectionBtn.disabled=polishedTextarea.value.trim()==="";break;case "success_processing":startRecordBtn.disabled=false;retryProcessBtn.disabled=!currentAudioBlob;correctTextSelectionBtn.disabled=polishedTextarea.value.trim()==="";break;case "error":startRecordBtn.disabled=false;resetRecordingTimerDisplay();stopVolumeMeter();retryProcessBtn.disabled=!currentAudioBlob;correctTextSelectionBtn.disabled=true;break;default:startRecordBtn.disabled=false;resetRecordingTimerDisplay();stopVolumeMeter();retryProcessBtn.disabled=!currentAudioBlob;correctTextSelectionBtn.disabled=polishedTextarea.value.trim()==="";break;}}
async function handleCorrectTextSelection(){if(!polishedTextarea)return;const sS=polishedTextarea.selectionStart;const sE=polishedTextarea.selectionEnd;const sT=polishedTextarea.value.substring(sS,sE).trim();if(!sT){setStatus("Selecciona texto.","idle",3000);return;}const cTU=prompt(`Corregir:\n"${sT}"\n\nCorrección:` ,sT);if(cTU===null){setStatus("Cancelado.","idle",2000);return;}const fCT=cTU.trim();const ruleKey = sT.toLowerCase(); if(sT.toLowerCase()===fCT.toLowerCase()&&sT!==fCT){}else if(sT.toLowerCase()!==fCT.toLowerCase()||fCT==="" || !customVocabulary.hasOwnProperty(ruleKey) || customVocabulary[ruleKey] !== fCT ){customVocabulary[ruleKey]=fCT;await saveUserVocabularyToFirestore();setStatus(`Regla guardada: "${ruleKey}"➔"${fCT}"`,"success",3000);}else{setStatus("No cambios para guardar.","idle",2000);}const tB=polishedTextarea.value.substring(0,sS);const tA=polishedTextarea.value.substring(sE);polishedTextarea.value=tB+fCT+tA;polishedTextarea.selectionStart=polishedTextarea.selectionEnd=sS+fCT.length;updateCopyButtonState();polishedTextarea.focus();}
function blobToBase64(b){return new Promise((res,rej)=>{if(!b||b.size===0)return rej(new Error("Blob nulo"));const r=new FileReader();r.onloadend=()=>{if(r.result){const s=r.result.toString().split(',')[1];if(!s)return rej(new Error("Fallo Base64"));res(s);}else rej(new Error("FileReader sin resultado"));};r.onerror=e=>rej(e);r.readAsDataURL(b);});}
function cleanupArtifacts(text) {
    if (!text || typeof text !== 'string') return text || "";
    let cleanedText = text;
    let trimmedForQuotesCheck = cleanedText.trim(); 
    if (trimmedForQuotesCheck.startsWith('"') && trimmedForQuotesCheck.endsWith('"') && trimmedForQuotesCheck.length > 2) {
        cleanedText = trimmedForQuotesCheck.substring(1, trimmedForQuotesCheck.length - 1).trim();
    }
    cleanedText = cleanedText.replace(/(\s[pP])+[ \t]*$/gm, ""); 
    cleanedText = cleanedText.replace(/[pP]{2,}[ \t]*$/gm, "");   
    cleanedText = cleanedText.replace(/\s+[pP][\s.]*$/gm, ""); 
    const trimmedTextForPunctuationCheck = cleanedText.trim(); 
    const wordCount = trimmedTextForPunctuationCheck.split(/\s+/).filter(Boolean).length;
    if (wordCount > 0 && wordCount <= 5) { 
        if (trimmedTextForPunctuationCheck.endsWith('.') && 
            !trimmedTextForPunctuationCheck.endsWith('..') && 
            !trimmedTextForPunctuationCheck.endsWith('...') && 
            (trimmedTextForPunctuationCheck.length === 1 || (trimmedTextForPunctuationCheck.length > 1 && trimmedTextForPunctuationCheck.charAt(trimmedTextForPunctuationCheck.length - 2) !== '.'))) {
            if (trimmedTextForPunctuationCheck.length <= 1 || !/[.!?]$/.test(trimmedTextForPunctuationCheck.substring(0, trimmedTextForPunctuationCheck.length -1).trim())) {
                cleanedText = trimmedTextForPunctuationCheck.slice(0, -1);
            }
        }
    }
    cleanedText = cleanedText.replace(/\n+$/, "");
    cleanedText = cleanedText.replace(/\s+([.!?])$/, "$1");
    cleanedText = cleanedText.replace(/ +/g, ' ');
    return cleanedText.trim(); 
}
function capitalizeSentencesProperly(text) {
    if (!text || typeof text !== 'string' || text.trim() === "") {
        return text || ""; 
    }
    let processedText = text.trim();
    // Capitalize the very first letter of the entire text
    processedText = processedText.charAt(0).toUpperCase() + processedText.slice(1);
    // Capitalize after a sentence-ending punctuation mark followed by whitespace
    processedText = processedText.replace(
        /([.!?\n])(\s+)([a-záéíóúüñ])/g, 
        (match, punctuation, whitespace, letter) => {
            return punctuation + whitespace + letter.toUpperCase();
        }
    );
    return processedText;
}

// ==============================================================================
// === REEMPLAZA SOLO ESTA FUNCIÓN EN script.js (VERSIÓN 6.0 - MÉTODO DE LIMPIEZA) ===
// ==============================================================================

/**
 * VERSIÓN 6.0 - MÉTODO DE LIMPIEZA: Aplica reglas de puntuación de forma determinista.
 * Este método primero aplica todas las reglas y luego limpia los resultados incorrectos.
 * @param {string} text - El texto transcrito literalmente.
 * @returns {string} - El texto con la puntuación corregida y formateada.
 */
function applyPunctuationRules(text) {
    if (!text) return "";

    let processedText = ` ${text} `;

    // --- PASO 1: Reemplazo simple y directo. Aceptamos que creará duplicados. ---
    processedText = processedText.replace(/\bpunto y aparte\b/gi, '.\n');
    processedText = processedText.replace(/\bpunto y seguido\b/gi, '.');
    processedText = processedText.replace(/\bpunto\b/gi, '.');
    processedText = processedText.replace(/\bcoma\b/gi, ',');
    processedText = processedText.replace(/\bnueva línea\b/gi, '\n');
    processedText = processedText.replace(/\bdos puntos\b/gi, ':');
    processedText = processedText.replace(/\bpunto y coma\b/gi, ';');
    processedText = processedText.replace(/\binterrogación\b/gi, '?');
    processedText = processedText.replace(/\bexclamación\b/gi, '!');

    // --- PASO 2: Limpieza exhaustiva de patrones incorrectos. ---
    // Esta es la parte clave. Limpiamos cualquier combinación de signos.
    // Ej: ",." -> "." | ", ." -> "." | ".." -> "." | ".\n" -> ".\n" (correcto)
    
    // Quitar comas o puntos antes de un punto final o salto de línea.
    processedText = processedText.replace(/([,.]\s*)(?=[.\n])/g, '');

    // Limpiar dobles puntos o combinaciones de punto y coma.
    processedText = processedText.replace(/\.{2,}/g, '.'); // ".." o "..." se convierte en "."
    processedText = processedText.replace(/,+/g, ',');   // ",," se convierte en ","
    processedText = processedText.replace(/;+/g, ';');   // ";;" se convierte en ";"
    
    // --- PASO 3: Formateo final del espaciado. ---
    // Elimina espacios ANTES de los signos de puntuación.
    processedText = processedText.replace(/\s+([.,:;!?\n])/g, '$1');
    
    // Asegura un espacio DESPUÉS de la puntuación, si no es un salto de línea.
    processedText = processedText.replace(/([.,:;!?])([a-zA-ZáéíóúüñÁÉÍÓÚÑ])/g, '$1 $2');
    
    // Elimina dobles saltos de línea.
    processedText = processedText.replace(/\n\s*\n/g, '\n');

    // Elimina dobles espacios.
    processedText = processedText.replace(/ {2,}/g, ' ');

    return processedText.trim();
}
/**
 * VERSIÓN MEJORADA CON LOGS: Llama a la API de Gemini.
 * @param {string} modelName - El nombre del modelo a usar.
 * @param {Array} promptParts - Las partes del prompt.
 * @param {boolean} isTextPrompt - Si es un prompt de solo texto.
 * @returns {Promise<string>} - La respuesta de la API.
 */
async function callGeminiAPI(modelName, promptParts, isTextPrompt = false) {
    if (!userApiKey) throw new Error('No se encontró la API Key del usuario.');
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${userApiKey}`;
    const temperature = isTextPrompt ? 0.2 : 0.3;

    const payload = {
        contents: [{ parts: promptParts }],
        generationConfig: { temperature: temperature },
    };

    console.log(`%c[API Call] Enviando a ${modelName} (Temp: ${temperature})`, 'color: #888;', { prompt: JSON.stringify(promptParts).substring(0, 400) + '...' });

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("[API Error] Respuesta no OK:", errorData);
        throw new Error(`Error de la API: ${errorData.error?.message || response.statusText} (${response.status})`);
    }

    const data = await response.json();
    
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text;
    }
    
    if (data.promptFeedback?.blockReason) throw new Error(`Prompt bloqueado: ${data.promptFeedback.blockReason}.`);
    if (data.candidates?.[0]?.finishReason !== "STOP") throw new Error(`Generación incompleta: ${data.candidates[0].finishReason}.`);
    
    return ""; // Respuesta vacía es válida
}


/**
 * VERSIÓN 4.0 CON FLUJO CORREGIDO: Proceso completo de transcripción y pulido.
 * @param {string} base64Audio - El audio codificado en Base64.
 * @returns {Promise<string>} - El texto final procesado.
 */
async function transcribeAndPolishAudio(base64Audio) {
    console.groupCollapsed(`[Proceso de Dictado] ${new Date().toLocaleTimeString()}`);
    
    // --- PASO 1: Transcripción Literal ---
    let transcribedText = '';
    try {
        setStatus('Transcribiendo...', 'processing');
        const transcriptPromptParts = [
            { text: "Transcribe el siguiente audio a texto con la MÁXIMA LITERALIDAD POSIBLE. Transcribe palabras como 'punto', 'coma', 'punto y aparte' como texto, no como signos de puntuación. El objetivo es una transcripción fiel palabra por palabra, incluyendo los signos de puntuación que el hablante dicte (ej. si dice una coma, transcribe ',')." },
            { inline_data: { mime_type: "audio/webm", data: base64Audio } }
        ];
        transcribedText = await callGeminiAPI('gemini-2.0-flash-lite', transcriptPromptParts, false);
        console.log("%c[PASO 1] Transcripción literal recibida:", "font-weight: bold; color: blue;", JSON.stringify(transcribedText));
    } catch (e) {
        console.error("Error en la transcripción:", e);
        console.groupEnd();
        throw new Error(`Fallo en la transcripción: ${e.message}`);
    }
    
    // --- PASO 2: Pulido de Ortografía y Gramática (IA) ---
    let polishedByAI = '';
    try {
        setStatus('Puliendo...', 'processing');
        const polishPromptParts = [{
            text: `Por favor, revisa el siguiente texto. Tu única tarea es corregir errores ortográficos y gramaticales objetivos.
            - NO cambies la elección de palabras.
            - NO reestructures frases.
            - CRUCIAL: Mantén las palabras de puntuación (como "punto", "coma", "punto y aparte") y los signos de puntuación (como ",") EXACTAMENTE como están. No los conviertas ni los elimines.
            
            Texto a procesar:
            "${transcribedText}"`
        }];
        
        polishedByAI = await callGeminiAPI('gemini-2.0-flash-lite', polishPromptParts, true);
        console.log("%c[PASO 2] Texto pulido por IA:", "font-weight: bold; color: purple;", JSON.stringify(polishedByAI));
    } catch (e) {
        console.error("Error en el pulido por IA:", e);
        setStatus(`Fallo en pulido. Usando transcripción original.`, "error", 4000);
        polishedByAI = transcribedText;
    }

    // --- PASO 3: Aplicar Puntuación con Reglas (Determinista) ---
    const textWithPunctuation = applyPunctuationRules(polishedByAI);
    console.log("%c[PASO 3] Texto después de aplicar reglas de puntuación (JS):", "font-weight: bold; color: green;", JSON.stringify(textWithPunctuation));

    // --- PASO 4: Limpiezas y Capitalización Finales ---
    let finalProcessing = cleanupArtifacts(textWithPunctuation);
    console.log("%c[PASO 4.1] Después de limpieza de artefactos:", "font-weight: bold; color: orange;", JSON.stringify(finalProcessing));
    
    finalProcessing = capitalizeSentencesProperly(finalProcessing);
    console.log("%c[PASO 4.2] Después de capitalización:", "font-weight: bold; color: orange;", JSON.stringify(finalProcessing));
    
    finalProcessing = applyAllUserCorrections(finalProcessing);
    console.log("%c[PASO 4.3] Después de correcciones de usuario:", "font-weight: bold; color: orange;", JSON.stringify(finalProcessing));
    
    console.log("%c[PASO FINAL] Texto listo para insertar:", "font-weight: bold; color: red;", JSON.stringify(finalProcessing));
    
    console.groupEnd();
    return finalProcessing;
}

// ==============================================================================
// === FIN DEL BLOQUE DE CÓDIGO ACTUALIZADO ===
// ==============================================================================


async function loadUserVocabularyFromFirestore(userId) { if (!userId || !window.db) { customVocabulary = {}; learnedCorrections = {}; commonMistakeNormalization = {}; return; } console.log(`DEBUG: Cargando vocabulario (estilo index(2).html) para usuario: ${userId}`); const vocabDocRef = window.doc(window.db, "userVocabularies", userId); try { const docSnap = await window.getDoc(vocabDocRef); if (docSnap.exists()) { const firestoreData = docSnap.data(); customVocabulary = firestoreData.rulesMap || {}; learnedCorrections = firestoreData.learnedMap || {}; commonMistakeNormalization = firestoreData.normalizations || {}; console.log("DEBUG: Vocabulario cargado. Reglas:", Object.keys(customVocabulary).length, "Aprendidas:", Object.keys(learnedCorrections).length, "Normaliz.:", Object.keys(commonMistakeNormalization).length); } else { customVocabulary = {}; learnedCorrections = {}; commonMistakeNormalization = {}; console.log("DEBUG: No doc de vocabulario. Usando vacíos."); } } catch (error) { console.error("Error cargando vocabulario:", error); customVocabulary = {}; learnedCorrections = {}; commonMistakeNormalization = {}; setStatus("Error al cargar personalizaciones.", "error", 3000); } }
async function saveUserVocabularyToFirestore() { if (!currentUserId || !window.db) { console.error("DEBUG: No hay userId o DB para guardar vocabulario."); return; } const vocabToSaveForLog = JSON.parse(JSON.stringify(customVocabulary)); console.log(`DEBUG: Guardando vocabulario para ${currentUserId}. Contenido de customVocabulary (rulesMap) a guardar:`, vocabToSaveForLog); const vocabDocRef = window.doc(window.db, "userVocabularies", currentUserId); const dataToSave = { rulesMap: customVocabulary, learnedMap: learnedCorrections, normalizations: commonMistakeNormalization }; try { await window.setDoc(vocabDocRef, dataToSave); console.log("DEBUG: Vocabulario del usuario SOBRESCRITO en Firestore con el estado actual de los 3 mapas."); } catch (error) { console.error("Error guardando vocabulario del usuario:", error); setStatus("Error al guardar personalizaciones.", "error", 3000); } }
function applyAllUserCorrections(text) { if (!text) return ""; let processedText = text; if (Object.keys(customVocabulary).length > 0) { console.log("DEBUG: Aplicando vocabulario personalizado (rulesMap)..."); const sortedCustomKeys = Object.keys(customVocabulary).sort((a, b) => b.length - a.length); for (const errorKey of sortedCustomKeys) { const correctValue = customVocabulary[errorKey]; try { const regex = new RegExp(`\\b${escapeRegExp(errorKey)}\\b`, 'gi'); processedText = processedText.replace(regex, correctValue); } catch (e) { console.error(`Error regex (custom): "${errorKey}"`, e); } } } return processedText; }
function escapeRegExp(string) { return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function openVocabManager() { vocabManagerModal = vocabManagerModal || document.getElementById('vocabManagerModal'); if (!vocabManagerModal) { console.error("Modal de vocabulario no encontrado."); return; } populateVocabManagerList(); vocabManagerModal.style.display = 'flex'; }
function closeVocabManager() { vocabManagerModal = vocabManagerModal || document.getElementById('vocabManagerModal'); if (!vocabManagerModal) return; vocabManagerModal.style.display = 'none'; }
function populateVocabManagerList() { vocabManagerList = vocabManagerList || document.getElementById('vocabManagerList'); if (!vocabManagerList) { console.error("Lista del modal de vocabulario no encontrada."); return; } vocabManagerList.innerHTML = ''; const keys = Object.keys(customVocabulary).sort(); if (keys.length === 0) { vocabManagerList.innerHTML = '<li>No hay reglas personalizadas (rulesMap).</li>'; return; } keys.forEach(key => { const value = customVocabulary[key]; const listItem = document.createElement('li'); listItem.innerHTML = `<span class="vocab-key">${key}</span> <span class="vocab-arrow">➔</span> <span class="vocab-value">${value}</span> <div class="vocab-actions"><button class="edit-vocab-btn" data-key="${key}">Editar</button><button class="delete-vocab-btn" data-key="${key}">Borrar</button></div>`; listItem.querySelector('.edit-vocab-btn').addEventListener('click', () => handleEditVocabRule(key)); listItem.querySelector('.delete-vocab-btn').addEventListener('click', () => handleDeleteVocabRule(key)); vocabManagerList.appendChild(listItem); }); }
async function handleAddNewVocabRule() { const errorKeyRaw = prompt("Texto incorrecto (o palabra a reemplazar):"); if (!errorKeyRaw || errorKeyRaw.trim() === "") return; const errorKey = errorKeyRaw.trim().toLowerCase(); const correctValueRaw = prompt(`Corrección para "${errorKeyRaw}":`); if (correctValueRaw === null) return; const correctValue = correctValueRaw.trim(); if (customVocabulary[errorKey] === correctValue && correctValue !== "") { alert("Regla ya existe con el mismo valor."); return; } customVocabulary[errorKey] = correctValue; await saveUserVocabularyToFirestore(); populateVocabManagerList(); setStatus("Regla añadida/actualizada.", "success", 2000); }
async function handleEditVocabRule(keyToEdit) { console.log("DEBUG: handleEditVocabRule - Clave a editar:", keyToEdit, "Valor actual:", customVocabulary[keyToEdit]); const currentValue = customVocabulary[keyToEdit]; const newErrorKeyRaw = prompt(`Editar CLAVE (original: "${keyToEdit}"):\n(Dejar vacío para mantener la clave original)`, keyToEdit); if (newErrorKeyRaw === null) { console.log("DEBUG: handleEditVocabRule - Edición de clave cancelada."); return; } const newErrorKey = (newErrorKeyRaw.trim() === "" ? keyToEdit : newErrorKeyRaw.trim()).toLowerCase(); const newCorrectValueRaw = prompt(`Editar VALOR para "${newErrorKey}" (original: "${currentValue}"):\nIntroduce el nuevo valor correcto:`, currentValue); if (newCorrectValueRaw === null) { console.log("DEBUG: handleEditVocabRule - Edición de valor cancelada."); return; } const newCorrectValue = newCorrectValueRaw.trim(); if (newErrorKey !== keyToEdit && customVocabulary.hasOwnProperty(newErrorKey)) { alert(`La clave "${newErrorKey}" ya existe.`); console.warn("DEBUG: handleEditVocabRule - Intento de duplicar clave:", newErrorKey); return; } const oldCustomVocabularyState = JSON.parse(JSON.stringify(customVocabulary)); if (newErrorKey !== keyToEdit) { console.log(`DEBUG: handleEditVocabRule - Clave cambió. Borrando clave antigua: "${keyToEdit}"`); delete customVocabulary[keyToEdit]; } customVocabulary[newErrorKey] = newCorrectValue; console.log("DEBUG: handleEditVocabRule - customVocabulary ANTES de guardar:", oldCustomVocabularyState); console.log("DEBUG: handleEditVocabRule - customVocabulary DESPUÉS de modificar localmente:", customVocabulary); await saveUserVocabularyToFirestore(); populateVocabManagerList(); setStatus("Regla de vocabulario actualizada.", "success", 2000); }
async function handleDeleteVocabRule(keyToDelete) { console.log("DEBUG: handleDeleteVocabRule - Clave a borrar:", keyToDelete); if (confirm(`¿Estás seguro de que quieres borrar la regla para "${keyToDelete}"?`)) { const oldCustomVocabularyState = JSON.parse(JSON.stringify(customVocabulary)); delete customVocabulary[keyToDelete]; console.log("DEBUG: handleDeleteVocabRule - customVocabulary ANTES de guardar:", oldCustomVocabularyState); console.log("DEBUG: handleDeleteVocabRule - customVocabulary DESPUÉS de borrar localmente:", customVocabulary); await saveUserVocabularyToFirestore(); populateVocabManagerList(); setStatus("Regla de vocabulario borrada.", "success", 2000); } else { console.log("DEBUG: handleDeleteVocabRule - Borrado cancelado por el usuario."); } }

console.log("DEBUG: Script principal (fuera de DOMContentLoaded y firebaseReady) evaluado. Esperando firebaseReady...");
