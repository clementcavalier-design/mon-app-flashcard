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
                // CORRECTION ICI : On récupère aussi le streak sauvegardé
                nextReview: localProgress[q]?.nextReview || new Date().toISOString(),
                streak: localProgress[q]?.streak || 0 
            };
        }).filter(c => c.question.length > 2);

        renderMenu();
    } catch (e) {
        console.error(e);
        document.getElementById('theme-list').innerHTML = "Erreur de connexion au Google Sheet.";
    }
}

// 2. MENU (Tri et Couleurs)
function renderMenu() {
    const container = document.getElementById('theme-list');
    container.innerHTML = '';

    const themeNames = [...new Set(allCards.map(c => c.theme))];
    const themeData = themeNames.map(t => {
        const themeCards = allCards.filter(c => c.theme === t);
        const total = themeCards.length;
        const due = themeCards.filter(c => new Date(c.nextReview) <= new Date()).length;
        
        const nonTraiteesPercent = (due / total) * 100;
        const traiteesPercent = ((total - due) / total) * 100;
        
        return { name: t, total, due, nonTraiteesPercent, traiteesPercent };
    });

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
    document.getElementById('menu-screen').classList.add('hidden');
    document.getElementById('study-screen').classList.remove('hidden');
    showCard();
}

function showCard() {
    // Vérification si on a fini la session
    if (currentIndex >= sessionCards.length) {
        exitToMenu();
        return;
    }

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

    // Calcul des délais
    if (level === 1) { 
        delayInHours = 1;
        card.streak = 0;
    } else if (level === 2) { 
        delayInHours = 6;
        card.streak = 0;
    } else if (level === 3) { 
        card.streak += 1;
        switch(card.streak) {
            case 1: delayInHours = 24; break;
            case 2: delayInHours = 48; break;
            case 3: delayInHours = 72; break;
            case 4: delayInHours = 168; break;
            case 5: delayInHours = 360; break;
            default: delayInHours = 720;
        }
    }

    card.nextReview = new Date(now.getTime() + (delayInHours * 60 * 60 * 1000)).toISOString();
    
    // Sauvegarde
    const progress = JSON.parse(localStorage.getItem('srs_data') || '{}');
    progress[card.question] = { nextReview: card.nextReview, streak: card.streak };
    localStorage.setItem('srs_data', JSON.stringify(progress));

    // --- LA CORRECTION EST ICI ---
    currentIndex++; // On passe à l'index suivant
    showCard();     // On affiche la nouvelle carte
}

    card.nextReview = new Date(now.getTime() + (delayInHours * 60 * 60 * 1000)).toISOString();
    
    const progress = JSON.parse(localStorage.getItem('srs_data') || '{}');
    progress[card.question] = { 
        nextReview: card.nextReview,
        streak: card.streak 
    };
    localStorage.setItem('srs_data', JSON.stringify(progress));

    // CORRECTION : On incrémente AVANT d'afficher la suivante
    currentIndex++; 
    showCard(); 
}

function exitToMenu() {
    document.getElementById('menu-screen')?.classList.remove('hidden');
    document.getElementById('study-screen')?.classList.add('hidden');
    renderMenu();
}

window.onload = loadData;