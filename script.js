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
                streak: localProgress[q]?.streak || 0 
            };
        }).filter(c => c.question.length > 2);

        renderMenu();
    } catch (e) {
        console.error("Erreur de chargement :", e);
        document.getElementById('theme-list').innerHTML = "Erreur de connexion au Google Sheet.";
    }
}

// 2. MENU (Tri dynamique et Couleurs)
function renderMenu() {
    const container = document.getElementById('theme-list');
    if (!container) return;
    container.innerHTML = '';

    const themeNames = [...new Set(allCards.map(c => c.theme))];
    const themeData = themeNames.map(t => {
        const themeCards = allCards.filter(c => c.theme === t);
        const total = themeCards.length;
        const due = themeCards.filter(c => new Date(c.nextReview) <= new Date()).length;
        
        // Calcul du % traité (cartes avec au moins 1 succès)
        const traiteesCount = themeCards.filter(c => c.streak > 0).length;
        const traiteesPercent = (traiteesCount / total) * 100;
        const nonTraiteesPercent = (due / total) * 100;
        
        return { name: t, total, due, nonTraiteesPercent, traiteesPercent };
    });

    // Tri par nombre de cartes à réviser (DUE)
    themeData.sort((a, b) => b.due - a.due);

    themeData.forEach(t => {
        let colorClass = "";
        if (t.total < 5) colorClass = "theme-purple";
        else if (t.traiteesPercent >= 80) colorClass = "theme-green";
        else if (t.nonTraiteesPercent > 75) colorClass = "theme-red";
        else colorClass = "theme-yellow";

        const card = document.createElement('div');
        card.className = `theme-card ${colorClass}`;
        card.innerHTML = `
            <h3>${t.name}</h3>
            <p><strong>${t.due}</strong> à réviser / ${t.total}</p>
            <button onclick="startSession('${t.name}')">Étudier</button>
        `;
        container.appendChild(card);
    });
}

// 3. LOGIQUE DE SESSION
function startSession(theme) {
    let due = allCards.filter(c => c.theme === theme && new Date(c.nextReview) <= new Date());
    sessionCards = due.length > 0 ? due : allCards.filter(c => c.theme === theme);
    
    currentIndex = 0;
    document.getElementById('menu-container').classList.add('hidden');
    document.getElementById('card-container').classList.remove('hidden');
    document.getElementById('back-to-menu').classList.remove('hidden');
    showCard();
}

function showCard() {
    if (currentIndex >= sessionCards.length) {
        alert("Session terminée !");
        exitToMenu();
        return;
    }

    const card = sessionCards[currentIndex];
    isShowingAnswer = false;
    
    document.getElementById('question-display').textContent = card.question;
    document.getElementById('theme-display').textContent = "Thème : " + card.theme;
    document.getElementById('cards-due-count').textContent = `${currentIndex + 1}/${sessionCards.length}`;
    
    const answerDisplay = document.getElementById('answer-display');
    answerDisplay.textContent = "Cliquez pour voir la réponse";
    answerDisplay.classList.add('answer-hidden');
    
    document.getElementById('evaluation-buttons').classList.add('hidden');
}

function toggleAnswer() {
    if (isShowingAnswer) return;
    isShowingAnswer = true;
    
    const card = sessionCards[currentIndex];
    const answerDisplay = document.getElementById('answer-display');
    answerDisplay.textContent = card.answer;
    answerDisplay.classList.remove('answer-hidden');
    document.getElementById('evaluation-buttons').classList.remove('hidden');
}

function evaluateCard(level) {
    const card = sessionCards[currentIndex];
    const now = new Date();
    
    if (!card.streak) card.streak = 0;
    let delayInHours = 0;

    if (level === 1) { // Difficile
        delayInHours = 1;
        card.streak = 0;
    } else if (level === 2)