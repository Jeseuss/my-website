
// Firebase Config (use your existing config)
const firebaseConfig = {
  apiKey: "AIzaSyDtKRlsPmdOMtzY_ESJFq3JiduLPPbz1QQ",
  authDomain: "dbfinal-9fadb.firebaseapp.com",
  projectId: "dbfinal-9fadb",
  storageBucket: "dbfinal-9fadb.appspot.com",
  messagingSenderId: "980549293595",
  appId: "1:980549293595:web:17876489c9aeea26e78abe"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- GAME DATA ---
const LOCATIONS = {
    "Santa Ana": {
        desc: "The gritty heart of OC. High crime rates, high rewards.",
        crimes: [
            { name: "Pickpocket Tourist", energy: 5, nerve: 2, minPay: 10, maxPay: 50, xp: 1, risk: "low" },
            { name: "Tag a Wall", energy: 5, nerve: 5, minPay: 0, maxPay: 20, xp: 2, risk: "low" },
            { name: "Shoplift from 7-Eleven", energy: 10, nerve: 10, minPay: 50, maxPay: 150, xp: 5, risk: "med" }
        ]
    },
    "Newport Beach": {
        desc: "Wealthy coastlines and fancy yachts. Bring your A-game.",
        crimes: [
            { name: "Scallop Tickets", energy: 5, nerve: 5, minPay: 50, maxPay: 100, xp: 2, risk: "low" },
            { name: "Steal a Surfboard", energy: 15, nerve: 15, minPay: 100, maxPay: 300, xp: 8, risk: "med" },
            { name: "Yacht Heist", energy: 30, nerve: 30, minPay: 500, maxPay: 2000, xp: 25, risk: "high" }
        ]
    },
    "Irvine Spectrum": {
        desc: "Tech hubs and corporate money. Good for hacking.",
        crimes: [
            { name: "Phish for Passwords", energy: 5, nerve: 5, minPay: 20, maxPay: 80, xp: 3, risk: "low" },
            { name: "Mug a Tech Bro", energy: 20, nerve: 20, minPay: 200, maxPay: 600, xp: 15, risk: "med" }
        ]
    }
};

// --- GAME STATE ---
let playerData = null;
let playerRef = null; // Reference to Firestore document

// --- AUTH FUNCTIONS ---

function toggleAuthMode() {
    const login = document.getElementById('login-form');
    const reg = document.getElementById('register-form');
    login.classList.toggle('hidden');
    reg.classList.toggle('hidden');
}

// Make functions global so HTML buttons can see them
window.loginUser = async function() {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    try {
        await auth.signInWithEmailAndPassword(email, pass);
        // onAuthStateChanged will handle the rest
    } catch (e) {
        alert(e.message);
    }
}

window.registerUser = async function() {
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-password').value;
    const user = document.getElementById('reg-username').value;

    if(!user) { alert("Pick a username!"); return; }

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
        // Create a player document in Firestore
        await db.collection('players').doc(userCredential.user.uid).set({
            username: user,
            cash: 100,
            energy: 100,
            nerve: 50,
            xp: 0,
            level: 1,
            location: "Santa Ana",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {
        alert(e.message);
    }
}

window.logoutUser = function() {
    auth.signOut();
}

// --- GAME LOGIC ---

// Listener for Auth State Changes
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // User is signed in.
        const uid = user.uid;
        playerRef = db.collection('players').doc(uid);
        
        // Listen for real-time updates to the player document
        playerRef.onSnapshot((doc) => {
            if (doc.exists) {
                playerData = doc.data();
                updateUI();
                showGame();
            } else {
                console.log("No such document! Creating one... (should happen on register)");
            }
        });

    } else {
        // User is signed out.
        document.getElementById('auth-section').style.display = 'block';
        document.getElementById('game-container').style.display = 'none';
    }
});

function showGame() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
}

function updateUI() {
    if (!playerData) return;
    
    document.getElementById('disp-name').innerText = playerData.username;
    document.getElementById('disp-cash').innerText = "$" + playerData.cash.toLocaleString();
    document.getElementById('disp-energy').innerText = playerData.energy + "/100";
    document.getElementById('disp-nerve').innerText = playerData.nerve + "/50";
    
    // Update Location
    const loc = playerData.location;
    if(LOCATIONS[loc]) {
        document.getElementById('loc-title').innerText = loc;
        document.getElementById('loc-desc').innerText = LOCATIONS[loc].desc;
        renderCrimes(loc);
    }
}

// --- ACTIONS ---

function switchTab(tab) {
    const mainMenu = document.getElementById('main-menu');
    const travelMenu = document.getElementById('travel-menu');

    if(tab === 'crimes') {
        mainMenu.classList.remove('hidden');
        travelMenu.classList.add('hidden');
        renderCrimes(playerData.location);
    } else if(tab === 'travel') {
        mainMenu.classList.add('hidden');
        travelMenu.classList.remove('hidden');
        renderTravel();
    }
}
window.switchTab = switchTab; // Expose to global

function renderCrimes(locationName) {
    const container = document.getElementById('main-menu');
    container.innerHTML = ''; // Clear previous
    const crimes = LOCATIONS[locationName].crimes;

    crimes.forEach((crime, index) => {
        const div = document.createElement('div');
        div.className = 'action-btn';
        div.innerHTML = `
            <h4>${crime.name}</h4>
            <p>Energy: ${crime.energy} | Nerve: ${crime.nerve}</p>
            <p>Risk: ${crime.risk}</p>
        `;
        div.onclick = () => commitCrime(index);
        container.appendChild(div);
    });
}

function renderTravel() {
    const container = document.getElementById('travel-menu');
    container.innerHTML = '';
    
    const currentLoc = playerData.location;
    Object.keys(LOCATIONS).forEach(locName => {
        if(locName === currentLoc) return; // Don't show current location

        const div = document.createElement('div');
        div.className = 'action-btn';
        div.innerHTML = `
            <h4>Travel to ${locName}</h4>
            <p>Cost: $50</p>
        `;
        div.onclick = () => travelTo(locName);
        container.appendChild(div);
    });
}

// --- CORE MECHANICS ---

window.commitCrime = async function(index) {
    const loc = playerData.location;
    const crime = LOCATIONS[loc].crimes[index];

    // 1. Check Requirements
    if(playerData.energy < crime.energy) return addLog("Not enough energy!", "red");
    if(playerData.nerve < crime.nerve) return addLog("Not enough nerve!", "red");

    // 2. Determine Outcome (Random % based on risk)
    let successChance = 90; // Base
    if(crime.risk === 'med') successChance = 70;
    if(crime.risk === 'high') successChance = 40;

    const roll = Math.random() * 100;

    // 3. Update Database (Atomic Transaction)
    try {
        await db.runTransaction(async (t) => {
            const doc = await t.get(playerRef);
            if (!doc.exists) return;

            const data = doc.data();
            let updates = {
                energy: data.energy - crime.energy,
                nerve: data.nerve - crime.nerve
            };

            if (roll < successChance) {
                // SUCCESS
                const payout = Math.floor(Math.random() * (crime.maxPay - crime.minPay + 1)) + crime.minPay;
                updates.cash = data.cash + payout;
                updates.xp = data.xp + crime.xp;
                addLog(`Success! You earned $${payout} and ${crime.xp} XP.`, "green");
                
                // Simple Level Up Logic
                if(updates.xp >= data.level * 100) {
                    updates.level = data.level + 1;
                    addLog(`LEVEL UP! You are now level ${updates.level}`, "gold");
                }
            } else {
                // FAILURE
                addLog(`Failed! You were caught or messed up.`, "red");
            }

            t.update(playerRef, updates);
        });
    } catch (e) {
        console.error("Transaction failure:", e);
    }
}

window.travelTo = async function(destination) {
    if(playerData.cash < 50) return addLog("Need $50 to travel!", "red");
    
    await playerRef.update({
        location: destination,
        cash: playerData.cash - 50,
        energy: playerData.energy - 10 // Travel takes effort
    });
    
    addLog(`Traveled to ${destination}. -$50`, "orange");
    switchTab('crimes'); // Switch back to crimes tab automatically
}

function addLog(msg, color = "white") {
    const log = document.getElementById('game-log');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.style.color = color;
    entry.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
    log.prepend(entry); // Add to top
}

// --- UTILITY ---
// Simple token regeneration (Run this manually in console or set up Cloud Functions)
// For a local demo, let's just give energy back every minute for playability
setInterval(() => {
    if(playerRef && playerData) {
        let energyGain = 5;
        let nerveGain = 2;
        
        if(playerData.energy < 100 || playerData.nerve < 50) {
            playerRef.update({
                energy: Math.min(100, playerData.energy + energyGain),
                nerve: Math.min(50, playerData.nerve + nerveGain)
            });
        }
    }
}, 60000); // Every 60 seconds
