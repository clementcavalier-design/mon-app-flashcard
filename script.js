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
    const container = document.getElementById('theme-list');
    container.innerHTML = '';

    // 1. Calcul des données par thème
    const themeData = [...new Set(allCards.map(c => c.theme))].map(t => {
        const total = allCards.filter(c => c.theme === t).length;
        const due = allCards.filter(c => c.theme === t && new Date(c.nextReview) <= new Date()).length;
        const nonTraiteesPercent = (due / total) * 100;
        const traiteesPercent = ((total - due) / total) * 100;
        
        return { name: t, total, due, nonTraiteesPercent, traiteesPercent };
    });

    // 2. TRI DYNAMIQUE : On affiche en premier ceux qui ont le plus de cartes à réviser (DUE)
    themeData.sort((a, b) => b.due - a.due);

    // 3. AFFICHAGE ET COULEURS
    themeData.forEach(t => {
        let colorClass = "";
        
        // Logique de couleur selon tes critères
        if (t.total < 5) {
            colorClass = "theme-purple"; // Violet : Moins de 5 questions
        } else if (t.traiteesPercent >= 80) {
            colorClass = "theme-green";  // Vert : Plus de 80% traitées
        } else if (t.nonTraiteesPercent > 75) {
            colorClass = "theme-red";    // Rouge : Plus de 75% non traitées
        } else {
            colorClass = "theme-yellow"; // Jaune : Entre les deux
        }

        const card = document.createElement('div');
        card.className = `theme-card ${colorClass}`;
        card.innerHTML = `
            <h3>${t.name}</h3>
            <p><strong>${t.due}</strong> à réviser sur ${t.total}</p>
            <button onclick="startSession('${t.name}')">Étudier</button>
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
    if (!card.streak) card.streak = 0;

    let delayInHours = 0;

    if (level === 1) { // REVOIR : 1h
        delayInHours = 1;
        card.streak = 0;
    } else if (level === 2) { // MOYEN : 6h
        delayInHours = 6;
        card.streak = 0;
    } else if (level === 3) { // FACILE (Dynamique)
        card.streak += 1;
        switch(card.streak) {
            case 1: delayInHours = 24; break;  // 24h
            case 2: delayInHours = 48; break;  // 48h
            case 3: delayInHours = 72; break;  // 72h
            case 4: delayInHours = 168; break; // 1 semaine
            default: delayInHours = 360;       // 15 jours
        }
    }

    card.nextReview = new Date(now.getTime() + (delayInHours * 60 * 60 * 1000)).toISOString();
    
    // Sauvegarde locale
    const progress = JSON.parse(localStorage.getItem('srs_data') || '{}');
    progress[card.question] = { nextReview: card.nextReview, streak: card.streak };
    localStorage.setItem('srs_data', JSON.stringify(progress));

    nextCard();
}

function exitToMenu() {
    document.getElementById('menu-screen').classList.remove('hidden');
    document.getElementById('study-screen').classList.add('hidden');
    renderMenu();
}

window.onload = loadData;