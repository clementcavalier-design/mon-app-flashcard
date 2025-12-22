const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1EaztEv2c8wZtWOgyC2wOPanelQ5BNhtefVIySOc9M4w/gviz/tq?tqx=out:json&gid=0';

let allCards = [];
let sessionCards = [];
let currentIndex = 0;
let isShowingAnswer = false;

// 1. CHARGEMENT INITIAL
async function loadData() {
    try {
        const response = await fetch(SHEET_URL);
        const text = await response.text();
        // On extrait le JSON du format Google
        const json = JSON.parse(text.substring(47, text.length - 2));
        const rows = json.table.rows;

        const localProgress = JSON.parse(localStorage.getItem('srs_data') || '{}');

        allCards = rows.slice(1).map(r => {
            const q = r.c[0]?.v || '';
            const a = r.c[1]?.v || '';
            const t = (r.c[2]?.v || 'AUTRE').trim().toUpperCase();
            
            // On vérifie si la carte a été ignorée précédemment
            const isIgnored = localProgress[q]?.isIgnored || false;

            return {
                question: q,
                answer: a,
                theme: t,
                nextReview: localProgress[q]?.nextReview || new Date().toISOString(),
                streak: localProgress[q]?.streak || 0,
                isIgnored: isIgnored
            };
        })
        // On ne garde que les cartes valides ET qui ne sont pas ignorées
        .filter(c => c.question.length > 2 && !c.isIgnored);

        renderMenu();
    } catch (e) {
        console.error("Erreur de chargement:", e);
        document.getElementById('theme-list').innerHTML = "Erreur : Impossible de charger le Google Sheet.";
    }
}

// 2. AFFICHAGE DU MENU (Tri et Couleurs)
function renderMenu() {
    const container = document.getElementById('theme-list');
    if (!container) return;
    container.innerHTML = '';

    const themeNames = [...new Set(allCards.map(c => c.theme))];
    const themeData = themeNames.map(t => {
        const themeCards = allCards.filter(c => c.theme === t);
        const total = themeCards.length;
        const due = themeCards.filter(c => new Date(c.nextReview) <= new Date()).length;
        
        // On calcule le % de cartes déjà maîtrisées (streak > 0)
        const mastered = themeCards.filter(c => c.streak > 0).length;
        const masteredPercent = (mastered / total) * 100;
        const duePercent = (due / total) * 100;
        
        return { name: t, total, due, masteredPercent, duePercent };
    });

    // TRI : Les thèmes avec le plus de cartes dues en haut
    themeData.sort((a, b) => b.due - a.due);

    themeData.forEach(t => {
        let colorClass = "";
        if (t.total < 5) colorClass = "theme-purple";
        else if (t.masteredPercent >= 80) colorClass = "theme-green";
        else if (t.duePercent > 75) colorClass = "theme-red";
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

// 3. LOGIQUE DES SESSIONS
function startSession(theme) {
    let due = allCards.filter(c => c.theme === theme && new Date(c.nextReview) <= new Date());
    // Si rien n'est dû, on montre tout pour pouvoir réviser quand même
    sessionCards = due.length > 0 ? due : allCards.filter(c => c.theme === theme);
    
    currentIndex = 0;
    document.getElementById('menu-container').classList.add('hidden');
    document.getElementById('card-container').classList.remove('hidden');
    document.getElementById('back-to-menu').classList.remove('hidden');
    showCard();
}

function showCard() {
    if (currentIndex >= sessionCards.length) {
        alert("Bravo ! Session terminée.");
        exitToMenu();
        return;
    }

    const card = sessionCards[currentIndex];
    isShowingAnswer = false;
    
    document.getElementById('question-display').textContent = card.question;
    document.getElementById('theme-display').textContent = "Thème : " + card.theme;
    document.getElementById('cards-due-count').textContent = `${currentIndex + 1}/${sessionCards.length}`;
    
    const answerBtn = document.getElementById('answer-display');
    answerBtn.textContent = "Cliquez pour voir la réponse";
    answerBtn.classList.add('answer-hidden');
    
    document.getElementById('evaluation-buttons').classList.add('hidden');
}

function toggleAnswer() {
    if (isShowingAnswer) return;
    isShowingAnswer = true;
    
    const card = sessionCards[currentIndex];
    const answerBtn = document.getElementById('answer-display');
    answerBtn.textContent = card.answer;
    answerBtn.classList.remove('answer-hidden');
    document.getElementById('evaluation-buttons').classList.remove('hidden');
}

function evaluateCard(level) {
    const card = sessionCards[currentIndex];
    const now = new Date();
    
    if (!card.streak) card.streak = 0;
    let delayInHours = 0;

    if (level === 1) { // REVOIR
        delayInHours = 1;
        card.streak = 0;
    } else if (level === 2) { // MOYEN
        delayInHours = 6;
        card.streak = 0;
    } else if (level >= 3) { // FACILE
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
    
    const progress = JSON.parse(localStorage.getItem('srs_data') || '{}');
    progress[card.question] = { 
        nextReview: card.nextReview, 
        streak: card.streak,
        isIgnored: false 
    };
    localStorage.setItem('srs_data', JSON.stringify(progress));

    // PASSAGE AUTOMATIQUE
    currentIndex++;
    showCard();
}

// 4. FONCTION POUR IGNORER UNE CARTE
function ignoreCard() {
    if (!confirm("Voulez-vous vraiment exclure cette carte ? Elle ne vous sera plus proposée.")) return;

    const card = sessionCards[currentIndex];
    
    // On met à jour le localStorage avec le flag isIgnored
    const progress = JSON.parse(localStorage.getItem('srs_data') || '{}');
    progress[card.question] = { 
        ...progress[card.question], // conserve l'historique si existant
        isIgnored: true 
    };
    localStorage.setItem('srs_data', JSON.stringify(progress));

    // On passe à la suivante
    currentIndex++;
    showCard();
}

function exitToMenu() {
    document.getElementById('menu-container').classList.remove('hidden');
    document.getElementById('card-container').classList.add('hidden');
    document.getElementById('back-to-menu').classList.add('hidden');
    // On recharge les données pour que la carte ignorée disparaisse des totaux
    loadData();
}

function showMenu() { exitToMenu(); }

window.onload = loadData;
