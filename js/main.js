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
    bgMusic.play().catch(() => {});
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
    gameContainer.style.display = 'none';
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
// 🔑 HARDCODE YOUR API KEY HERE (starts with gsk_...)
const GROQ_API_KEY = 'gsk_YOUR_KEY_HERE';   // <-- replace with your actual key

// DOM elements
const outputDiv = document.getElementById('adventure-output');
const optionsContainer = document.getElementById('options-container');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const newGameBtn = document.getElementById('new-game-btn');

// Current game state (will be updated after each action)
let currentState = null;

// Initial state (first scene)
const INITIAL_STATE = {
  location: "Mossy dungeon stairwell",
  hp: 10,
  inventory: ["torch"],
  flags: ["intro_started"]
};

// System prompt (highest priority, constant)
const SYSTEM_PROMPT = `You are an interactive fiction game engine.
You must output ONLY valid JSON. No markdown. No extra text.
You run a single-player adventure with persistent state.
Tone: vivid, cinematic, but concise.
Never mention you are an AI. Never mention policies.
Do not ask the player what they want to do generally—always provide concrete options.
Keep narration 60–140 words.
Provide exactly 4 options. Each option must be a short action command.
Enforce consistency: do not invent items/characters that contradict the given state.
If the player attempts something impossible, narrate failure and offer alternatives.
Safety: avoid graphic gore and explicit sexual content.

JSON schema (strict):
{
  "narration": string,
  "options": [string, string, string, string],
  "state": {
    "location": string,
    "hp": number,
    "inventory": string[],
    "flags": string[]
  }
}`;

// Developer message (reinforces rules)
const DEVELOPER_PROMPT = `You must keep the game fair. No deus ex machina saves.
Keep puzzles solvable. Track inventory and flags.
Options must be plausible next actions based on the narration.`;

// Helper to append text to output
function appendOutput(text) {
  outputDiv.innerHTML += text;
  outputDiv.scrollTop = outputDiv.scrollHeight;
}

// Clear output and reset game
function resetGame() {
  outputDiv.innerHTML = '';
  optionsContainer.innerHTML = '';
  userInput.value = '';
  currentState = { ...INITIAL_STATE }; // copy
  sendAction('START');
}

// Send an action (player command) to Groq
async function sendAction(actionText) {
  if (!GROQ_API_KEY || !GROQ_API_KEY.startsWith('gsk_')) {
    appendOutput('❌ Groq API key is missing or invalid. Please hardcode a valid key in main.js\n');
    return;
  }

  // Show what the player did
  if (actionText !== 'START') {
    appendOutput(`\n> ${actionText}\n\n`);
  }

  // Build the user message with current state and action
  const userMessage = `Current state: ${JSON.stringify(currentState)}\nPlayer action: ${actionText}`;

  // Prepare messages array
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'developer', content: DEVELOPER_PROMPT },
    { role: 'user', content: userMessage }
  ];

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',  // or any model you prefer
        messages: messages,
        temperature: 0.7,
        max_completion_tokens: 1024,
        top_p: 0.95,
        stream: false   // we want complete JSON
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from Groq');
    }

    // Parse the JSON
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse JSON:', content);
      appendOutput(`\n⚠️ The game engine returned invalid data. Please try again.\n`);
      // Optionally, you could retry once with a repair prompt, but we keep it simple.
      return;
    }

    // Validate basic schema
    if (!parsed.narration || !Array.isArray(parsed.options) || parsed.options.length !== 4 || !parsed.state) {
      throw new Error('Response does not match the required schema');
    }

    // Update current state
    currentState = parsed.state;

    // Display narration
    appendOutput(parsed.narration + '\n\n');

    // Update options buttons
    renderOptions(parsed.options);

  } catch (error) {
    console.error(error);
    appendOutput(`\n❌ Error: ${error.message}\n`);
  }
}

// Render the four option buttons
function renderOptions(options) {
  optionsContainer.innerHTML = '';
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.textContent = opt;
    btn.className = 'option-btn'; // you can style this
    btn.addEventListener('click', () => {
      sendAction(opt);
    });
    optionsContainer.appendChild(btn);
  });
}

// Event listeners for free text input
sendBtn.addEventListener('click', () => {
  const text = userInput.value.trim();
  if (text) {
    sendAction(text);
    userInput.value = '';
  }
});

userInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendBtn.click();
  }
});

newGameBtn.addEventListener('click', resetGame);

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
