// public/app.js

async function encryptAndUpload() {
    const file = document.getElementById('fileInput').files[0];
    const passphrase = document.getElementById('passphrase').value;
    const statusDiv = document.getElementById('statusMessage');
    
    statusDiv.innerHTML = 'Starting upload...';

    if (!file || !passphrase) {
        statusDiv.innerHTML = '<span style="color: red;">Please select a file and enter a passphrase.</span>';
        return;
    }

    // 1. Read the file content
    const reader = new FileReader();
    reader.onload = async function(event) {
        const fileContent = event.target.result;

        // 2. Encrypt the file content using AES
        statusDiv.innerHTML = 'Encrypting data...';
        const ciphertext = CryptoJS.AES.encrypt(fileContent, passphrase).toString();

        // 3. Generate a unique ID directly in the browser
        const fileId = db.collection('encryptedFiles').doc().id; 
        
        // 4. Save the encrypted data (Ciphertext) to Firestore
        try {
            statusDiv.innerHTML = 'Saving to secure cloud storage...';

            await db.collection('encryptedFiles').doc(fileId).set({
                ciphertext: ciphertext,
                filename: file.name,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            // The URL structure will be the base Firebase URL + a new "view" page
            const baseURL = window.location.origin; // e.g., https://your-app.web.app
            const shareLink = `${baseURL}/file/${fileId}`; 

            statusDiv.innerHTML = `
                <span style="color: green;">Success! File stored.</span><br>
                **Share this link (and the passphrase) with the receiver:**<br>
                <a href="${shareLink}" target="_blank">${shareLink}</a>
            `;

        } catch (error) {
            console.error('Error saving to Firestore:', error);
            statusDiv.innerHTML = `<span style="color: red;">Upload failed. Check console for details.</span>`;
        }
    };

    // Read the file content as text (simple for this prototype)
    reader.readAsText(file);
}

// NOTE: You will need to create a second file, 'file.html' (or similar), for the decryption logic!
// This code is for the UPLOAD side only.