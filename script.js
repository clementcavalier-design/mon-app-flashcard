const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1EaztEv2c8wZtWOgyC2wOPanelQ5BNhtefVIySOc9M4w/gviz/tq?tqx=out:json&gid=0';

let allCards = [];
let sessionCards = [];
let currentIndex = 0;
let isShowingAnswer = false;

// 1. CHARGEMENT DES DONNÉES
async function loadData() {
    try {
        const response = await fetch(SHEET_URL);
        const text = await response.text();
        // Extraction du JSON de Google Sheets
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
        console.error("Erreur de chargement:", e);
        const themeList = document.getElementById('theme-list');
        if(themeList) themeList.innerHTML = "Erreur de connexion au Google Sheet. Vérifiez la publication du fichier.";
    }
}

// 2. RENDU DU MENU (Tri par urgence et Couleurs dynamiques)
function renderMenu() {
    const container = document.getElementById('theme-list');
    if (!container) return;
    container.innerHTML = '';

    const themeNames = [...new Set(allCards.map(c => c.theme))];
    const themeData = themeNames.map(t => {
        const themeCards = allCards.filter(c => c.theme === t);
        const total = themeCards.length;
        const due = themeCards.filter(c => new Date(c.nextReview) <= new Date()).length;
        
        const traiteesCount = themeCards.filter(c => {
            const prog = JSON.parse(localStorage.getItem('srs_data') || '{}')[c.question];
            return prog && prog.streak > 0;
        }).length;

        const traiteesPercent = (traiteesCount / total) * 100;
        const nonTraiteesPercent = (due / total) * 100;
        
        return { name: t, total, due, nonTraiteesPercent, traiteesPercent };
    });

    // Tri : thèmes avec le plus de cartes dues en premier
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
    // Si rien n'est dû, on propose quand même toutes les cartes du thème
    sessionCards = due.length > 0 ? due : allCards.filter(c => c.theme === theme);
    
    currentIndex = 0;
    document.getElementById('menu-container')?.classList.add('hidden');
    document.getElementById('menu-screen')?.classList.add('hidden'); // Compatibilité avec vos versions
    
    document.getElementById('card-container')?.classList.remove('hidden');
    document.getElementById('study-screen')?.classList.remove('hidden');
    
    document.getElementById('back-to-menu')?.classList.remove('hidden');
    showCard();
}

function showCard() {
    if (currentIndex >= sessionCards.length) {
        alert("Session terminée ! Bravo.");
        exitToMenu();
        return;
    }

    const card = sessionCards[currentIndex];
    isShowingAnswer = false;
    
    const content = document.getElementById('card-content') || document.getElementById('question-display');
    const themeLabel = document.getElementById('card-theme-label') || document.getElementById('theme-display');
    const countLabel = document.getElementById('card-count