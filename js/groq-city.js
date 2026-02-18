import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  orderBy,  
  limit, 
  onSnapshot, 
  Timestamp,
  doc,
  setDoc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyDtKRlsPmdOMtzY_ESJFq3JiduLPPbz1QQ",
  authDomain: "dbfinal-9fadb.firebaseapp.com",
  projectId: "dbfinal-9fadb",
  storageBucket: "dbfinal-9fadb.appspot.com",
  messagingSenderId: "980549293595",
  appId: "1:980549293595:web:17876489c9aeea26e78abe"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Groq API Key - FIXED the reference
const GROQ_API_KEY = "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"; 

// Game State
let currentUser = null;
let playerData = {
  money: 1000,
  reputation: 0,
  inventory: [],
  stats: {
    strength: 10,
    agility: 10,
    intelligence: 10
  }
};

let cityState = {
  day: 1,
  crimeRate: 50,
  economy: 50,
  policePresence: 50,
  description: "A new day dawns in Groq City..."
};

// Adventure State
let adventureState = {
  history: [],
  context: {
    location: "Groq City Streets",
    quest: "None",
    health: 100,
    inventory: []
  },
  isProcessing: false
};

// Available actions
const actions = [
  { id: 'rob', name: '💵 Rob Store', type: 'crime', cost: 0, baseSuccess: 40 },
  { id: 'hack', name: '💻 Hack Bank', type: 'crime', cost: 0, baseSuccess: 30 },
  { id: 'sell', name: '📦 Sell Goods', type: 'business', cost: 0, baseSuccess: 70 },
  { id: 'train', name: '🏋️ Train', type: 'stats', cost: 100, baseSuccess: 100 },
  { id: 'bribe', name: '🤝 Bribe Official', type: 'crime', cost: 200, baseSuccess: 60 }
];

// Market items
const marketItems = [
  { id: 'weapon', name: '🔫 Pistol', price: 500, stat: 'strength', bonus: 3 },
  { id: 'lockpick', name: '🔓 Lockpick Set', price: 200, stat: 'agility', bonus: 2 },
  { id: 'mask', name: '🎭 Disguise', price: 300, stat: 'intelligence', bonus: 2 },
  { id: 'armor', name: '🛡️ Kevlar Vest', price: 800, stat: 'strength', bonus: 5 },
  { id: 'software', name: '💾 Hacking Tool', price: 600, stat: 'intelligence', bonus: 4 }
];

// Audio elements
const bgMusic = document.getElementById("backgroundMusic");
const musicToggle = document.getElementById("musicToggle");
let musicOn = true;

// Music control
if (bgMusic) {
  bgMusic.volume = 0.3;
  musicToggle.addEventListener("click", () => {
    musicOn = !musicOn;
    musicToggle.textContent = musicOn ? "♪" : "🔇";
    if (musicOn) bgMusic.play();
    else bgMusic.pause();
  });
}

// ==================== AUTHENTICATION FUNCTIONS ====================

async function login(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    alert("Login failed: " + error.message);
  }
}

async function signup(email, password) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await initializeNewPlayer(userCredential.user.uid);
  } catch (error) {
    alert("Signup failed: " + error.message);
  }
}

async function initializeNewPlayer(userId) {
  const playerRef = doc(db, "players", userId);
  const defaultPlayerData = {
    money: 1000,
    reputation: 0,
    inventory: [],
    stats: {
      strength: 10,
      agility: 10,
      intelligence: 10
    },
    adventureHistory: [],
    adventureContext: {
      location: "Groq City Streets",
      quest: "None",
      health: 100,
      inventory: []
    },
    createdAt: Timestamp.now(),
    lastLogin: Timestamp.now()
  };
  
  await setDoc(playerRef, defaultPlayerData);
}

async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    alert("Logout failed: " + error.message);
  }
}

// ==================== UI UPDATE FUNCTIONS ====================

function updateUI(user) {
  const loginForm = document.getElementById('login-form');
  const userInfo = document.getElementById('user-info');
  const userEmail = document.getElementById('user-email');
  const gameContainer = document.getElementById('game-container');
  const leaderboard = document.getElementById('leaderboard');
  const difficulty = document.getElementById('difficulty');
  
  if (user) {
    currentUser = user;
    if (loginForm) loginForm.style.display = 'none';
    if (userInfo) {
      userInfo.style.display = 'block';
      if (userEmail) userEmail.textContent = user.email;
    }
    if (gameContainer) gameContainer.style.display = 'block';
    if (leaderboard) leaderboard.style.display = 'block';
    if (difficulty) difficulty.style.display = 'none';
    
    loadPlayerData();
    if (musicOn && bgMusic) bgMusic.play();
    initializeCity();
    initAdventureEngine(); // Initialize adventure engine
  } else {
    currentUser = null;
    if (loginForm) loginForm.style.display = 'block';
    if (userInfo) userInfo.style.display = 'none';
    if (gameContainer) gameContainer.style.display = 'none';
    if (leaderboard) leaderboard.style.display = 'none';
    if (difficulty) difficulty.style.display = 'none';
    if (bgMusic) bgMusic.pause();
  }
}

function updatePlayerDisplay() {
  const moneyEl = document.getElementById('player-money');
  const repEl = document.getElementById('player-rep');
  const strengthEl = document.getElementById('player-strength');
  const agilityEl = document.getElementById('player-agility');
  const intelligenceEl = document.getElementById('player-intelligence');
  
  if (moneyEl) moneyEl.textContent = playerData.money || 0;
  if (repEl) repEl.textContent = playerData.reputation || 0;
  if (strengthEl) strengthEl.textContent = playerData.stats?.strength || 10;
  if (agilityEl) agilityEl.textContent = playerData.stats?.agility || 10;
  if (intelligenceEl) intelligenceEl.textContent = playerData.stats?.intelligence || 10;
}

// ==================== LOAD PLAYER DATA ====================

async function loadPlayerData() {
  if (!currentUser) return;
  
  try {
    const playerRef = doc(db, "players", currentUser.uid);
    const playerSnap = await getDoc(playerRef);
    
    if (playerSnap.exists()) {
      playerData = playerSnap.data();
      console.log("Player data loaded:", playerData);
      
      // Load adventure state
      if (playerData.adventureHistory) {
        adventureState.history = playerData.adventureHistory;
        adventureState.context = playerData.adventureContext || adventureState.context;
      }
    } else {
      console.log("No player data found, creating new player...");
      await initializeNewPlayer(currentUser.uid);
      const newPlayerSnap = await getDoc(playerRef);
      playerData = newPlayerSnap.data();
    }
    
    updatePlayerDisplay();
    renderActions();
    renderMarket();
    
    // Update adventure display
    setTimeout(() => {
      displayAdventureHistory();
      const locationEl = document.getElementById('adventure-location');
      const questEl = document.getElementById('adventure-quest');
      if (locationEl) locationEl.textContent = adventureState.context.location;
      if (questEl) questEl.textContent = adventureState.context.quest;
    }, 100);
    
  } catch (error) {
    console.error("Error loading player data:", error);
    alert("Error loading game data. Please refresh.");
  }
}

// ==================== CITY FUNCTIONS ====================

async function initializeCity() {
  showAIThinking();
  
  try {
    if (GROQ_API_KEY) {
      const description = await getAICityDescription();
      if (description) {
        cityState.description = description;
        const descEl = document.getElementById('city-description');
        if (descEl) descEl.textContent = description;
      }
    } else {
      const descEl = document.getElementById('city-description');
      if (descEl) {
        descEl.textContent = "Welcome to Groq City. The neon lights flicker as another day of opportunity begins...";
      }
    }
    
    updateCityStats();
    renderActions();
    renderMarket();
    startDayCycle();
  } catch (error) {
    console.error("Error initializing city:", error);
  } finally {
    hideAIThinking();
  }
}

function updateCityStats() {
  const statsContainer = document.getElementById('city-stats');
  if (!statsContainer) return;
  
  statsContainer.innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${cityState.crimeRate}%</div>
      <div class="stat-label">Crime Rate</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${cityState.economy}%</div>
      <div class="stat-label">Economy</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${cityState.policePresence}%</div>
      <div class="stat-label">Police Presence</div>
    </div>
  `;
  
  const dayEl = document.getElementById('game-day');
  if (dayEl) dayEl.textContent = cityState.day;
}

async function generateCityEvent() {
  cityState.crimeRate += Math.floor(Math.random() * 10) - 5;
  cityState.economy += Math.floor(Math.random() * 8) - 4;
  cityState.policePresence += Math.floor(Math.random() * 12) - 6;
  
  cityState.crimeRate = Math.min(100, Math.max(0, cityState.crimeRate));
  cityState.economy = Math.min(100, Math.max(0, cityState.economy));
  cityState.policePresence = Math.min(100, Math.max(0, cityState.policePresence));
  
  updateCityStats();
  
  const events = [
    "Police crackdown in the east end!",
    "New gang emerges in the industrial district.",
    "Stock market crashes! Economy in turmoil.",
    "Mayor announces anti-crime initiative.",
    "Rival mob bosses call a truce.",
    "Casino heist shocks the city!",
    "Underground fight club gains popularity.",
    "Drug prices skyrocket on the black market."
  ];
  
  const news = events[Math.floor(Math.random() * events.length)];
  addNewsItem(news);
}

function addNewsItem(news) {
  const feed = document.getElementById('news-feed');
  if (!feed) return;
  
  const item = document.createElement('div');
  item.className = 'news-item';
  item.textContent = `📰 ${news}`;
  feed.insertBefore(item, feed.firstChild);
  
  while (feed.children.length > 10) {
    feed.removeChild(feed.lastChild);
  }
}

function startDayCycle() {
  setInterval(async () => {
    if (currentUser) {
      cityState.day++;
      await generateCityEvent();
    }
  }, 60000);
}

// ==================== AI FUNCTIONS ====================

// ==================== AI FUNCTIONS ====================

async function queryGroq(prompt, systemPrompt) {
  if (!GROQ_API_KEY) {
    console.log("No Groq API key provided");
    return null;
  }
  
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192', // Using confirmed working model
        messages: [
          {
            role: 'system',
            content: systemPrompt || "You are the AI god of a crime-ridden city. Generate immersive, gritty descriptions and outcomes."
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.9,
        max_tokens: 500,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Groq API error details:', errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Groq API response received:", data);
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Groq API error:', error);
    return null;
  }
}
async function getAICityDescription() {
  const prompt = `Generate a gritty, immersive description of a crime-ridden city called "Groq City" for the start of a new day. Include details about the atmosphere, the streets, and the general mood. Make it dark and exciting. Keep it under 100 words.`;
  const response = await queryGroq(prompt);
  return response || "The neon lights flicker over wet pavement as Groq City wakes to another day of crime and opportunity...";
}

async function getAIActionOutcome(action, playerStats, cityState, success) {
  const prompt = `A player in Groq City attempted to: ${action.name}. 
    They ${success ? 'succeeded' : 'failed'}. 
    Player stats: Strength ${playerStats.strength}, Agility ${playerStats.agility}, Intelligence ${playerStats.intelligence}
    Generate a short, exciting outcome description. Keep it under 50 words.`;
  
  const response = await queryGroq(prompt);
  
  if (success) {
    return response || `You successfully ${action.name.toLowerCase()}! The city trembles at your prowess.`;
  } else {
    return response || `Your attempt to ${action.name.toLowerCase()} fails. The city fights back.`;
  }
}

// ==================== UI CONTROLS ====================

function showAIThinking() {
  const indicator = document.getElementById('ai-thinking');
  if (indicator) indicator.style.display = 'block';
}

function hideAIThinking() {
  const indicator = document.getElementById('ai-thinking');
  if (indicator) indicator.style.display = 'none';
}

// ==================== ACTION FUNCTIONS ====================

function renderActions() {
  const container = document.getElementById('player-actions');
  if (!container) return;
  
  container.innerHTML = '';
  
  actions.forEach(action => {
    const btn = document.createElement('button');
    btn.className = `action-btn ${action.type}`;
    btn.textContent = action.name;
    if (action.cost > (playerData.money || 0)) {
      btn.style.opacity = '0.5';
      btn.disabled = true;
      btn.title = `Costs $${action.cost}`;
    }
    btn.onclick = () => performAction(action);
    container.appendChild(btn);
  });
}

function renderMarket() {
  const container = document.getElementById('market');
  if (!container) return;
  
  container.innerHTML = '';
  
  marketItems.forEach(item => {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <span>${item.name}</span>
        <span class="item-price">$${item.price}</span>
      </div>
      <div style="font-size: 0.8rem; opacity: 0.8; margin-bottom: 10px;">
        +${item.bonus} ${item.stat}
      </div>
      <button class="action-btn" style="width: 100%;" 
        ${(playerData.money || 0) < item.price ? 'disabled' : ''}
        onclick="window.buyItem('${item.id}')">
        Buy
      </button>
    `;
    container.appendChild(card);
  });
}

async function performAction(action) {
  if (!currentUser) return;
  
  if (action.cost > (playerData.money || 0)) {
    alert(`You need $${action.cost} to do that!`);
    return;
  }
  
  showAIThinking();
  
  try {
    let successChance = action.baseSuccess;
    if (action.type === 'crime') {
      successChance += (playerData.stats?.agility || 10) * 2;
      successChance -= cityState.policePresence * 0.5;
    } else if (action.type === 'business') {
      successChance += (playerData.stats?.intelligence || 10) * 2;
      successChance += cityState.economy * 0.3;
    }
    
    successChance = Math.min(95, Math.max(5, successChance));
    const success = Math.random() * 100 < successChance;
    
    const aiDescription = await getAIActionOutcome(action, playerData.stats, cityState, success);
    
    let reward = 0;
    if (success) {
      reward = Math.floor(Math.random() * 200) + 50;
      playerData.money = (playerData.money || 0) + reward;
      playerData.reputation = (playerData.reputation || 0) + 5;
    } else {
      playerData.reputation = (playerData.reputation || 0) - 2;
    }
    
    if (action.id === 'train' && success) {
      playerData.money = (playerData.money || 0) - action.cost;
      const stat = ['strength', 'agility', 'intelligence'][Math.floor(Math.random() * 3)];
      if (!playerData.stats) playerData.stats = { strength: 10, agility: 10, intelligence: 10 };
      playerData.stats[stat] = (playerData.stats[stat] || 10) + 1;
    }
    
    try {
      const playerRef = doc(db, "players", currentUser.uid);
      await updateDoc(playerRef, {
        money: playerData.money,
        reputation: playerData.reputation,
        stats: playerData.stats,
        lastAction: Timestamp.now()
      });
    } catch (saveError) {
      console.error("Error saving to Firebase:", saveError);
      const playerRef = doc(db, "players", currentUser.uid);
      await setDoc(playerRef, playerData, { merge: true });
    }
    
    addToCrimeLog(aiDescription, success, reward);
    updatePlayerDisplay();
    renderActions();
    renderMarket();
    
    if (Math.random() < 0.3) {
      await generateCityEvent();
    }
    
  } catch (error) {
    console.error("Action error:", error);
    addToCrimeLog("The city's chaos confuses your actions...", false, 0);
  } finally {
    hideAIThinking();
  }
}

function addToCrimeLog(description, success, reward = 0) {
  const log = document.getElementById('crime-log');
  if (!log) return;
  
  const entry = document.createElement('div');
  entry.className = `log-entry ${success ? 'log-success' : 'log-failure'}`;
  
  let text = description;
  if (success && reward > 0) {
    text += ` +$${reward}`;
  }
  
  entry.textContent = `[Day ${cityState.day}] ${text}`;
  log.insertBefore(entry, log.firstChild);
  
  while (log.children.length > 20) {
    log.removeChild(log.lastChild);
  }
}

// ==================== MARKET FUNCTIONS ====================

window.buyItem = async (itemId) => {
  if (!currentUser) {
    alert("Please login first!");
    return;
  }
  
  const item = marketItems.find(i => i.id === itemId);
  if (!item) return;
  
  if ((playerData.money || 0) < item.price) {
    alert("Not enough money!");
    return;
  }
  
  playerData.money -= item.price;
  
  if (!playerData.stats) {
    playerData.stats = { strength: 10, agility: 10, intelligence: 10 };
  }
  
  playerData.stats[item.stat] = (playerData.stats[item.stat] || 10) + item.bonus;
  
  if (!playerData.inventory) playerData.inventory = [];
  playerData.inventory.push({
    id: item.id,
    name: item.name,
    purchasedAt: Timestamp.now()
  });
  
  try {
    const playerRef = doc(db, "players", currentUser.uid);
    await updateDoc(playerRef, {
      money: playerData.money,
      stats: playerData.stats,
      inventory: playerData.inventory
    });
    
    updatePlayerDisplay();
    renderMarket();
    renderActions();
    
    addToCrimeLog(`Purchased ${item.name} from the black market.`, true, 0);
  } catch (error) {
    console.error("Error buying item:", error);
    alert("Purchase failed. Please try again.");
    playerData.money += item.price;
    playerData.stats[item.stat] -= item.bonus;
    playerData.inventory.pop();
  }
};

// ==================== ADVENTURE ENGINE (FIXED) ====================

async function processAdventureAction(action) {
  if (!currentUser) {
    alert("Please login to play the adventure!");
    return;
  }
  
  adventureState.isProcessing = true;
  const submitBtn = document.getElementById('adventure-submit');
  const input = document.getElementById('adventure-input');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = '🤔 Thinking...';
  submitBtn.disabled = true;
  input.disabled = true;
  
  addStoryEntry(action, "player");
  
  try {
    let aiResponse;
    
    if (GROQ_API_KEY) {
      const contextPrompt = buildAdventureContext(action);
      console.log("Sending prompt to Groq:", contextPrompt); // Debug log
      
      const response = await queryGroq(contextPrompt, `You are a text adventure game master for a gritty crime city called "Groq City". 
        You MUST respond with ONLY valid JSON in this exact format, no other text:
        {
          "narrative": "A vivid, immersive description (2-3 sentences)",
          "location": "New location or same",
          "quest": "New quest or same", 
          "healthChange": 0,
          "moneyChange": 0,
          "reputationChange": 0,
          "itemFound": null,
          "combat": false
        }
        
        Be creative! Generate different responses based on the player's action. Don't repeat the same scenarios.`);
      
      console.log("Raw Groq response:", response); // Debug log
      
      if (response) {
        // Try to extract JSON from the response (in case there's extra text)
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            aiResponse = JSON.parse(jsonMatch[0]);
            console.log("Parsed AI response:", aiResponse); // Debug log
          } catch (e) {
            console.error("Failed to parse JSON:", e);
            // Create a creative response from the text if JSON parsing fails
            aiResponse = createResponseFromText(response, action);
          }
        } else {
          // If no JSON found, create response from text
          aiResponse = createResponseFromText(response, action);
        }
      } else {
        // If no response, use creative fallback
        aiResponse = getCreativeFallbackResponse(action);
      }
    } else {
      aiResponse = getCreativeFallbackResponse(action);
    }
    
    // Ensure all required fields exist
    const parsedResponse = {
      narrative: aiResponse.narrative || "The city streets stretch before you, full of possibilities...",
      location: aiResponse.location || adventureState.context.location,
      quest: aiResponse.quest || adventureState.context.quest,
      healthChange: aiResponse.healthChange || 0,
      moneyChange: aiResponse.moneyChange || 0,
      reputationChange: aiResponse.reputationChange || 0,
      itemFound: aiResponse.itemFound || null,
      combat: aiResponse.combat || false
    };
    
    addStoryEntry(parsedResponse.narrative, "ai");
    await updateGameFromAdventure(parsedResponse);
    await saveAdventureState();
    
  } catch (error) {
    console.error("Adventure error:", error);
    addStoryEntry("The city's chaos makes it hard to think... Try again.", "system");
  } finally {
    adventureState.isProcessing = false;
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
    input.disabled = false;
    input.focus();
  }
}

// Helper function to create a response from text if JSON parsing fails
function createResponseFromText(text, action) {
  // Default response structure
  const response = {
    narrative: text.substring(0, 200), // Use first 200 chars as narrative
    location: adventureState.context.location,
    quest: adventureState.context.quest,
    healthChange: 0,
    moneyChange: 0,
    reputationChange: 0,
    itemFound: null,
    combat: false
  };
  
  // Try to infer game mechanics from text
  if (text.toLowerCase().includes("money") || text.toLowerCase().includes("cash") || text.toLowerCase().includes("$")) {
    response.moneyChange = Math.floor(Math.random() * 100) + 20;
  }
  
  if (text.toLowerCase().includes("fight") || text.toLowerCase().includes("attack") || text.toLowerCase().includes("combat")) {
    response.combat = true;
    response.healthChange = -Math.floor(Math.random() * 20) - 5;
  }
  
  if (text.toLowerCase().includes("find") || text.toLowerCase().includes("discover")) {
    const items = ["knife", "wallet", "phone", "keys", "badge", "map"];
    response.itemFound = items[Math.floor(Math.random() * items.length)];
  }
  
  return response;
}

// More creative fallback responses
function getCreativeFallbackResponse(action) {
  const responses = [
    {
      narrative: "You walk through the rain-slicked streets. The neon signs reflect off puddles as shadows move in alleys. A distant siren wails.",
      location: "Downtown",
      quest: "Find the informant",
      healthChange: 0,
      moneyChange: 0,
      reputationChange: 1,
      itemFound: null,
      combat: false
    },
    {
      narrative: "A group of thugs blocks your path. 'This is our turf,' one growls. They look ready for a fight.",
      location: "Industrial District",
      quest: "Deal with the thugs",
      healthChange: -10,
      moneyChange: 0,
      reputationChange: 5,
      itemFound: null,
      combat: true
    },
    {
      narrative: "You find an abandoned warehouse. Inside, a briefcase sits on a crate. It's unlocked and full of cash!",
      location: "Warehouse District",
      quest: "Check the briefcase",
      healthChange: 0,
      moneyChange: 500,
      reputationChange: 2,
      itemFound: "Briefcase",
      combat: false
    },
    {
      narrative: "The shady dealer eyes you suspiciously. 'You got the money?' he asks, hand in his pocket.",
      location: "Underpass",
      quest: "Complete the deal",
      healthChange: 0,
      moneyChange: -100,
      reputationChange: 3,
      itemFound: "Mystery Package",
      combat: false
    },
    {
      narrative: "The bank looks heavily guarded. Multiple cameras and armed security make this a risky move.",
      location: "Financial District",
      quest: "Case the joint",
      healthChange: 0,
      moneyChange: 0,
      reputationChange: 0,
      itemFound: null,
      combat: false
    },
    {
      narrative: "A police cruiser slowly passes by. The officer inside gives you a long, hard look.",
      location: "Main Street",
      quest: "Avoid attention",
      healthChange: 0,
      moneyChange: 0,
      reputationChange: -2,
      itemFound: null,
      combat: false
    },
    {
      narrative: "You find a locked door with a keypad. Looks like it leads to something valuable.",
      location: "Back Alley",
      quest: "Find the code",
      healthChange: 0,
      moneyChange: 0,
      reputationChange: 0,
      itemFound: null,
      combat: false
    },
    {
      narrative: "A mysterious figure in a trench coat approaches. 'Looking for work?' they whisper.",
      location: "Train Station",
      quest: "Take the job",
      healthChange: 0,
      moneyChange: 0,
      reputationChange: 0,
      itemFound: null,
      combat: false
    }
  ];
  
  // Use action to influence response (simple keyword matching)
  const actionLower = action.toLowerCase();
  
  if (actionLower.includes("bank") || actionLower.includes("rob")) {
    return responses[4]; // Bank response
  } else if (actionLower.includes("dealer") || actionLower.includes("buy") || actionLower.includes("sell")) {
    return responses[3]; // Dealer response
  } else if (actionLower.includes("fight") || actionLower.includes("attack")) {
    return responses[1]; // Fight response
  } else if (actionLower.includes("warehouse") || actionLower.includes("explore")) {
    return responses[2]; // Warehouse response
  } else if (actionLower.includes("police") || actionLower.includes("cops")) {
    return responses[5]; // Police response
  } else {
    // Return random response for other actions
    return responses[Math.floor(Math.random() * responses.length)];
  }
}

// Update buildAdventureContext to be more specific
function buildAdventureContext(action) {
  const recentHistory = adventureState.history.slice(-3).map(h => 
    `${h.type}: ${h.text}`
  ).join('\n');
  
  return `You are the AI narrator for Groq City, a gritty crime-filled metropolis.

Current game state:
- Location: ${adventureState.context.location}
- Active quest: ${adventureState.context.quest}
- Health: ${adventureState.context.health}
- Money: $${playerData.money}
- Reputation: ${playerData.reputation}
- Stats: Str ${playerData.stats.strength}, Agi ${playerData.stats.agility}, Int ${playerData.stats.intelligence}

Recent events:
${recentHistory}

Player's new action: "${action}"

Generate a UNIQUE response based on this specific action. Be creative! Don't repeat scenarios.
Respond with ONLY valid JSON in this exact format:
{
  "narrative": "A vivid, immersive 2-3 sentence description of what happens",
  "location": "New location (can be same or different)",
  "quest": "New quest or current quest",
  "healthChange": number between -30 and 30,
  "moneyChange": number between -200 and 500,
  "reputationChange": number between -10 and 20,
  "itemFound": "item name or null",
  "combat": true or false
}

Make it dark, gritty, and fit the crime city theme. The response should feel different for each action.`;
}



// ==================== EVENT LISTENERS ====================

document.getElementById('login-btn')?.addEventListener('click', () => {
  const email = document.getElementById('email')?.value;
  const password = document.getElementById('password')?.value;
  if (email && password) {
    login(email, password);
  } else {
    alert("Please enter email and password");
  }
});

document.getElementById('signup-btn')?.addEventListener('click', () => {
  const email = document.getElementById('email')?.value;
  const password = document.getElementById('password')?.value;
  if (email && password) {
    signup(email, password);
  } else {
    alert("Please enter email and password");
  }
});

document.getElementById('logout-btn')?.addEventListener('click', logout);

// Auth state listener
onAuthStateChanged(auth, (user) => {
  updateUI(user);
});

// Initialize leaderboard
showLeaderboard();

// Make functions globally available
window.buyItem = buyItem;

console.log("Groq City game initialized with Adventure Engine!");
