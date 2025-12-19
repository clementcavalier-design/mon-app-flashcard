const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1EaztEv2c8wZtWOgyC2wOPanelQ5BNhtefVIySOc9M4w/gviz/tq?tqx=out:json&gid=0';

let allCards = [];
let sessionCards = [];
let currentIndex = 0;
let isShowingAnswer = false;

// 1. CHARGEMENT
async function loadData() {
    try {
        const response = await fetch(SHEET_URL);
        const text = await response.text();
        const json = JSON.parse(text.substring(47, text.length - 2));
        const rows = json.table.rows;

        const localProgress = JSON.parse(localStorage.getItem('srs_data') || '{}');

        allCards = rows.slice(1).map(r => {
            const q = r.c[0]?.v || '';
            const a = r.c[1]?.v || '';
            const t = (r.c[2]?.v || 'AUTRE').trim().toUpperCase();
            
            return {
                question: q,
                answer: a,
                theme: t,
                nextReview: localProgress[q]?.nextReview || new Date().toISOString(),
                interval: localProgress[q]?.interval || 0
            };
        }).filter(c => c.question.length > 2);

        renderMenu();
    } catch (e) {
        document.getElementById('theme-list').innerHTML = "Erreur de connexion au Google Sheet.";
    }
}

// 2. MENU
function renderMenu() {
    const themes = [...new Set(allCards.map(c => c.theme))];
    const container = document.getElementById('theme-list');
    container.innerHTML = '';

    themes.forEach(t => {
        const count = allCards.filter(c => c.theme === t).length;
        const due = allCards.filter(c => c.theme === t && new Date(c.nextReview) <= new Date()).length;
        
        const card = document.createElement('div');
        card.className = 'theme-card';
        card.innerHTML = `
            <h3>${t}</h3>
            <p>${due} à réviser / ${count}</p>
            <button onclick="startSession('${t}')">Étudier</button>
        `;
        container.appendChild(card);
    });
}

// 3. LOGIQUE DE SESSION
function startSession(theme) {
    // On prend les cartes dues en priorité, sinon tout le thème
    let due = allCards.filter(c => c.theme === theme && new Date(c.nextReview) <= new Date());
    sessionCards = due.length > 0 ? due : allCards.filter(c => c.theme === theme);
    
    currentIndex = 0;
    document.getElementById('menu-screen').classList.add('hidden');
    document.getElementById('study-screen').classList.remove('hidden');
    showCard();
}

function showCard() {
    const card = sessionCards[currentIndex];
    isShowingAnswer = false;
    document.getElementById('card-content').textContent = card.question;
    document.getElementById('card-theme-label').textContent = card.theme;
    document.getElementById('card-count-label').textContent = `${currentIndex + 1}/${sessionCards.length}`;
    document.getElementById('controls').classList.add('hidden');
    document.getElementById('tap-hint').textContent = "Cliquer pour voir la réponse";
}

function flipCard() {
    if (isShowingAnswer) return;
    isShowingAnswer = true;
    document.getElementById('card-content').textContent = sessionCards[currentIndex].answer;
    document.getElementById('controls').classList.remove('hidden');
    document.getElementById('tap-hint').textContent = "";
}

function submitAnswer(level) {
    const card = sessionCards[currentIndex];
    const now = new Date();
    
    // Algorithme SRS Simplifié (en jours)
    let days = 1;
    if (level === 2) days = 3;
    if (level === 3) days = 7;
    
    card.nextReview = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000)).toISOString();
    
    // Sauvegarde locale
    const progress = JSON.parse(localStorage.getItem('srs_data') || '{}');
    progress[card.question] = { nextReview: card.nextReview };
    localStorage.setItem('srs_data', JSON.stringify(progress));

    nextCard();
}

function nextCard() {
    currentIndex++;
    if (currentIndex < sessionCards.length) {
        showCard();
    } else {
        exitToMenu();
    }
}

function exitToMenu() {
    document.getElementById('menu-screen').classList.remove('hidden');
    document.getElementById('study-screen').classList.add('hidden');
    renderMenu();
}

window.onload = loadData;