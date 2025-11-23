// docs/app.js - Handles file/text reading, encryption, and link generation

let currentMode = 'file';

// --- Mode Switching Logic ---

function setMode(mode) {
    currentMode = mode;
    const fileModeDiv = document.getElementById('fileMode');
    const textModeDiv = document.getElementById('textMode');
    const fileModeBtn = document.getElementById('fileModeBtn');
    const textModeBtn = document.getElementById('textModeBtn');

    if (mode === 'file') {
        fileModeDiv.classList.remove('hidden');
        textModeDiv.classList.add('hidden');
        fileModeBtn.classList.add('bg-blue-500', 'text-white', 'shadow-md');
        fileModeBtn.classList.remove('text-gray-600', 'hover:bg-white');
        textModeBtn.classList.add('text-gray-600', 'hover:bg-white');
        textModeBtn.classList.remove('bg-blue-500', 'text-white', 'shadow-md');
    } else {
        fileModeDiv.classList.add('hidden');
        textModeDiv.classList.remove('hidden');
        textModeBtn.classList.add('bg-blue-500', 'text-white', 'shadow-md');
        textModeBtn.classList.remove('text-gray-600', 'hover:bg-white');
        fileModeBtn.classList.add('text-gray-600', 'hover:bg-white');
        fileModeBtn.classList.remove('bg-blue-500', 'text-white', 'shadow-md');
    }
}

// --- Drag and Drop Logic ---

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('fileInput');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const fileInstruction = document.getElementById('fileInstruction');

    // Trigger file input click when drop zone is clicked
    dropZone.addEventListener('click', () => {
        if (currentMode === 'file') {
            fileInput.click();
        }
    });

    // Update display when a file is selected via the traditional input
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            fileNameDisplay.textContent = fileInput.files[0].name;
            fileInstruction.classList.add('hidden');
        } else {
            fileNameDisplay.textContent = '';
            fileInstruction.classList.remove('hidden');
        }
    });

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Highlight drop zone when a file is dragged over
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });

    function highlight(e) {
        dropZone.classList.add('drag-over');
    }

    function unhighlight(e) {
        dropZone.classList.remove('drag-over');
    }

    // Handle dropped files
    dropZone.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        if (currentMode === 'file') {
            const dt = e.dataTransfer;
            const files = dt.files;

            if (files.length > 0) {
                fileInput.files = files; // Set the files to the file input element
                fileNameDisplay.textContent = files[0].name;
                fileInstruction.classList.add('hidden');
            }
        }
    }
});


// --- Main Encryption and Upload Function ---

async function encryptAndUpload() {
    const statusDiv = document.getElementById('statusMessage');
    const expirationMs = parseInt(document.getElementById('expiration').value);
    
    // Determine input based on current mode
    let contentToEncrypt;
    let passphrase;
    let fileName = null;

    if (currentMode === 'file') {
        const file = document.getElementById('fileInput').files[0];
        passphrase = document.getElementById('passphrase').value;

        if (!file || !passphrase) {
            statusDiv.innerHTML = '<span class="text-red-500 font-semibold">Please select a file and enter a passphrase.</span>';
            return;
        }
        fileName = file.name;

        // 1. Read the file content
        statusDiv.innerHTML = 'Reading file content...';
        contentToEncrypt = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = (error) => reject(error);
            reader.readAsText(file); // Read as Text for this prototype
        });

    } else { // Text Mode
        contentToEncrypt = document.getElementById('textInput').value;
        passphrase = document.getElementById('passphraseText').value;
        
        if (!contentToEncrypt || !passphrase) {
            statusDiv.innerHTML = '<span class="text-red-500 font-semibold">Please enter text and a passphrase.</span>';
            return;
        }
        fileName = 'encrypted_message.txt'; // Default name for text mode
    }

    // 2. Encrypt the content using AES
    statusDiv.innerHTML = 'Encrypting data...';
    let ciphertext;
    try {
        ciphertext = CryptoJS.AES.encrypt(contentToEncrypt, passphrase).toString();
    } catch (error) {
        console.error('Encryption Error:', error);
        statusDiv.innerHTML = '<span class="text-red-500 font-semibold">Encryption failed. Check console for details.</span>';
        return;
    }


    // 3. Generate a unique ID
    const fileId = db.collection('encryptedFiles').doc().id; 
    let downloadURL = null; // Used only for File Mode
    
    try {
        statusDiv.innerHTML = 'Saving to secure cloud storage...';
        document.getElementById('progressBarContainer').classList.add('hidden');

        // --- Handle File Mode (Upload to Storage) ---
        if (currentMode === 'file') {
            document.getElementById('progressBarContainer').classList.remove('hidden');
            const fileBlob = new Blob([ciphertext], { type: 'text/plain' });
            const storageRef = storage.ref().child('encrypted/' + fileId); 
            
            // Upload Task with Progress Tracking
            const uploadTask = storageRef.put(fileBlob); 

            await new Promise((resolve, reject) => {
                uploadTask.on('state_changed', 
                    (snapshot) => {
                        // PROGRESS BAR UPDATE
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        document.getElementById('uploadProgressBar').value = progress;
                        statusDiv.innerHTML = `Upload in progress: ${progress.toFixed(0)}%`;
                    }, 
                    (error) => {
                        reject(error);
                    }, 
                    () => {
                        resolve();
                    }
                );
            });

            // Get the permanent download URL for the file
            downloadURL = await storageRef.getDownloadURL();
            document.getElementById('progressBarContainer').classList.add('hidden');

            // --- Save small metadata document in Firestore ---
            await db.collection('encryptedFiles').doc(fileId).set({ 
                storageUrl: downloadURL,
                filename: fileName,
                mode: currentMode, // Save the mode
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                expirationTimestamp: expirationMs > 0 ? firebase.firestore.FieldValue.serverTimestamp().toDate().getTime() + expirationMs : null
            });

        } else { // --- Handle Text Mode (Save directly to Firestore) ---
            await db.collection('encryptedFiles').doc(fileId).set({ 
                ciphertext: ciphertext, // Store text directly in Firestore
                filename: fileName,
                mode: currentMode, // Save the mode
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                expirationTimestamp: expirationMs > 0 ? firebase.firestore.FieldValue.serverTimestamp().toDate().getTime() + expirationMs : null
            });
        }


        // CORRECTED: The share link must point to the new decryption page with the file ID attached as a URL parameter
        const baseURL = window.location.origin; 
        // NOTE: Must include the repository name '/Is-Project-app/' for GitHub Pages (adjust as necessary)
        // Ensure you change '/Is-Project-app/' if your repository name is different!
        const repoName = window.location.pathname.startsWith('/docs/') ? '' : '/Is-Project-app/';
        const shareLink = `${baseURL}${repoName}file.html?id=${fileId}&mode=${currentMode}`; 

        statusDiv.innerHTML = `
            <span class="text-green-600 font-semibold">Success! File stored.</span><br>
            **Share this link (and the passphrase) with the receiver:**<br>
            <div class="flex items-center space-x-2 mt-2">
                <a href="${shareLink}" target="_blank" class="text-blue-500 underline truncate flex-1" id="shareLinkAnchor">${shareLink}</a>
                <button onclick="copyLinkToClipboard('${shareLink}')" class="bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600 transition duration-150" id="copyBtn">
                    Copy Link
                </button>
            </div>
            ${expirationMs > 0 ? `<div class="text-xs text-gray-500 mt-2">File will expire in ${formatExpirationTime(expirationMs)}.</div>` : ''}
        `;

    } catch (error) {
        console.error('Error saving to Firestore/Storage:', error);
        statusDiv.innerHTML = `<span class="text-red-500 font-semibold">Upload failed. Check console for details.</span>`;
    }
}

// --- Utility Functions ---

function formatExpirationTime(ms) {
    const totalSeconds = ms / 1000;
    if (totalSeconds < 60) return `${totalSeconds} seconds`;
    const totalMinutes = totalSeconds / 60;
    if (totalMinutes < 60) return `${totalMinutes.toFixed(0)} minutes`;
    const totalHours = totalMinutes / 60;
    if (totalHours < 24) return `${totalHours.toFixed(1)} hours`;
    const totalDays = totalHours / 24;
    return `${totalDays.toFixed(1)} days`;
}

function copyLinkToClipboard(link) {
    // COPY LINK BUTTON
    navigator.clipboard.writeText(link).then(() => {
        const copyBtn = document.getElementById('copyBtn');
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyBtn.textContent = 'Copy Link';
        }, 2000);
    }).catch(err => {
        console.error('Could not copy text: ', err);
    });
}
