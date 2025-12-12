// ========================================================================
// 1. CONFIGURATION (Méthode SIMPLE SANS API KEY - NÉCESSITE PARTAGE PUBLIC)
// ========================================================================

// VOTRE URL DE DONNÉES PUBLIQUES (confirmée comme fonctionnelle)
const GOOGLE_DATA_URL = 'https://docs.google.com/spreadsheets/d/1EaztEv2c8wZtWOgyC2wOPanelQ5BNhtefVIySOc9M4w/gviz/tq?tqx=out:json&gid=0'; 


// ========================================================================
// 2. Variables Globales
// ========================================================================

let flashcards = [];
let cardData = [];
let currentCardIndex = -1;
let isAnswerShown = false;
let currentTheme = null; // Variable pour le thème sélectionné

const COLUMN_NAMES = {
    QUESTION: 0,
    ANSWER: 1,
    THEME: 2
};

// ========================================================================
// 3. Récupération des données du Google Sheet
// ========================================================================

function getCardsFromSheets() {
    fetch(GOOGLE_DATA_URL)
        .then(response => {
            if (!response.ok) {
                throw new Error('Erreur réseau lors de la récupération des données.');
            }
            return response.text();
        })
        .then(data => {
            // Extraction du JSON brut (format spécifique de Google Visualization API)
            const jsonText = data.substring(data.indexOf('{'), data.lastIndexOf('}') + 1);
            
            if (!jsonText || jsonText.length < 10) {
                 document.getElementById('theme-list').innerHTML = "Erreur: La feuille est vide ou n'est pas partagée en mode 'Lecteur'.";
                 return;
            }
            
            const parsedData = JSON.parse(jsonText);
            const rows = parsedData.table.rows;
            
            if (rows.length > 1) { 
                const rawData = rows.slice(1); 
                
                cardData = rawData.map(row => [
                    row.c[COLUMN_NAMES.QUESTION]?.v || '', 
                    row.c[COLUMN_NAMES.ANSWER]?.v || '',   
                    row.c[COLUMN_NAMES.THEME]?.v || 'Non classé'
                ]);
                
                loadLocalCards();
            } else {
                document.getElementById('theme-list').innerHTML = "Aucune donnée de flashcard trouvée dans la feuille publique.";
            }
        })
        .catch(error => {
            document.getElementById('theme-list').innerHTML = `Erreur de connexion : ${error.message}. Vérifiez l'URL de données publiques et le partage.`;
            console.error("Erreur de connexion:", error);
        });
}

// ========================================================================
// 4. Logique de la Répétition Espacée (SRS) et Persistance
// ========================================================================

function loadLocalCards() {
    const localData = localStorage.getItem('flashcardProgress');
    let localCards = localData ? JSON.parse(localData) : [];

    flashcards = cardData.map(sheetCard => {
        const question = sheetCard[COLUMN_NAMES.QUESTION];
        let progress = localCards.find(lc => lc.question === question);
        
        if (!progress) {
            progress = {
                question: question,
                nextReview: new Date().toISOString(), 
                interval: 0,
                easinessFactor: 2.5 
            };
        }
        
        progress.answer = sheetCard[COLUMN_NAMES.ANSWER];
        progress.theme = sheetCard[COLUMN_NAMES.THEME] || 'Non classé';
        
        return progress;
    });

    saveLocalCards();
    showMenu(); // Démarrer sur le menu
}

function saveLocalCards() {
    localStorage.setItem('flashcardProgress', JSON.stringify(flashcards));
}

// ========================================================================
// 5. Fonctions d'Affichage du Menu et des Stats
// ========================================================================

function showMenu() {
    document.getElementById('menu-container').classList.remove('hidden');
    document.getElementById('card-container').classList.add('hidden');
    document.getElementById('back-to-menu').classList.add('hidden');
    document.getElementById('status-message').textContent = "";
    currentTheme = null;
    displayStats(); 
}

function startReview(selectedTheme) {
    // Utiliser trim() pour nettoyer les espaces potentiels dans le nom du thème
    currentTheme = selectedTheme.trim(); 
    document.getElementById('menu-container').classList.add('hidden');
    document.getElementById('card-container').classList.remove('hidden');
    document.getElementById('back-to-menu').classList.remove('hidden');
    document.getElementById('status-message').textContent = "";
    
    showNextCard();
}

function displayStats() {
    const themeStats = {};
    let totalCards = 0;
    let reviewedCards = 0; 
    let totalDueToday = 0; 
    const now = new Date();

    // 1. Calcul des statistiques
    flashcards.forEach(card => {
        // Nettoyer le thème de la carte pour la classification
        const theme = (card.theme || 'Non classé').trim(); 
        totalCards++;

        if (!themeStats[theme]) {
            // Initialisation correcte
            themeStats[theme] = { total: 0, reviewed: 0, dueToday: 0 }; 
        }

        themeStats[theme].total++;

        if (card.interval > 0) {
            themeStats[theme].reviewed++;
            reviewedCards++;
        }
        
        if (new Date(card.nextReview) <= now) {
            themeStats[theme].dueToday++;
            totalDueToday++;
        }
    });

    // 2. Affichage des statistiques par thème
    const themeListElement = document.getElementById('theme-list');
    themeListElement.innerHTML = ''; 

    for (const theme in themeStats) {
        const stats = themeStats[theme];
        const themeButton = document.createElement('div');
        themeButton.className = 'theme-stat-item';
        
        const reviewPercentage = stats.total > 0 ? Math.round((stats.reviewed / stats.total) * 100) : 0;
        
        let buttonText = 'Commencer la révision';
        let buttonClass = 'btn difficulty-3';

        if (stats.dueToday > 0) {
            buttonText = `RÉVISER ${stats.dueToday} CARTE(S) MAINTENANT`;
            buttonClass = 'btn difficulty-1'; // Rouge pour l'urgence
        } else if (stats.reviewed === stats.total) {
            buttonText = 'Félicitations, rien à réviser !';
            buttonClass = 'btn difficulty-2';
        }

        themeButton.innerHTML = `
            <h3>${theme}</h3>
            
            <p><strong>Total cartes :</strong> ${stats.total}</p>
            <p><strong>Cartes à réviser :</strong> <span class="due-count">${stats.dueToday}</span></p>

            <p style="font-size:0.8em; margin-top: 10px;">Progression totale du thème: ${stats.reviewed} / ${stats.total} (${reviewPercentage}%)</p>
            
            <button onclick="startReview('${theme}')" class="${buttonClass}">${buttonText}</button>
        `;
        themeListElement.appendChild(themeButton);
    }
    
    // 3. Affichage des statistiques globales
    const totalPercentage = totalCards > 0 ? Math.round((reviewedCards / totalCards) * 100) : 0;
    document.getElementById('overall-stats').innerHTML = `
        <p><strong>Total cartes dues aujourd'hui :</strong> ${totalDueToday}</p>
        <p><strong>Total cartes dans l'application :</strong> ${totalCards}</p>
        <p><strong>Progression totale :</strong> ${reviewedCards} / ${totalCards} (${totalPercentage}%)</p>
    `;
}

// ========================================================================
// 6. Logique de Révision et Affichage des Cartes
// ========================================================================

function showNextCard() {
    const now = new Date();
    
    const activeTheme = currentTheme ? currentTheme.trim() : null;

    // Filtrer les cartes DUES du thème sélectionné
    const dueCards = flashcards.filter(card => {
        const cardTheme = card.theme ? card.theme.trim() : null;
        
        return (
            // Comparer le thème nettoyé et vérifier la date de révision
            cardTheme === activeTheme && 
            new Date(card.nextReview) <= now
        );
    });
    
    document.getElementById('cards-due-count').textContent = dueCards.length;
    
    const questionDisplay = document.getElementById('question-display');
    const answerDisplay = document.getElementById('answer-display');
    const buttons = document.getElementById('evaluation-buttons');

    if (dueCards.length === 0) {
        questionDisplay.innerHTML = `🥳 Félicitations ! Aucune carte à réviser dans la thématique "${currentTheme}". Cliquez sur "Retour au Menu".`;
        answerDisplay.textContent = "";
        buttons.classList.add('hidden');
        document.getElementById('theme-display').textContent = `Thème : ${currentTheme}`;
        currentCardIndex = -1;
        return;
    }

    dueCards.sort((a, b) => new Date(a.nextReview) - new Date(b.nextReview));
    const nextCardData = dueCards[0];
    
    currentCardIndex = flashcards.findIndex(card => card.question === nextCardData.question);

    questionDisplay.textContent = nextCardData.question;
    document.getElementById('theme-display').textContent = `Thème : ${nextCardData.theme}`;
    
    answerDisplay.setAttribute('data-answer', nextCardData.answer);
    answerDisplay.textContent = "Cliquez pour voir la réponse";
    
    answerDisplay.classList.add('answer-hidden');
    buttons.classList.add('hidden');
    isAnswerShown = false;
}

function evaluateCard(quality) {
    if (currentCardIndex === -1) return;
    
    let card = flashcards[currentCardIndex];
    const now = new Date();
    
    let newEasinessFactor = card.easinessFactor;
    const MIN_EF = 1.3;
    const MAX_EF = 2.5;

    if (quality < 3) {
        newEasinessFactor = Math.max(MIN_EF, card.easinessFactor - 0.2); 
    } else {
        newEasinessFactor = card.easinessFactor + (0.1 - (4 - quality) * (0.08 + (4 - quality) * 0.02));
        newEasinessFactor = Math.min(MAX_EF, newEasinessFactor); 
    }
    
    card.easinessFactor = newEasinessFactor;

    let newInterval;
    if (quality < 3) {
        newInterval = 1; // 1 minute
    } else {
        if (card.interval === 0) {
            newInterval = 60; // 1 heure (premier succès)
        } else {
            newInterval = card.interval * card.easinessFactor;
        }
    }
    
    newInterval = Math.min(newInterval, 60 * 24 * 60); 
    card.interval = newInterval;

    const intervalMs = newInterval * 60 * 1000;
    card.nextReview = new Date(now.getTime() + intervalMs).toISOString();

    let nextReviewDisplay = (newInterval < 60) ? 
        `dans ${Math.round(newInterval)} minute(s)` : 
        (newInterval < 1440) ? 
        `dans ${Math.round(newInterval / 60)} heure(s)` :
        `dans ${Math.round(newInterval / 1440)} jour(s)`;
        
    document.getElementById('status-message').textContent = `Prochaine révision : ${nextReviewDisplay}`;

    saveLocalCards();
    showNextCard();
    
    setTimeout(() => {
        document.getElementById('status-message').textContent = "";
    }, 3000);
}

function toggleAnswer() {
    if (currentCardIndex === -1) return; 

    const answerDisplay = document.getElementById('answer-display');
    const buttons = document.getElementById('evaluation-buttons');
    
    if (!isAnswerShown) {
        // Récupérer et afficher la réponse stockée
        const actualAnswer = answerDisplay.getAttribute('data-answer'); 
        answerDisplay.textContent = actualAnswer;
        
        answerDisplay.classList.remove('answer-hidden');
        buttons.classList.remove('hidden');
        isAnswerShown = true;
    } 
}


// Démarrer l'application (appel direct à la fonction de récupération des données)
window.onload = getCardsFromSheets;