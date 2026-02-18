import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  Timestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// -------------------- Firebase Setup --------------------
const firebaseConfig = {
  apiKey: "AIzaSyDtKRlsPmdOMtzY_ESJFq3JiduLPPbz1QQ",
  authDomain: "dbfinal-9fadb.firebaseapp.com",
  projectId: "dbfinal-9fadb",
  storageBucket: "dbfinal-9fadb.appspot.com",
  messagingSenderId: "980549293595",
  appId: "1:980549293595:web:17876489c9aeea26e78abe"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// -------------------- Music (unchanged) --------------------
const bgMusic = document.getElementById("backgroundMusic");
const musicToggle = document.getElementById("musicToggle");
let musicOn = true;
bgMusic.volume = 0.5;

musicToggle.addEventListener("click", () => {
  musicOn = !musicOn;
  musicToggle.textContent = musicOn ? "♪" : "🔇";
  if (musicOn) {
    bgMusic.play().catch(() => {}); // autoplay may be blocked
  } else {
    bgMusic.pause();
  }
});

// -------------------- Authentication UI --------------------
function updateUI(user) {
  const loginForm = document.getElementById('login-form');
  const userInfo = document.getElementById('user-info');
  const userEmail = document.getElementById('user-email');
  const gameContainer = document.getElementById('game-container');
  
  if (user) {
    loginForm.style.display = 'none';
    userInfo.style.display = 'block';
    userEmail.textContent = user.email;
    gameContainer.style.display = 'block';   // show adventure game
  } else {
    loginForm.style.display = 'block';
    userInfo.style.display = 'none';
    gameContainer.style.display = 'none';    // hide game
  }
}

document.getElementById('login-btn').addEventListener('click', () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  signInWithEmailAndPassword(auth, email, password).catch(err => alert(err.message));
});

document.getElementById('signup-btn').addEventListener('click', () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  createUserWithEmailAndPassword(auth, email, password).catch(err => alert(err.message));
});

document.getElementById('logout-btn').addEventListener('click', () => {
  signOut(auth).catch(err => alert(err.message));
});

onAuthStateChanged(auth, updateUI);

// -------------------- Groq Text Adventure --------------------
// API key handling – you can hardcode your key or let the user input it.
// We'll store it in localStorage if the user saves it.
const API_KEY_STORAGE = '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';
let GROQ_API_KEY = localStorage.getItem(API_KEY_STORAGE) || '';

const apiKeyInput = document.getElementById('api-key');
const saveKeyBtn = document.getElementById('save-key-btn');
if (GROQ_API_KEY) {
  apiKeyInput.value = GROQ_API_KEY;
}
saveKeyBtn.addEventListener('click', () => {
  GROQ_API_KEY = apiKeyInput.value.trim();
  localStorage.setItem(API_KEY_STORAGE, GROQ_API_KEY);
  alert('API key saved');
});

// DOM elements for adventure
const outputDiv = document.getElementById('adventure-output');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const newGameBtn = document.getElementById('new-game-btn');

// Conversation history (messages for the Groq API)
let messages = [];

// Helper to append text to output (with optional streaming)
function appendOutput(text) {
  outputDiv.innerHTML += text;
  // Auto-scroll to bottom
  outputDiv.scrollTop = outputDiv.scrollHeight;
}

// Clear output and reset
function resetGame() {
  outputDiv.innerHTML = '';  // will be filled by initial prompt
  messages = [];
  // Start a new adventure
  sendInitialPrompt();
}

// Send the initial prompt to Groq to set the scene
async function sendInitialPrompt() {
  if (!GROQ_API_KEY) {
    appendOutput('⚠️ Please enter your Groq API key first.\n');
    return;
  }
  
  const initialMessage = {
    role: 'user',
    content: 'You are the narrator of a text adventure game. Start a new adventure in a fantasy world. Describe the setting and the player’s situation, then ask what they want to do. Keep your response under 200 words.'
  };
  
  messages = [initialMessage];  // start fresh
  await callGroqAndStream();
}

// Call Groq API with the current messages (streaming response)
async function callGroqAndStream() {
  if (!GROQ_API_KEY) {
    appendOutput('⚠️ API key missing.\n');
    return;
  }

  // Prepare the request body (same parameters as the user's script)
  const requestBody = {
    model: 'qwen/qwen3-32b',
    messages: messages,
    temperature: 0.6,
    max_completion_tokens: 4096,
    top_p: 0.95,
    stream: true,
    reasoning_effort: 'default',
    stop: null
  };

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API error (${response.status}): ${errorText}`);
    }

    // Read the stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let assistantMessage = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      // Split by double newline (SSE format) – each chunk starts with "data: "
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || ''; // keep the last incomplete chunk

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices[0]?.delta?.content;
            if (delta) {
              assistantMessage += delta;
              // Append incrementally (you could also update only at the end)
              // For a smoother experience, we'll just add the chunk.
              // But we need to avoid re‑appending the whole message.
              // Simpler: accumulate and show final. We'll do final for simplicity.
              // For true streaming, you'd need to replace the last part. We'll keep it simple.
            }
          } catch (e) {
            console.warn('Failed to parse chunk:', line, e);
          }
        }
      }
    }

    // After stream ends, add the assistant's message to history and display
    if (assistantMessage) {
      messages.push({ role: 'assistant', content: assistantMessage });
      appendOutput('\n' + assistantMessage + '\n\n');
    } else {
      appendOutput('\n⚠️ No response from Groq.\n');
    }
  } catch (error) {
    console.error(error);
    appendOutput(`\n❌ Error: ${error.message}\n`);
  }
}

// Send user message
async function sendUserMessage() {
  const text = userInput.value.trim();
  if (!text) return;
  if (!GROQ_API_KEY) {
    appendOutput('⚠️ API key missing.\n');
    return;
  }

  // Display user command
  appendOutput(`> ${text}\n\n`);
  userInput.value = '';

  // Add to messages
  messages.push({ role: 'user', content: text });

  // Call Groq and stream the answer
  await callGroqAndStream();
}

// Event listeners
sendBtn.addEventListener('click', sendUserMessage);
userInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendUserMessage();
});

newGameBtn.addEventListener('click', resetGame);

// Initially, the game container is hidden until login. We'll start when user logs in,
// but we can also start as soon as they are authenticated. However, we don't want to
// start automatically if they just log in (they may want to press New Game).
// We'll just wait for them to press New Game.

// Optionally, if you want the game to start right after login, you could call resetGame()
// inside the onAuthStateChanged when user becomes available. We'll leave it manual.

// -------------------- Leaderboard (unchanged, shows old ball scores) --------------------
function showLeaderboard() {
  const q = query(
    collection(db, "scores"),
    orderBy("score", "desc"),
    limit(10)
  );
  
  onSnapshot(q, (snapshot) => {
    const leaderboard = document.getElementById("scores-list");
    leaderboard.innerHTML = "";
    snapshot.forEach((doc) => {
      const li = document.createElement("li");
      li.textContent = `${doc.data().name}: ${doc.data().score}`;
      leaderboard.appendChild(li);
    });
  });
}

showLeaderboard();
