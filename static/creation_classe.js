// ─── État ────────────────────────────────────────
let currentStep = 1;
const MAX_STEPS = 6;
let students = [];
let preAssignations = {}; // { "6ème - Classe 1": ["fullName", ...] }
let currentRepartition = {};
let dragPayload = null;
let resultSearchQuery = '';
let pendingImportModalResolver = null;
let currentImportPreviewRows = [];
let currentImportDetectedHeaderRowIndex = -1;
let currentImportDetection = null;
let importModalIsAdvancedMode = false;
let currentImportFileName = '';

console.log('[INIT] MAX_STEPS=', MAX_STEPS, 'currentStep=', currentStep);

// Vérifier que les boutons existent au chargement
document.addEventListener('DOMContentLoaded', function() {
    const btnNext = document.getElementById('btn-next');
    const btnPrev = document.getElementById('btn-prev');
    console.log('[DOMContentLoaded] btn-next found:', !!btnNext, 'btn-prev found:', !!btnPrev);
});

// ─── Helpers ─────────────────────────────────────
function getNiveau() {
    const el = document.querySelector('input[name="niveau"]:checked');
    return el ? el.value : '';
}
function getNbClasses() {
    const el = document.querySelector('input[name="nb_classes"]:checked');
    return el ? parseInt(el.value) : 0;
}
function getClassKeys() {
    const n = getNiveau(), nb = getNbClasses();
    return Array.from({ length: nb }, (_, i) => `${n} - Classe ${i + 1}`);
}

function getGlobalConstraints() {
    const maxPerClassRaw = document.getElementById('gc-max-per-class')?.value;
    const mixityMinRaw = document.getElementById('gc-mixity-min')?.value;
    const minSameSchoolRaw = document.getElementById('gc-min-same-school')?.value;

    return {
        max_per_class: maxPerClassRaw ? parseInt(maxPerClassRaw, 10) : null,
        mixity_min: mixityMinRaw ? parseInt(mixityMinRaw, 10) : null,
        min_same_school: minSameSchoolRaw ? parseInt(minSameSchoolRaw, 10) : null
    };
}

function prepareGlobalConstraintsDefaults() {
    const nbClasses = getNbClasses();
    if (!nbClasses) return;

    const recommendedMax = Math.ceil(students.length / nbClasses);
    const maxInput = document.getElementById('gc-max-per-class');
    const minSameSchoolInput = document.getElementById('gc-min-same-school');

    if (maxInput && !maxInput.value) {
        maxInput.value = recommendedMax;
    }
    if (minSameSchoolInput && !minSameSchoolInput.value) {
        minSameSchoolInput.value = 2;
    }
}

function setLoadingModalVisible(visible, message = '') {
    const modal = document.getElementById('loading-modal');
    if (!modal) return;

    const textEl = modal.querySelector('.loading-modal-text');
    if (textEl && message) {
        textEl.textContent = message;
    }

    modal.classList.toggle('hidden', !visible);
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getStudentByFullName(fullName) {
    return students.find(s => s.fullName === fullName) || null;
}

function getStudentLabel(student) {
    if (!student) return '';
    if (student.ecole) return `${student.fullName} (${student.ecole})`;
    return student.fullName;
}

function getStudentSearchText(student) {
    return [
        student.fullName,
        student.ecole || '',
        student.genre || '',
        student.demande_raw || '',
        ...(student.contraintes?.avec || []),
        ...(student.contraintes?.pas_avec || [])
    ].join(' ').toLowerCase();
}

const GENDER_NAME_DICTIONARY = {
    il: new Set([
        'adam', 'adrien', 'alexandre', 'amaury', 'antoine', 'arthur', 'axel', 'benjamin', 'bastian',
        'brice', 'clement', 'david', 'dorian', 'efecan', 'edouard', 'elouann', 'eloan', 'enzo',
        'erwan', 'ethan', 'felix', 'gabin', 'gabriel', 'gaspard', 'hugo', 'jacques', 'jahnel',
        'jean', 'jules', 'julien', 'kelyan', 'leo', 'leon', 'liam', 'louis', 'louenn', 'lucas',
        'mael', 'malone', 'mathis', 'mathieu', 'mathis', 'maxence', 'maxime', 'nathan', 'nael',
        'nayan', 'neven', 'noah', 'noham', 'nino', 'noham', 'owen', 'paul', 'quentin', 'raphael',
        'romain', 'simon', 'souhayl', 'thomas', 'tiago', 'timmo', 'titouan', 'tomoe', 'thayron',
        'tom', 'theo', 'théo', 'tylio', 'yanis', 'yann'
    ]),
    elle: new Set([
        'alice', 'alizee', 'aline', 'amaya', 'ambre', 'anais', 'anouck', 'anastasia', 'alycia', 'assia',
        'belle', 'bertille', 'bleuenn', 'candice', 'chloe', 'clara', 'clemence', 'djoy', 'eden',
        'elia', 'eline', 'elif', 'elza', 'emma', 'enora', 'eva', 'garance', 'inaya', 'isleen',
        'kayla', 'kenza', 'lady', 'laidy', 'layna', 'lea', 'leane', 'leyna', 'lila', 'lilou',
        'lolie', 'lola', 'lou', 'louise', 'louna', 'luna', 'maelys', 'mahera', 'mahe', 'maiwenn',
        'malwena', 'melaine', 'melisandre', 'melina', 'mila', 'nina', 'ninon', 'nora', 'olivia',
        'pelin', 'thaina', 'thais', 'valentine', 'youna', 'zoe'
    ])
};

const NORMALIZED_GENDER_NAME_DICTIONARY = {
    il: new Set(Array.from(GENDER_NAME_DICTIONARY.il).map(name => normalizeGenderKey(name))),
    elle: new Set(Array.from(GENDER_NAME_DICTIONARY.elle).map(name => normalizeGenderKey(name)))
};

function normalizeGenderKey(value) {
    return normalizeNameToken(value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(/[-\s]/)[0]
        .trim();
}

function getGenderDetectionProfile(prenom) {
    const key = normalizeGenderKey(prenom);
    if (!key) {
        return { genre: '', confidence: 0, source: 'empty', label: 'non détecté' };
    }

    if (NORMALIZED_GENDER_NAME_DICTIONARY.il.has(key)) {
        return { genre: 'il', confidence: 0.98, source: 'dictionnaire', label: 'détection fiable' };
    }

    if (NORMALIZED_GENDER_NAME_DICTIONARY.elle.has(key)) {
        return { genre: 'elle', confidence: 0.98, source: 'dictionnaire', label: 'détection fiable' };
    }

    if (/(ette|elle|ine|yne|ane|anne|ia|ie)$/i.test(key)) {
        return { genre: 'elle', confidence: 0.72, source: 'heuristique', label: 'détection approximative' };
    }

    if (/(us|is|on|an|en|el|er|rd|ld|rt|nt|m|n|l|r|t)$/i.test(key)) {
        return { genre: 'il', confidence: 0.68, source: 'heuristique', label: 'détection approximative' };
    }

    return { genre: '', confidence: 0.2, source: 'incertain', label: 'détection incertaine' };
}

function detectGenderFromPrenom(prenom) {
    return getGenderDetectionProfile(prenom).genre;
}

function ensureStudentConstraints(student) {
    if (!student.contraintes || typeof student.contraintes !== 'object') {
        student.contraintes = {
            avec: [],
            avec_operator: 'AND',
            avec_unresolved: [],
            pas_avec: [],
            pas_avec_operator: 'AND',
            pas_avec_unresolved: [],
            incomprehensible: false
        };
    }
    if (!Array.isArray(student.contraintes.avec)) student.contraintes.avec = [];
    if (!Array.isArray(student.contraintes.pas_avec)) student.contraintes.pas_avec = [];
    if (!Array.isArray(student.contraintes.avec_unresolved)) student.contraintes.avec_unresolved = [];
    if (!Array.isArray(student.contraintes.pas_avec_unresolved)) student.contraintes.pas_avec_unresolved = [];
    if (!student.contraintes.avec_operator) student.contraintes.avec_operator = 'AND';
    if (!student.contraintes.pas_avec_operator) student.contraintes.pas_avec_operator = 'AND';
    if (!('incomprehensible' in student.contraintes)) student.contraintes.incomprehensible = false;
    if (!('genre' in student)) student.genre = '';
    if (!('genre_confidence' in student)) student.genre_confidence = 0;
    if (!('genre_source' in student)) student.genre_source = '';
    if (!('genre_label' in student)) student.genre_label = '';
}

function normalizeNameToken(name) {
    return String(name || '')
        .replace(/^[\s,;:.\-]+|[\s,;:.\-]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeSchoolName(raw) {
    const trimmed = String(raw || '').trim().replace(/\s+/g, ' ');
    if (!trimmed) return '';
    // Capitalize each word, lower-case the rest, preserving accents.
    return trimmed.replace(/\S+/g, word =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    );
}

function normalizeStudentConstraintsReferences() {
    const byLower = new Map(students.map(s => [s.fullName.toLowerCase(), s.fullName]));

    students.forEach(s => {
        ensureStudentConstraints(s);

        const normalizeArray = (arr) => {
            const resolved = [];
            const unresolved = [];
            arr.forEach(raw => {
                const cleaned = normalizeNameToken(raw);
                if (!cleaned) return;
                const found = students.find(st => st.fullName.toLowerCase() === cleaned.toLowerCase());
                if (found) {
                    if (found.fullName.toLowerCase() !== s.fullName.toLowerCase()) {
                        if (!resolved.includes(found.fullName)) resolved.push(found.fullName);
                    }
                } else {
                    if (!unresolved.includes(cleaned)) unresolved.push(cleaned);
                }
            });
            return { resolved, unresolved };
        };

        const avecResult = normalizeArray(s.contraintes.avec);
        s.contraintes.avec = avecResult.resolved;
        s.contraintes.avec_unresolved = avecResult.unresolved;

        const pasAvecResult = normalizeArray(s.contraintes.pas_avec);
        s.contraintes.pas_avec = pasAvecResult.resolved.filter(name => !s.contraintes.avec.includes(name));
        s.contraintes.pas_avec_unresolved = pasAvecResult.unresolved;
    });
}

function updateUnresolvedConstraints() {
    // Met à jour uniquement les champs unresolved SANS modifier les contraintes actuelles.
    // Permet d'afficher les demandes originales non résolues en jaune.
    students.forEach(s => {
        ensureStudentConstraints(s);
        
        const parseOriginalDemands = (demande_raw) => {
            if (!demande_raw) return { avec: [], pas_avec: [], incomprehensible: false };
            
            // Réutiliser parseDemandeParticuliere pour cohérence
            return parseDemandeParticuliere(demande_raw);
        };
        
        // Parser la demande originale
        const original = parseOriginalDemands(s.demande_raw);
        
        // Marquer comme non-résolu les noms qui ne sont pas dans la liste des élèves
        // Normaliser le nom avant la comparaison
        s.contraintes.avec_unresolved = original.avec.filter(name => {
            const normalized = normalizeNameToken(name);
            if (!normalized) return false;
            return !students.some(st => st.fullName.toLowerCase() === normalized.toLowerCase());
        });
        
        s.contraintes.pas_avec_unresolved = original.pas_avec.filter(name => {
            const normalized = normalizeNameToken(name);
            if (!normalized) return false;
            return !students.some(st => st.fullName.toLowerCase() === normalized.toLowerCase());
        });
        
        // Tracker si la demande est incompréhensible
        s.contraintes.incomprehensible = original.incomprehensible;
    });
}

function addConstraintForStudent(sourceIdx, type, targetName) {
    const source = students[sourceIdx];
    if (!source) return;
    ensureStudentConstraints(source);

    const target = normalizeNameToken(targetName);
    if (!target || target === source.fullName) return;

    const key = type === 'pas_avec' ? 'pas_avec' : 'avec';
    const opposite = key === 'avec' ? 'pas_avec' : 'avec';

    if (!source.contraintes[key].includes(target)) {
        source.contraintes[key].push(target);
    }
    source.contraintes[opposite] = source.contraintes[opposite].filter(n => n !== target);
}

function removeConstraintForStudent(sourceIdx, type, targetName) {
    const source = students[sourceIdx];
    if (!source) return;
    ensureStudentConstraints(source);
    const key = type === 'pas_avec' ? 'pas_avec' : 'avec';
    source.contraintes[key] = source.contraintes[key].filter(n => n !== targetName);
}

function buildStudentOptionsHtml(selected = '') {
    const defaultOption = '<option value="">Choisir un élève</option>';
    const options = students.map(s => {
        const selectedAttr = s.fullName === selected ? ' selected' : '';
        return `<option value="${escapeHtml(s.fullName)}"${selectedAttr}>${escapeHtml(s.fullName)}</option>`;
    }).join('');
    return defaultOption + options;
}

function buildConstraintsEditor() {
    const body = document.getElementById('constraints-editor-body');
    const searchInput = document.getElementById('constraints-search');
    if (!body) return;

    if (searchInput && !searchInput.dataset.bound) {
        searchInput.addEventListener('input', () => buildConstraintsEditor());
        searchInput.dataset.bound = '1';
    }

    if (!students.length) {
        body.innerHTML = '<tr><td colspan="7"><span class="ce-empty">Aucun élève chargé.</span></td></tr>';
        return;
    }

    updateUnresolvedConstraints();

    const query = (searchInput?.value || '').trim().toLowerCase();
    const filteredStudents = !query
        ? students
        : students.filter(s => {
            const haystack = [
                s.fullName,
                s.ecole || '',
                s.demande_raw || '',
                ...(s.contraintes?.avec || []),
                ...(s.contraintes?.pas_avec || [])
            ].join(' ').toLowerCase();
            return haystack.includes(query);
        });

    if (!filteredStudents.length) {
        body.innerHTML = '<tr><td colspan="7"><span class="ce-empty">Aucun élève ne correspond à la recherche.</span></td></tr>';
        return;
    }

    body.innerHTML = filteredStudents.map((student) => {
        const idx = students.findIndex(s => s.fullName === student.fullName);
        ensureStudentConstraints(student);

        const chipsAvec = student.contraintes.avec.map(target => `
            <span class="ce-chip ce-chip-avec">avec ${escapeHtml(target)}
                <button type="button" class="ce-chip-remove" data-source-idx="${idx}" data-type="avec" data-target="${encodeURIComponent(target)}">×</button>
            </span>`).join('');

        const chipsPas = student.contraintes.pas_avec.map(target => `
            <span class="ce-chip ce-chip-pas">pas avec ${escapeHtml(target)}
                <button type="button" class="ce-chip-remove" data-source-idx="${idx}" data-type="pas_avec" data-target="${encodeURIComponent(target)}">×</button>
            </span>`).join('');

        // Chips avec les boutons ET/OU dans une colonne séparée
        const chips = `${chipsAvec}${chipsPas}` || '<span class="ce-empty">Aucune contrainte</span>';
        
        // Boutons ET/OU
        const operatorButtons = (() => {
            const buttons = [];
            if (student.contraintes.avec.length >= 2) {
                buttons.push(`<button type="button" class="ce-operator-toggle" data-source-idx="${idx}" data-type="avec" title="Basculer entre ET et OU pour 'avec'">
                    ${student.contraintes.avec_operator === 'AND' ? 'ET' : 'OU'}
                </button>`);
            }
            if (student.contraintes.pas_avec.length >= 2) {
                buttons.push(`<button type="button" class="ce-operator-toggle" data-source-idx="${idx}" data-type="pas_avec" title="Basculer entre ET et OU pour 'pas avec'">
                    ${student.contraintes.pas_avec_operator === 'AND' ? 'ET' : 'OU'}
                </button>`);
            }
            return buttons.join('');
        })();

        const ecoleBadge = student.ecole ? `<span class="ce-ecole-badge">${escapeHtml(student.ecole)}</span>` : '<span class="ce-empty">-</span>';
        const genreValue = student.genre || '';
        const genreCell = `
            <div class="ce-gender-cell">
                <button type="button" class="ce-gender-toggle ${genreValue === 'il' ? 'is-active' : ''}" data-source-idx="${idx}" data-gender="il" aria-pressed="${genreValue === 'il' ? 'true' : 'false'}" title="Modifier le genre">il</button>
                <button type="button" class="ce-gender-toggle ${genreValue === 'elle' ? 'is-active' : ''}" data-source-idx="${idx}" data-gender="elle" aria-pressed="${genreValue === 'elle' ? 'true' : 'false'}" title="Modifier le genre">elle</button>
            </div>`;
        const demandeContent = (() => {
            const parts = [];
            
            // Afficher la demande originale
            if (student.demande_raw) {
                parts.push(`<div>${escapeHtml(student.demande_raw)}</div>`);
            }
            
            // Afficher si la demande est incompréhensible
            if (student.contraintes.incomprehensible) {
                parts.push(`<div class="ce-demand-incomprehensible"><strong>⚠ Demande non comprise</strong></div>`);
            }
            
            // Afficher les non-résolus en jaune en dessous
            const unres = [
                ...(student.contraintes.avec_unresolved || []).map(n => `avec ${n}`),
                ...(student.contraintes.pas_avec_unresolved || []).map(n => `pas avec ${n}`)
            ];
            if (unres.length) {
                parts.push(`<div class="ce-demand-partial"><strong>⚠ Aucune correspondance :</strong><br/>${unres.map(u => `<span class="ce-demand-unresolved">${escapeHtml(u)}</span>`).join(', ')}</div>`);
            }
            
            return parts.length ? parts.join('') : '<span class="ce-empty">Aucune</span>';
        })();

        return `
            <tr>
                <td><span class="ce-student-name">${escapeHtml(student.fullName)}</span></td>
                <td>${ecoleBadge}</td>
                <td>${genreCell}</td>
                <td class="td-demande ce-demande">${demandeContent}</td>
                <td><div class="ce-chips">${chips}</div></td>
                <td><div class="ce-operator-cell">${operatorButtons}</div></td>
                <td>
                    <div class="ce-add">
                        <select id="ce-type-${idx}">
                            <option value="avec">avec</option>
                            <option value="pas_avec">pas avec</option>
                        </select>
                        <div class="ce-target-wrapper">
                            <input type="text" class="ce-target-search" id="ce-target-search-${idx}" placeholder="Rechercher un élève..." autocomplete="off">
                            <input type="hidden" id="ce-target-${idx}" value="">
                            <ul class="ce-target-dropdown hidden" id="ce-target-dropdown-${idx}"></ul>
                        </div>
                        <button type="button" class="ce-add-btn" data-source-idx="${idx}">+</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Binder la recherche pour chaque ligne
    filteredStudents.forEach((student) => {
        const idx = students.findIndex(s => s.fullName === student.fullName);
        const searchEl   = document.getElementById(`ce-target-search-${idx}`);
        const hiddenEl   = document.getElementById(`ce-target-${idx}`);
        const dropdownEl = document.getElementById(`ce-target-dropdown-${idx}`);
        if (!searchEl || !hiddenEl || !dropdownEl) return;

        const showDropdown = (query) => {
            const q = query.toLowerCase();
            const results = students
                .filter(s => s.fullName.toLowerCase() !== students[idx]?.fullName?.toLowerCase())
                .filter(s => s.fullName.toLowerCase().includes(q) || (s.ecole || '').toLowerCase().includes(q))
                .slice(0, 15);

            if (!results.length) { dropdownEl.classList.add('hidden'); return; }

            dropdownEl.innerHTML = results.map(s => {
                const label = s.ecole ? `${escapeHtml(s.fullName)} <em>(${escapeHtml(s.ecole)})</em>` : escapeHtml(s.fullName);
                return `<li class="ce-target-item" data-value="${escapeHtml(s.fullName)}">${label}</li>`;
            }).join('');
            dropdownEl.classList.remove('hidden');

            dropdownEl.querySelectorAll('.ce-target-item').forEach(li => {
                li.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    hiddenEl.value = li.dataset.value;
                    searchEl.value = li.dataset.value;
                    dropdownEl.classList.add('hidden');
                });
            });
        };

        searchEl.addEventListener('input', () => {
            hiddenEl.value = '';
            if (searchEl.value.trim()) showDropdown(searchEl.value.trim());
            else dropdownEl.classList.add('hidden');
        });
        searchEl.addEventListener('focus', () => {
            if (searchEl.value.trim()) showDropdown(searchEl.value.trim());
        });
        searchEl.addEventListener('blur', () => {
            setTimeout(() => dropdownEl.classList.add('hidden'), 150);
        });
    });

    body.querySelectorAll('.ce-add-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const sourceIdx = parseInt(btn.dataset.sourceIdx, 10);
            const type   = document.getElementById(`ce-type-${sourceIdx}`)?.value || 'avec';
            const target = document.getElementById(`ce-target-${sourceIdx}`)?.value || '';

            if (!target) return;
            addConstraintForStudent(sourceIdx, type, target);
            buildConstraintsEditor();
        });
    });

    body.querySelectorAll('.ce-gender-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const sourceIdx = parseInt(btn.dataset.sourceIdx, 10);
            const gender = btn.dataset.gender || '';
            const source = students[sourceIdx];
            if (!source) return;

            source.genre = source.genre === gender ? '' : gender;
            buildConstraintsEditor();
        });
    });

    body.querySelectorAll('.ce-operator-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const sourceIdx = parseInt(btn.dataset.sourceIdx, 10);
            const type = btn.dataset.type;
            const source = students[sourceIdx];
            if (!source) return;
            ensureStudentConstraints(source);
            const operatorKey = type === 'pas_avec' ? 'pas_avec_operator' : 'avec_operator';
            source.contraintes[operatorKey] = source.contraintes[operatorKey] === 'AND' ? 'OR' : 'AND';
            buildConstraintsEditor();
        });
    });

    body.querySelectorAll('.ce-chip-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            const sourceIdx = parseInt(btn.dataset.sourceIdx, 10);
            const type = btn.dataset.type;
            const target = decodeURIComponent(btn.dataset.target || '');
            removeConstraintForStudent(sourceIdx, type, target);
            buildConstraintsEditor();
        });
    });
}

function getAvailableStudents() {
    const assigned = new Set(Object.values(preAssignations).flat());
    return students.filter(s => !assigned.has(s.fullName));
}

// ─── Navigation wizard ────────────────────────────
function goToStep(next) {
    console.log('[goToStep] START next=', next, 'currentStep=', currentStep);
    try {
        const isForward = next > currentStep;
        const prevInd = document.getElementById(`step-indicator-${currentStep}`);
        console.log('[goToStep] prevInd found:', !!prevInd);
        
        prevInd.classList.remove('active');
        if (isForward) prevInd.classList.add('done');
        else           prevInd.classList.remove('done');
        
        const prevPanel = document.getElementById(`panel-${currentStep}`);
        console.log('[goToStep] prevPanel found:', !!prevPanel);
        prevPanel.classList.remove('active');

        currentStep = next;
        console.log('[goToStep] après assignation: currentStep=', currentStep);
        
        const newInd = document.getElementById(`step-indicator-${currentStep}`);
        console.log('[goToStep] newInd found:', !!newInd);
        newInd.classList.add('active');
        newInd.classList.remove('done');
        
        const newPanel = document.getElementById(`panel-${currentStep}`);
        console.log('[goToStep] newPanel found:', !!newPanel);
        newPanel.classList.add('active');

        document.getElementById('btn-prev').classList.toggle('hidden', currentStep === 1);
        
        // Affiche "Lancer le calcul ✓" uniquement à la dernière étape
        const btnText = currentStep === MAX_STEPS ? 'Lancer le calcul ✓' : 'Suivant →';
        document.getElementById('btn-next').textContent = btnText;
        console.log('[goToStep] btn-next.textContent =', btnText, '(currentStep=', currentStep, ')');

        // Construire le panel de pré-assignation si on arrive à l'étape 4
        if (currentStep === 4) {
            console.log('[goToStep] currentStep is 4, calling buildPreassignPanel');
            setTimeout(() => buildPreassignPanel(), 0);
        }
        if (currentStep === 5) {
            prepareGlobalConstraintsDefaults();
        }
        if (currentStep === 6) {
            buildConstraintsEditor();
        }
        console.log('[goToStep] END');
    } catch (err) {
        console.error('[goToStep] ERROR:', err, err.stack);
    }
}

// ─── Validation ──────────────────────────────────
function validateStep(step) {
    const error = document.getElementById(`error-${step}`);
    const error5 = document.getElementById('error-5');
    let valid = true;

    if (step === 1 && !document.querySelector('input[name="niveau"]:checked')) valid = false;
    if (step === 2 && !document.querySelector('input[name="nb_classes"]:checked')) valid = false;
    if (step === 3 && students.length === 0) valid = false;
    if (step === 5) {
        const gc = getGlobalConstraints();
        const nbClasses = getNbClasses();
        const details = [];

        if (gc.max_per_class !== null && (isNaN(gc.max_per_class) || gc.max_per_class < 1)) {
            valid = false;
            details.push('Le maximum par classe doit être >= 1.');
        }

        if (gc.max_per_class !== null && gc.max_per_class * nbClasses < students.length) {
            valid = false;
            details.push('Capacité insuffisante: max par classe x nb classes < nb élèves.');
        }

        if (gc.mixity_min !== null && (gc.mixity_min < 0 || gc.mixity_min > 100)) {
            valid = false;
            details.push('La mixité min doit être entre 0 et 100.');
        }

        if (gc.min_same_school !== null && (isNaN(gc.min_same_school) || gc.min_same_school < 1)) {
            valid = false;
            details.push('Le minimum d\'élèves d\'une même école doit être >= 1.');
        }

        if (error5) {
            const suffix = details.length ? ` ${details.join(' ')}` : '';
            error5.textContent = `Paramètres invalides.${suffix}`;
        }
    }
    if (step === 6) {
        normalizeStudentConstraintsReferences();
    }

    // Étape 4 toujours valide (optionnel)
    if (error) error.classList.toggle('hidden', valid);
    console.log('[validateStep] step=', step, 'valid=', valid, 'students.length=', students.length);
    return valid;
}

// ─── Boutons nav ─────────────────────────────────
document.getElementById('btn-next').addEventListener('click', function () {
    console.log('[btn-next.click] currentStep=', currentStep, 'MAX_STEPS=', MAX_STEPS);
    if (!validateStep(currentStep)) {
        console.log('[btn-next.click] validation failed');
        return;
    }
    if (currentStep < MAX_STEPS) {
        console.log('[btn-next.click] calling goToStep(', currentStep + 1, ')');
        try {
            goToStep(currentStep + 1);
            console.log('[btn-next.click] goToStep returned successfully');
        } catch (err) {
            console.error('[btn-next.click] ERROR in goToStep:', err, err.stack);
        }
    }
    else {
        console.log('[btn-next.click] calling lancerCalcul()');
        try {
            lancerCalcul();
        } catch (err) {
            console.error('[btn-next.click] ERROR in lancerCalcul:', err);
        }
    }
});
document.getElementById('btn-prev').addEventListener('click', function () {
    if (currentStep > 1) goToStep(currentStep - 1);
});

// ─── CSV : encodage + parsing ────────────────────
const csvZone      = document.getElementById('csv-zone');
const csvFileInput = document.getElementById('csv-file');
let isOpeningFileDialog = false;

csvZone.addEventListener('click', (e) => {
    if (e.target === csvFileInput || isOpeningFileDialog) return;
    isOpeningFileDialog = true;
    csvFileInput.click();
    setTimeout(() => { isOpeningFileDialog = false; }, 0);
});
csvFileInput.addEventListener('click', (e) => {
    e.stopPropagation();
});
csvZone.addEventListener('dragover', (e) => { e.preventDefault(); csvZone.classList.add('drag-over'); });
csvZone.addEventListener('dragleave', () => csvZone.classList.remove('drag-over'));
csvZone.addEventListener('drop', (e) => {
    e.preventDefault();
    csvZone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) parseUploadedFile(e.dataTransfer.files[0]);
});
csvFileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) parseUploadedFile(e.target.files[0]);
});

function parseUploadedFile(file) {
    csvZone.querySelector('p').innerHTML = `<strong>${file.name}</strong> chargé`;

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const isExcel = ext === 'xlsx' || ext === 'xls';

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const bytes = new Uint8Array(e.target.result);

            if (isExcel) {
                if (typeof XLSX === 'undefined') {
                    alert('Le lecteur Excel n\'est pas disponible. Merci de recharger la page.');
                    return;
                }
                const workbook = XLSX.read(bytes, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(firstSheet, {
                    header: 1,
                    raw: false,
                    defval: ''
                });
                processRows(rows, file.name);
                return;
            }

            let text;
            try {
                // Essai UTF-8 strict — échoue sur Windows-1252
                text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
            } catch {
                // Fallback vers windows-1252 (export Excel FR classique)
                text = new TextDecoder('windows-1252').decode(bytes);
            }
            processCSVText(text, file.name);
        } catch (err) {
            console.error('[IMPORT] erreur de lecture:', err);
            alert('Impossible de lire le fichier. Vérifiez le format (CSV, XLSX, XLS).');
        }
    };
    reader.readAsArrayBuffer(file);
}

function normalizeHeaderLabel(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '');
}

function normalizeCellValue(value) {
    return String(value == null ? '' : value).trim();
}

function getImportModalElements() {
    return {
        overlay: document.getElementById('import-mapping-modal'),
        title: document.getElementById('import-mapping-title'),
        intro: document.getElementById('import-mapping-intro'),
        headerRowSelect: document.getElementById('import-mapping-header-row'),
        selectPrenom: document.getElementById('import-col-prenom'),
        selectNom: document.getElementById('import-col-nom'),
        selectEcole: document.getElementById('import-col-ecole'),
        selectContrainte: document.getElementById('import-col-contrainte'),
        previewHead: document.getElementById('import-preview-head'),
        previewBody: document.getElementById('import-preview-body'),
        summary: document.getElementById('import-mapping-summary'),
        manualWrap: document.getElementById('import-mapping-manual'),
        editToggleBtn: document.getElementById('import-mapping-edit-toggle'),
        cancelBtn: document.getElementById('import-mapping-cancel'),
        confirmBtn: document.getElementById('import-mapping-confirm')
    };
}

function describeColumn(rows, columnIndex) {
    const values = rows
        .slice(0, 5)
        .map(row => normalizeCellValue(row[columnIndex] || ''))
        .filter(Boolean)
        .slice(0, 3);

    return values.length ? values.join(' | ') : 'colonne vide';
}

function getColumnStats(colValues) {
    const nonEmpty = colValues.filter(Boolean);
    const sampleSize = Math.max(nonEmpty.length, 1);
    const uniqueCount = new Set(nonEmpty.map(v => v.toLowerCase())).size;
    const averageLength = nonEmpty.length
        ? nonEmpty.reduce((sum, value) => sum + value.length, 0) / nonEmpty.length
        : 0;
    const blankRatio = colValues.length ? (colValues.length - nonEmpty.length) / colValues.length : 1;
    const uniqueRatio = nonEmpty.length ? uniqueCount / nonEmpty.length : 1;

    return { nonEmpty, sampleSize, uniqueCount, averageLength, blankRatio, uniqueRatio };
}

function hasHeaderLikeTokens(row) {
    if (!Array.isArray(row) || !row.length) return false;
    const normalizedCells = row.map(normalizeHeaderLabel).filter(Boolean);
    if (!normalizedCells.length) return false;

    const headerWords = /(prenom|nom|ecole|etablissement|school|demande|contrainte|commentaire|remarque|observations)/;
    const matchingCells = normalizedCells.filter(cell => headerWords.test(cell)).length;
    const shortCells = normalizedCells.filter(cell => cell.length <= 24).length;

    // Un en-tête est souvent composé de cellules courtes contenant des mots-clés métier.
    return matchingCells >= 2 && shortCells >= Math.ceil(normalizedCells.length * 0.6);
}

function getHeaderCandidateScore(row) {
    if (!Array.isArray(row) || !row.length) return -1;

    const normalizedCells = row.map(normalizeHeaderLabel).filter(Boolean);
    if (!normalizedCells.length) return -1;

    const headerWords = /(prenom|nom|ecole|etablissement|school|demande|contrainte|commentaire|remarque|observations|origine|privee|prive|publique|public)/;
    const matchingCells = normalizedCells.filter(cell => headerWords.test(cell)).length;
    const shortCells = normalizedCells.filter(cell => cell.length <= 24).length;
    const nonEmptyCount = normalizedCells.length;

    let score = matchingCells * 4 + shortCells;

    if (nonEmptyCount === 1) score -= 6;
    if (matchingCells >= 3) score += 6;
    if (normalizedCells.some(cell => cell.includes('demandeparticuliere'))) score += 4;
    if (normalizedCells.some(cell => cell.includes('ecoledorigine') || cell.includes('ecole'))) score += 3;

    return score;
}

function isLikelyDataRow(row) {
    if (!Array.isArray(row) || !row.length) return false;

    const cells = row.map(normalizeCellValue);
    const nonEmpty = cells.filter(Boolean);
    if (!nonEmpty.length) return false;

    const looksLikeName = (txt) => /^[A-Za-zÀ-ÖØ-öø-ÿ' -]{2,}$/.test(txt || '');
    const prenomLike = looksLikeName(cells[0] || '') || looksLikeName(cells[1] || '');
    const nomLike = looksLikeName(cells[1] || '') || looksLikeName(cells[0] || '');

    const hasConstraintSentence = cells.some(v =>
        /(pas\s+avec|avec\s+|separer|séparer|demande|contrainte)/i.test(v)
    );

    return prenomLike && nomLike && (nonEmpty.length >= 2 || hasConstraintSentence);
}

function getColumnRoleScores(cleanRows, headerRowIndex) {
    const header = headerRowIndex === 0 ? cleanRows[0] : [];
    const dataRows = cleanRows.slice(headerRowIndex === 0 ? 1 : 0, headerRowIndex === 0 ? 41 : 40);
    const maxCols = cleanRows.reduce((m, r) => Math.max(m, r.length), 0);

    const headerAliases = {
        prenom: ['prenom', 'firstname', 'givenname', 'forename'],
        nom: ['nom', 'lastname', 'surname', 'familyname', 'nomdefamille'],
        ecole: ['ecole', 'etablissement', 'school', 'origine', 'provenance'],
        contrainte: ['contrainte', 'contraintes', 'demande', 'demandeparticuliere', 'commentaire', 'remarque', 'observations']
    };

    const hasSchoolWord = value => /ecole|école|college|collège|lycee|lycée|school|saint|st[\s.-]/i.test(value);
    const hasConstraintWord = value => /pas\s+avec|avec\s+|separer|séparer|demande|contraint|remarque|commentaire|\//i.test(value);
    const looksLikeSingleName = value => /^[A-Za-zÀ-ÖØ-öø-ÿ' -]{2,24}$/.test(value) && value.trim().split(/\s+/).length <= 2;
    const looksLikeSchoolLabel = value => /^[A-Za-zÀ-ÖØ-öø-ÿ' -]{3,40}$/.test(value) && value.trim().split(/\s+/).length >= 1;

    const scores = {
        prenom: {},
        nom: {},
        ecole: {},
        contrainte: {}
    };

    for (let c = 0; c < maxCols; c++) {
        const h = normalizeHeaderLabel(header[c] || '');
        const rawValues = dataRows.map(r => normalizeCellValue(r[c] || ''));
        const { nonEmpty: colValues, sampleSize, averageLength, blankRatio, uniqueRatio } = getColumnStats(rawValues);

        const headerScore = aliases => aliases.some(alias => h.includes(alias)) ? 16 : 0;
        const prenomHits = colValues.filter(v => {
            const key = normalizeGenderKey(v);
            return NORMALIZED_GENDER_NAME_DICTIONARY.il.has(key) || NORMALIZED_GENDER_NAME_DICTIONARY.elle.has(key);
        }).length;
        const nameHits = colValues.filter(looksLikeSingleName).length;
        const upperHits = colValues.filter(v => {
            const compact = v.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\-\s]/g, '').trim();
            return compact && compact === compact.toUpperCase();
        }).length;
        const schoolHits = colValues.filter(hasSchoolWord).length;
        const constraintHits = colValues.filter(hasConstraintWord).length;
        const longTextHits = colValues.filter(v => v.length > 18 || /[,;]/.test(v)).length;
        const schoolLabelHits = colValues.filter(looksLikeSchoolLabel).length;
        const repeatedValuesBonus = uniqueRatio <= 0.65 ? 4 : uniqueRatio <= 0.8 ? 2 : 0;
        const optionalTextBonus = blankRatio >= 0.25 ? 2 : blankRatio >= 0.1 ? 1 : 0;

        scores.prenom[c] = headerScore(headerAliases.prenom)
            + (prenomHits / sampleSize) * 6
            + (nameHits / sampleSize) * 2
            - (longTextHits / sampleSize) * 2
            - (schoolHits / sampleSize) * 3
            - optionalTextBonus;

        scores.nom[c] = headerScore(headerAliases.nom)
            + (upperHits / sampleSize) * 6
            + (nameHits / sampleSize) * 2
            - (longTextHits / sampleSize) * 2
            - (schoolHits / sampleSize) * 2
            - optionalTextBonus;

        scores.ecole[c] = headerScore(headerAliases.ecole)
            + (schoolHits / sampleSize) * 6
            + repeatedValuesBonus
            + (schoolLabelHits / sampleSize) * 2.5
            + (averageLength >= 4 && averageLength <= 22 ? 2 : 0)
            - (constraintHits / sampleSize) * 3
            - (blankRatio > 0.55 ? 3 : 0)
            - (longTextHits / sampleSize) * 1.5;

        scores.contrainte[c] = headerScore(headerAliases.contrainte)
            + (constraintHits / sampleSize) * 7
            + (longTextHits / sampleSize) * 2
            + optionalTextBonus
            + (averageLength >= 12 ? 2 : 0)
            - (schoolHits / sampleSize) * 2
            - (uniqueRatio <= 0.45 ? 1.5 : 0);
    }

    return scores;
}

function scoreMapping(cleanRows, mapping, headerRowIndex, scores) {
    const dataRows = cleanRows.slice(headerRowIndex === 0 ? 1 : 0, headerRowIndex === 0 ? 26 : 25);
    let score = 0;

    score += (scores.prenom[mapping.prenom] || 0);
    score += (scores.nom[mapping.nom] || 0);
    score += (scores.ecole[mapping.ecole] || 0);
    score += (scores.contrainte[mapping.contrainte] || 0);

    dataRows.forEach(row => {
        const prenom = normalizeCellValue(row[mapping.prenom] || '');
        const nom = normalizeCellValue(row[mapping.nom] || '');
        const ecole = normalizeCellValue(row[mapping.ecole] || '');
        const contrainte = normalizeCellValue(row[mapping.contrainte] || '');

        if (prenom && nom) score += 1.8;
        if (prenom && /^[A-Za-zÀ-ÖØ-öø-ÿ' -]{2,24}$/.test(prenom)) score += 0.8;
        if (nom && /^[A-Za-zÀ-ÖØ-öø-ÿ' -]{2,32}$/.test(nom)) score += 0.8;
        if (nom && nom === nom.toUpperCase()) score += 0.5;
        if (ecole && !/(pas\s+avec|avec\s+|separer|séparer)/i.test(ecole)) score += 0.5;
        if (contrainte && /pas\s+avec|avec\s+|separer|séparer|contraint/i.test(contrainte)) score += 1.1;
        if (contrainte && contrainte.length > 12) score += 0.4;

        if (prenom && /(ecole|école|college|collège|lycee|lycée)/i.test(prenom)) score -= 2;
        if (nom && /(ecole|école|college|collège|lycee|lycée)/i.test(nom)) score -= 2;
        if (ecole && /pas\s+avec|avec\s+|separer|séparer/.test(ecole)) score -= 2.5;
        if (contrainte && contrainte === contrainte.toUpperCase() && contrainte.split(/\s+/).length <= 2) score -= 1;
    });

    return score;
}

function pickBestIndex(scoresByIndex, usedIndices = new Set(), minScore = 0.01) {
    let bestIndex = -1;
    let bestScore = minScore;

    Object.entries(scoresByIndex).forEach(([idxStr, score]) => {
        const idx = parseInt(idxStr, 10);
        if (usedIndices.has(idx)) return;
        if (score > bestScore) {
            bestScore = score;
            bestIndex = idx;
        }
    });

    return bestIndex;
}

function detectColumns(rows) {
    const cleanRows = rows
        .filter(r => Array.isArray(r))
        .map(r => r.map(normalizeCellValue))
        .filter(r => r.some(cell => cell !== ''));

    if (!cleanRows.length) {
        return {
            detected: { prenom: 1, nom: 0, ecole: 3, contrainte: 5 },
            headerRowIndex: 1,
            dataStartIndex: 2
        };
    }

    let headerRowIndex = -1;
    let bestHeaderScore = -1;

    cleanRows.slice(0, 4).forEach((row, idx) => {
        if (isLikelyDataRow(row)) return;
        const score = getHeaderCandidateScore(row);
        if (score > bestHeaderScore && score >= 8) {
            bestHeaderScore = score;
            headerRowIndex = idx;
        }
    });

    // Par défaut: en-têtes à ligne 2 (index 1), données à ligne 3 (index 2)
    if (headerRowIndex === -1) {
        headerRowIndex = 1;
    }

    const dataStartIndex = headerRowIndex + 1;
    const maxCols = cleanRows.reduce((m, r) => Math.max(m, r.length), 0);
    const scores = getColumnRoleScores(cleanRows, headerRowIndex);

    let bestScore = Number.NEGATIVE_INFINITY;
    let bestMapping = null;

    for (let prenom = 0; prenom < maxCols; prenom++) {
        for (let nom = 0; nom < maxCols; nom++) {
            if (nom === prenom) continue;
            for (let ecole = 0; ecole < maxCols; ecole++) {
                if (ecole === prenom || ecole === nom) continue;
                for (let contrainte = 0; contrainte < maxCols; contrainte++) {
                    if (contrainte === prenom || contrainte === nom || contrainte === ecole) continue;

                    const mapping = { prenom, nom, ecole, contrainte };
                    const score = scoreMapping(cleanRows, mapping, headerRowIndex, scores);
                    if (score > bestScore) {
                        bestScore = score;
                        bestMapping = mapping;
                    }
                }
            }
        }
    }

    if (!bestMapping) {
        bestMapping = { prenom: 1, nom: 0, ecole: 3, contrainte: 5 };
    }

    return {
        detected: bestMapping,
        headerRowIndex,
        dataStartIndex
    };
}

function populateImportPreview(rows, hasHeader) {
    const { previewHead, previewBody } = getImportModalElements();
    if (!previewHead || !previewBody) return;

    const cleanRows = rows
        .filter(r => Array.isArray(r))
        .map(r => r.map(normalizeCellValue))
        .filter(r => r.some(cell => cell !== ''));

    const maxCols = cleanRows.reduce((m, r) => Math.max(m, r.length), 0);
    const headerRowIndex = hasHeader;
    const startIndex = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
    const headRow = headerRowIndex >= 0 ? cleanRows[headerRowIndex] || [] : [];
    const previewRows = cleanRows.slice(startIndex);
    const mapping = getCurrentImportMapping();
    const columnRoleByIndex = new Map([
        [mapping.prenom, 'prenom'],
        [mapping.nom, 'nom'],
        [mapping.ecole, 'ecole'],
        [mapping.contrainte, 'contrainte']
    ]);

    previewHead.innerHTML = `<tr>${Array.from({ length: maxCols }, (_, idx) => {
        const title = hasHeader && headRow[idx] ? escapeHtml(headRow[idx]) : `Colonne ${idx + 1}`;
        const role = columnRoleByIndex.get(idx);
        const cls = role ? `import-col-${role}` : '';
        return `<th class="${cls}">${title}</th>`;
    }).join('')}</tr>`;

    previewBody.innerHTML = previewRows.map(row => `
        <tr>${Array.from({ length: maxCols }, (_, idx) => {
            const role = columnRoleByIndex.get(idx);
            const cls = role ? `import-col-${role}` : '';
            return `<td class="${cls}">${escapeHtml(row[idx] || '')}</td>`;
        }).join('')}</tr>
    `).join('');
}

function getCurrentImportMapping() {
    const els = getImportModalElements();
    return {
        prenom: parseInt(els.selectPrenom?.value || '-1', 10),
        nom: parseInt(els.selectNom?.value || '-1', 10),
        ecole: parseInt(els.selectEcole?.value || '-1', 10),
        contrainte: parseInt(els.selectContrainte?.value || '-1', 10)
    };
}

function updateImportMappingSummary(rows) {
    const els = getImportModalElements();
    if (!els.summary) return;

    const mapping = getCurrentImportMapping();
    const roles = [
        ['Prénom', mapping.prenom],
        ['Nom', mapping.nom],
        ['École', mapping.ecole],
        ['Contraintes', mapping.contrainte]
    ];

    els.summary.innerHTML = roles.map(([label, idx]) => {
        const desc = idx >= 0 ? describeColumn(rows, idx) : 'non sélectionnée';
        return `<div class="import-mapping-chip"><strong>${label}</strong><span>Colonne ${idx + 1} · ${escapeHtml(desc)}</span></div>`;
    }).join('');
}

function buildImportColumnOptions(rows) {
    const cleanRows = rows
        .filter(r => Array.isArray(r))
        .map(r => r.map(normalizeCellValue))
        .filter(r => r.some(cell => cell !== ''));
    const maxCols = cleanRows.reduce((m, r) => Math.max(m, r.length), 0);

    return Array.from({ length: maxCols }, (_, idx) => {
        const desc = describeColumn(cleanRows, idx);
        return `<option value="${idx}">Colonne ${idx + 1} · ${escapeHtml(desc)}</option>`;
    }).join('');
}

function closeImportMappingModal() {
    const { overlay } = getImportModalElements();
    if (overlay) overlay.classList.add('hidden');
}

function bindImportMappingModalEvents(isAdvancedMode) {
    let els = getImportModalElements();
    if (!els.overlay) return;
    
    // Unbind previous events to avoid duplicates
    if (els.overlay.dataset.bound === '1') {
        const cloneOverlay = els.overlay.cloneNode(true);
        els.overlay.parentNode.replaceChild(cloneOverlay, els.overlay);
        els = getImportModalElements(); // Reobtain elements after cloning
    }

    const refresh = () => {
        const headerRowIndex = parseInt(els.headerRowSelect?.value || '-1', 10);
        populateImportPreview(currentImportPreviewRows, Number.isNaN(headerRowIndex) ? -1 : headerRowIndex);
        updateImportMappingSummary(currentImportPreviewRows);
    };

    [els.selectPrenom, els.selectNom, els.selectEcole, els.selectContrainte].forEach(select => {
        select?.addEventListener('change', refresh);
    });
    els.headerRowSelect?.addEventListener('change', refresh);
    
    els.editToggleBtn?.addEventListener('click', () => {
        if (isAdvancedMode) {
            // Return to simple mode
            importModalIsAdvancedMode = false;
            displayImportModal(currentImportPreviewRows);
        } else {
            // Go to advanced mode
            importModalIsAdvancedMode = true;
            displayImportModal(currentImportPreviewRows);
        }
    });

    els.cancelBtn?.addEventListener('click', () => {
        closeImportMappingModal();
        if (pendingImportModalResolver) {
            pendingImportModalResolver(null);
            pendingImportModalResolver = null;
        }
    });

    els.confirmBtn?.addEventListener('click', () => {
        const mapping = {
            prenom: parseInt(els.selectPrenom?.value || '-1', 10),
            nom: parseInt(els.selectNom?.value || '-1', 10),
            ecole: parseInt(els.selectEcole?.value || '-1', 10),
            contrainte: parseInt(els.selectContrainte?.value || '-1', 10),
            headerRowIndex: parseInt(els.headerRowSelect?.value || '-1', 10)
        };

        console.log('[VALIDATION] Valeurs de sélection:', mapping);
        console.log('[VALIDATION] selectPrenom value:', els.selectPrenom?.value);
        console.log('[VALIDATION] selectNom value:', els.selectNom?.value);

        const values = [mapping.prenom, mapping.nom, mapping.ecole, mapping.contrainte];
        if (values.some(v => Number.isNaN(v) || v < 0)) {
            console.log('[VALIDATION] Erreur - au moins une valeur est NaN ou < 0:', values);
            alert('Merci de sélectionner les 4 colonnes.');
            return;
        }
        if (new Set(values).size !== values.length) {
            console.log('[VALIDATION] Erreur - colonnes dupliquées:', values);
            alert('Chaque rôle doit pointer vers une colonne différente.');
            return;
        }

        console.log('[VALIDATION] Succès - mapping validé');
        closeImportMappingModal();
        if (pendingImportModalResolver) {
            pendingImportModalResolver(mapping);
            pendingImportModalResolver = null;
        }
    });

    els.overlay.addEventListener('click', (event) => {
        if (event.target === els.overlay) {
            closeImportMappingModal();
            if (pendingImportModalResolver) {
                pendingImportModalResolver(null);
                pendingImportModalResolver = null;
            }
        }
    });

    els.overlay.dataset.bound = '1';
}

function askUserToConfirmColumns(fileName, detection, rows) {
    const cleanRows = rows
        .filter(r => Array.isArray(r))
        .map(r => r.map(normalizeCellValue))
        .filter(r => r.some(cell => cell !== ''));
    const els = getImportModalElements();

    if (!els.overlay) {
        return Promise.resolve({
            ...detection.detected,
            headerRowIndex: detection.headerRowIndex
        });
    }

    currentImportFileName = fileName;
    currentImportDetection = detection;
    currentImportPreviewRows = cleanRows;
    currentImportDetectedHeaderRowIndex = detection.headerRowIndex;
    importModalIsAdvancedMode = false;
    displayImportModal(cleanRows);

    return new Promise(resolve => {
        pendingImportModalResolver = resolve;
    });
}

function displayImportModal(rows) {
    const els = getImportModalElements();
    const detection = currentImportDetection;
    const fileName = currentImportFileName;
    const isAdvanced = importModalIsAdvancedMode;
    
    if (isAdvanced) {
        displayImportAdvancedModal(rows, detection, fileName);
    } else {
        displayImportSimpleModal(rows, detection, fileName);
    }
}

function displayImportSimpleModal(rows, detection, fileName) {
    const els = getImportModalElements();
    
    // Nettoyer les rangées
    const cleanRows = rows
        .filter(r => Array.isArray(r))
        .map(r => r.map(normalizeCellValue))
        .filter(r => r.some(cell => cell !== ''));
    
    // Masquer tous les éléments avancés
    if (els.headerRowSelect?.parentElement) els.headerRowSelect.parentElement.style.display = 'none';
    if (els.summary) els.summary.style.display = 'none';
    if (els.manualWrap) els.manualWrap.classList.add('hidden');
    if (els.title) els.title.textContent = 'Importer la liste des élèves';
    if (els.intro) els.intro.textContent = `${fileName} - Voici un aperçu des données.`;
    if (els.editToggleBtn) els.editToggleBtn.textContent = 'Configurer';
    
    // Construire les options des sélecteurs (nécessaire pour la validation)
    const optionsHtml = buildImportColumnOptions(cleanRows);
    els.selectPrenom.innerHTML = optionsHtml;
    els.selectNom.innerHTML = optionsHtml;
    els.selectEcole.innerHTML = optionsHtml;
    els.selectContrainte.innerHTML = optionsHtml;

    const headerRowOptions = ['<option value="1">Ligne 2 · en-têtes</option>']
        .concat(cleanRows.slice(0, 4).map((row, idx) => {
            const label = describeColumn(cleanRows, idx) || `Ligne ${idx + 1}`;
            return `<option value="${idx}">Ligne ${idx + 1} · ${escapeHtml(label)}</option>`;
        }))
        .join('');
    els.headerRowSelect.innerHTML = headerRowOptions;
    
    // Définir les valeurs des sélecteurs avec les colonnes détectées
    if (els.selectPrenom) els.selectPrenom.value = String(detection.detected.prenom);
    if (els.selectNom) els.selectNom.value = String(detection.detected.nom);
    if (els.selectEcole) els.selectEcole.value = '3';
    if (els.selectContrainte) els.selectContrainte.value = '5';
    if (els.headerRowSelect) els.headerRowSelect.value = String(detection.headerRowIndex >= 0 ? detection.headerRowIndex : 1);
    
    console.log('[SIMPLE MODAL] Valeurs définies:', {
        prenom: els.selectPrenom.value,
        nom: els.selectNom.value,
        ecole: els.selectEcole.value,
        contrainte: els.selectContrainte.value
    });
    
    // Afficher une preview simple avec les en-têtes et 4 données
    const previewHead = document.getElementById('import-preview-head');
    const previewBody = document.getElementById('import-preview-body');
    
    if (previewHead && previewBody) {
        const headerRowIndex = detection.headerRowIndex;
        const dataStartIndex = headerRowIndex + 1;
        
        const headerRow = cleanRows[headerRowIndex] || [];
        const previewRows = cleanRows.slice(dataStartIndex);
        const maxCols = cleanRows.reduce((m, r) => Math.max(m, (r || []).length), 0);
        
        // En-tête: afficher les noms de colonnes de la ligne 2
        previewHead.innerHTML = `<tr>${Array.from({ length: maxCols }, (_, idx) => {
            const title = headerRow?.[idx] ? escapeHtml(headerRow[idx]) : `Col ${idx + 1}`;
            return `<th>${title}</th>`;
        }).join('')}</tr>`;
        
        // Toutes les lignes de données (ligne 3+)
        previewBody.innerHTML = previewRows.map(row => `
            <tr>${Array.from({ length: maxCols }, (_, idx) => {
                return `<td>${escapeHtml(row?.[idx] || '')}</td>`;
            }).join('')}</tr>
        `).join('');
    }
    
    bindImportMappingModalEvents(false);
    els.overlay.classList.remove('hidden');
}

function displayImportAdvancedModal(rows, detection, fileName) {
    const els = getImportModalElements();
    
    // Afficher les éléments avancés
    if (els.headerRowSelect?.parentElement) els.headerRowSelect.parentElement.style.display = 'block';
    if (els.summary) els.summary.style.display = 'block';
    if (els.manualWrap) els.manualWrap.classList.remove('hidden');
    if (els.title) els.title.textContent = 'Configurations avancées';
    if (els.intro) els.intro.textContent = `Ajustez les colonnes détectées pour ${fileName}.`;
    if (els.editToggleBtn) els.editToggleBtn.textContent = 'Retour';
    
    const optionsHtml = buildImportColumnOptions(rows);
    const headerRowOptions = ['<option value="-1">Aucune ligne d\'intitulés</option>']
        .concat(rows.slice(0, 4).map((row, idx) => {
            const label = describeColumn(rows, idx) || `Ligne ${idx + 1}`;
            return `<option value="${idx}">Ligne ${idx + 1} · ${escapeHtml(label)}</option>`;
        }))
        .join('');
    
    els.headerRowSelect.innerHTML = headerRowOptions;
    els.selectPrenom.innerHTML = optionsHtml;
    els.selectNom.innerHTML = optionsHtml;
    els.selectEcole.innerHTML = optionsHtml;
    els.selectContrainte.innerHTML = optionsHtml;
    
    // Rétablir les valeurs détectées
    els.headerRowSelect.value = String(detection.headerRowIndex);
    els.selectPrenom.value = String(detection.detected.prenom);
    els.selectNom.value = String(detection.detected.nom);
    els.selectEcole.value = String(detection.detected.ecole);
    els.selectContrainte.value = String(detection.detected.contrainte);
    
    populateImportPreview(rows, detection.headerRowIndex);
    updateImportMappingSummary(rows);
    bindImportMappingModalEvents(true);
    els.overlay.classList.remove('hidden');
}

function parseNamesList(segment) {
    return segment
        .split(/,|;|\bet\b|\bou\b|\//gi)
    .map(n => normalizeNameToken(n))
        .filter(Boolean);
}

function parseDemandeParticuliere(raw) {
    const text = (raw || '').trim();
    if (!text) {
        return { avec: [], avec_operator: 'AND', pas_avec: [], pas_avec_operator: 'AND', incomprehensible: false };
    }

    let remaining = text;
    
    // Chercher "pas avec" ET "à séparer de"
    const pasAvec = [];
    
    // "pas avec"
    remaining = remaining.replace(/pas\s+avec\s+([^,;]+)/gi, (_, group) => {
        pasAvec.push(...parseNamesList(group));
        return '';
    });
    
    // "à séparer de" ou "a separer de"
    remaining = remaining.replace(/à\s+séparer\s+de\s+([^,;]+)|a\s+separer\s+de\s+([^,;]+)/gi, (_, group1, group2) => {
        const group = group1 || group2;
        pasAvec.push(...parseNamesList(group));
        return '';
    });

    // "avec"
    const avec = [];
    remaining = remaining.replace(/avec\s+([^,;]+)/gi, (_, group) => {
        avec.push(...parseNamesList(group));
        return '';
    });

    const unique = arr => [...new Set(arr.map(v => v.trim()).filter(Boolean))];
    
    // Déterminer si la contrainte est incompréhensible
    // = il y a du texte restant qui n'est pas des espaces ou ponctuation vide
    const incomprehensible = /[a-zA-Zàâäçèéêëîïôù]/i.test(remaining);
    
    return {
        avec: unique(avec),
        avec_operator: 'AND',
        pas_avec: unique(pasAvec),
        pas_avec_operator: 'AND',
        incomprehensible
    };
}

function processCSVText(text, fileName = 'CSV') {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

    const parseDelimitedLine = (line, separator) => {
        const cols = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i += 1;
                } else {
                    inQuotes = !inQuotes;
                }
                continue;
            }

            if (ch === separator && !inQuotes) {
                cols.push(current.trim());
                current = '';
                continue;
            }

            current += ch;
        }

        cols.push(current.trim());
        return cols;
    };

    const rows = lines.map(l => {
        const sep = l.includes(';') ? ';' : ',';
        return parseDelimitedLine(l, sep).map(c => c.replace(/^"|"$/g, '').trim());
    });
    return processRows(rows, fileName);
}

async function processRows(rows, fileName = 'fichier') {
    const detection = detectColumns(rows);
    const selectedColumns = await askUserToConfirmColumns(fileName, detection, rows);
    if (!selectedColumns) {
        return;
    }

    const cleanRows = rows
        .filter(r => Array.isArray(r))
        .map(r => r.map(normalizeCellValue))
        .filter(r => r.some(cell => cell !== ''));

    // Par défaut: ligne 2 pour les en-têtes, ligne 3 pour les données
    const headerRowIndex = selectedColumns.headerRowIndex >= 0 ? selectedColumns.headerRowIndex : 1;
    const dataStartIndex = headerRowIndex + 1;

    console.log('[IMPORT] Configuration:', {
        headerRowIndex: headerRowIndex,
        dataStartIndex: dataStartIndex,
        prenom: selectedColumns.prenom,
        nom: selectedColumns.nom,
        ecole: selectedColumns.ecole,
        contrainte: selectedColumns.contrainte,
        totalRows: cleanRows.length,
        dataRows: Math.max(0, cleanRows.length - dataStartIndex)
    });

    if (dataStartIndex < cleanRows.length) {
        console.log('[IMPORT] Première rangée de données:', cleanRows[dataStartIndex]);
    }

    students = cleanRows.slice(dataStartIndex).map((cols, idx) => {
        const prenom = cols[selectedColumns.prenom] || '';
        const nom = cols[selectedColumns.nom] || '';
        const ecole = normalizeSchoolName(cols[selectedColumns.ecole] || '');
        const demande_raw = cols[selectedColumns.contrainte] || '';

        if (idx < 2) {
            console.log(`[IMPORT] Élève ${idx + 1}:`, { prenom, nom, ecole, demande_raw });
        }

        if (!prenom && !nom) return null;

        const fullName = prenom && nom
            ? `${prenom} ${nom.toUpperCase()}`
            : (prenom || nom);

        const genderProfile = getGenderDetectionProfile(prenom);

        return {
            nom,
            prenom,
            fullName,
            ecole,
            genre: genderProfile.genre,
            genre_confidence: genderProfile.confidence,
            genre_source: genderProfile.source,
            genre_label: genderProfile.label,
            demande_raw,
            contraintes: parseDemandeParticuliere(demande_raw)
        };
    }).filter(Boolean);

    normalizeStudentConstraintsReferences();

    console.log('[IMPORT] élèves chargés:', students.length);
    console.log('[IMPORT] exemple contraintes:', students.slice(0, 5).map(s => ({
        eleve: s.fullName,
        genre: s.genre,
        genre_source: s.genre_source,
        demande: s.demande_raw,
        contraintes: s.contraintes
    })));

    showStudentsPreview();
}

function showStudentsPreview() {
    document.getElementById('students-count').textContent = `${students.length} élève(s) chargé(s)`;
    document.getElementById('students-preview').innerHTML = students.map(s => {
        const ecole = s.ecole ? ` - <em>${escapeHtml(s.ecole)}</em>` : '';
        const demande = s.demande_raw ? ` <small>(Demande: ${escapeHtml(s.demande_raw)})</small>` : '';
        return `<li><strong>${escapeHtml(s.fullName)}</strong>${ecole}${demande}</li>`;
    }).join('');
    document.getElementById('students-preview-container').classList.remove('hidden');
}

// ─── Étape 4 : pré-assignation ────────────────────
function buildPreassignPanel() {
    const keys = getClassKeys();
    console.log('[buildPreassignPanel] keys:', keys, 'students:', students.length);

    if (!keys || keys.length === 0) {
        console.error('[buildPreassignPanel] Aucune classe trouvée - niveau ou nb_classes manquant');
        return;
    }

    if (!students || students.length === 0) {
        console.warn('[buildPreassignPanel] Aucun élève chargé');
    }

    // Resynchro de l'état (changement nb_classes possible)
    const newState = {};
    keys.forEach(k => { newState[k] = preAssignations[k] || []; });
    preAssignations = newState;

    const grid = document.getElementById('preassign-grid');
    if (!grid) {
        console.error('[buildPreassignPanel] Élément preassign-grid non trouvé');
        return;
    }

    grid.innerHTML = '';

    keys.forEach((key, idx) => {
        const card = document.createElement('div');
        card.className = 'preassign-card';
        card.innerHTML = `
            <h3 class="preassign-card-title">${key}</h3>
            <ul class="preassign-list" id="preassign-list-${idx}"></ul>
            <div class="preassign-search-wrapper">
                <input type="text" class="preassign-search" id="preassign-search-${idx}"
                       placeholder="Rechercher un élève à ajouter…" autocomplete="off">
                <ul class="preassign-dropdown hidden" id="preassign-dropdown-${idx}"></ul>
            </div>
        `;
        grid.appendChild(card);
        console.log('[buildPreassignPanel] ajouté carte', idx, 'key=', key);
        setupSearch(idx, key);
        renderPreassignList(idx, key);
    });

    console.log('[buildPreassignPanel] grid.childrenCount:', grid.children.length);
    console.log('[buildPreassignPanel] grid computed style display:', window.getComputedStyle(grid).display);
    console.log('[buildPreassignPanel] ✓ Panel construit avec', keys.length, 'classe(s)');
}

function setupSearch(idx, classKey) {
    const input    = document.getElementById(`preassign-search-${idx}`);
    const dropdown = document.getElementById(`preassign-dropdown-${idx}`);

    input.addEventListener('input', () => {
        const query = input.value.toLowerCase().trim();
        if (!query) { dropdown.classList.add('hidden'); return; }

        const filtered = getAvailableStudents()
            .filter(s => getStudentSearchText(s).includes(query))
            .slice(0, 15);

        if (!filtered.length) { dropdown.classList.add('hidden'); return; }

        dropdown.innerHTML = filtered
            .map(s => `<li class="preassign-dropdown-item" data-student="${escapeHtml(s.fullName)}">${escapeHtml(getStudentLabel(s))}</li>`)
            .join('');
        dropdown.classList.remove('hidden');

        dropdown.querySelectorAll('.preassign-dropdown-item').forEach(li => {
            // mousedown pour éviter que le blur ferme avant le click
            li.addEventListener('mousedown', (e) => {
                e.preventDefault();
                addStudentToClass(li.dataset.student, classKey, idx);
                input.value = '';
                dropdown.classList.add('hidden');
            });
        });
    });

    input.addEventListener('blur', () => {
        setTimeout(() => dropdown.classList.add('hidden'), 150);
    });
}

function addStudentToClass(student, classKey, idx) {
    if (!preAssignations[classKey].includes(student)) {
        preAssignations[classKey].push(student);
        renderPreassignList(idx, classKey);
    }
}

function removeStudentFromClass(student, classKey, idx) {
    preAssignations[classKey] = preAssignations[classKey].filter(s => s !== student);
    renderPreassignList(idx, classKey);
}

function renderPreassignList(idx, classKey) {
    const list = document.getElementById(`preassign-list-${idx}`);
    const arr  = preAssignations[classKey] || [];

    if (arr.length === 0) {
        list.innerHTML = '<li class="preassign-empty">Aucun élève forcé dans cette classe</li>';
        return;
    }

    list.innerHTML = arr.map((s, i) => {
        const student = getStudentByFullName(s);
        const label = student ? getStudentLabel(student) : s;
        return `
        <li class="preassign-student">
            <span>${escapeHtml(label)}</span>
            <button class="preassign-remove" type="button" data-i="${i}" aria-label="Retirer ${escapeHtml(label)}">×</button>
        </li>
    `;
    }).join('');

    list.querySelectorAll('.preassign-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            // Relire arr au moment du clic (tableau peut avoir changé)
            const current = preAssignations[classKey] || [];
            const student = current[parseInt(btn.dataset.i)];
            if (student) removeStudentFromClass(student, classKey, idx);
        });
    });
}

// ─── Appel API ────────────────────────────────────
function lancerCalcul() {
    const elevesForApi = students.map(s => s.fullName);
    const contraintesForApi = {};
    students.forEach(s => {
        contraintesForApi[s.fullName] = {
            ecole: s.ecole,
            genre: s.genre || '',
            demande_raw: s.demande_raw,
            avec: s.contraintes?.avec || [],
            avec_operator: s.contraintes?.avec_operator || 'AND',
            pas_avec: s.contraintes?.pas_avec || [],
            pas_avec_operator: s.contraintes?.pas_avec_operator || 'AND'
        };
    });

    setLoadingModalVisible(true, 'Le moteur teste plusieurs configurations pour garder la meilleure.');

    fetch('/creation-classe/repartir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            niveau:           getNiveau(),
            nb_classes:       getNbClasses(),
            eleves:           elevesForApi,
            pre_assignations: preAssignations,
            contraintes:      contraintesForApi,
            global_constraints: getGlobalConstraints()
        })
    })
        .then(async r => {
            const payload = await r.json();
            if (!r.ok) {
                throw new Error(payload.error || 'Erreur lors de la répartition');
            }
            return payload;
        })
        .then(data => afficherResultats(data))
        .catch(err => alert(`Erreur lors du calcul: ${err.message}`))
        .finally(() => setLoadingModalVisible(false));
}

function cloneRepartition(repartition) {
    const cloned = {};
    Object.entries(repartition || {}).forEach(([classe, eleves]) => {
        cloned[classe] = [...(eleves || [])];
    });
    return cloned;
}

function normalizeSearchText(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function sortStudentNamesAlphabetically(names) {
    return [...(names || [])].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
}

function updateResultSearchCount(matchCount) {
    const countEl = document.getElementById('result-search-count');
    if (!countEl) return;
    if (!resultSearchQuery.trim()) {
        countEl.textContent = '';
        return;
    }
    countEl.textContent = `${matchCount} résultat(s)`;
}

function initResultSearchControls() {
    const input = document.getElementById('result-student-search');
    if (!input || input.dataset.bound === '1') return;

    input.addEventListener('input', () => {
        resultSearchQuery = input.value || '';
        buildResultGrid(currentRepartition, { autoFocusMatch: true });
    });
    input.dataset.bound = '1';
}

function computeMoveDelta(studentName, fromClass, toClass) {
    const simulated = cloneRepartition(currentRepartition);
    simulated[fromClass] = simulated[fromClass].filter(n => n !== studentName);
    simulated[toClass] = [...simulated[toClass], studentName];

    const mapBefore = buildStudentClassMap(currentRepartition);
    const mapAfter  = buildStudentClassMap(simulated);

    const before = computeSpecialConstraintsForStudents(students, mapBefore);
    const after  = computeSpecialConstraintsForStudents(students, mapAfter);

    const beforeFulfilled = new Set([...before.valid_details, ...before.partial_details]);
    const afterFulfilled  = new Set([...after.valid_details,  ...after.partial_details]);

    const gained = [...after.valid_details].filter(l => !before.valid_details.includes(l));
    const lost   = [...before.valid_details].filter(l => !after.valid_details.includes(l));
    const partialGained = after.partial_details.filter(l => !beforeFulfilled.has(l));
    const partialLost   = before.partial_details.filter(l => !afterFulfilled.has(l));

    return { gained, lost, partialGained, partialLost };
}

function showMoveConfirmModal(studentName, fromClass, toClass, onConfirm) {
    const delta = computeMoveDelta(studentName, fromClass, toClass);

    const modal   = document.getElementById('move-confirm-modal');
    const desc    = document.getElementById('move-modal-desc');
    const deltaEl = document.getElementById('move-modal-delta');

    desc.textContent = `${studentName} : ${fromClass} → ${toClass}`;

    const rows = [];

    if (delta.gained.length) {
        rows.push(`<div class="move-delta-section gain">
            <div class="move-delta-title">✓ Conditions gagnées (${delta.gained.length})</div>
            <ul>${delta.gained.map(l => `<li>${escapeHtml(l)}</li>`).join('')}</ul>
        </div>`);
    }
    if (delta.partialGained.length) {
        rows.push(`<div class="move-delta-section partial-gain">
            <div class="move-delta-title">~ Partielles gagnées (${delta.partialGained.length})</div>
            <ul>${delta.partialGained.map(l => `<li>${escapeHtml(l)}</li>`).join('')}</ul>
        </div>`);
    }
    if (delta.lost.length) {
        rows.push(`<div class="move-delta-section loss">
            <div class="move-delta-title">✗ Conditions perdues (${delta.lost.length})</div>
            <ul>${delta.lost.map(l => `<li>${escapeHtml(l)}</li>`).join('')}</ul>
        </div>`);
    }
    if (delta.partialLost.length) {
        rows.push(`<div class="move-delta-section partial-loss">
            <div class="move-delta-title">~ Partielles perdues (${delta.partialLost.length})</div>
            <ul>${delta.partialLost.map(l => `<li>${escapeHtml(l)}</li>`).join('')}</ul>
        </div>`);
    }
    if (!rows.length) {
        rows.push(`<div class="move-delta-neutral">Aucun changement de contraintes</div>`);
    }

    deltaEl.innerHTML = rows.join('');
    modal.classList.remove('hidden');

    const confirmBtn = document.getElementById('move-modal-confirm');
    const cancelBtn  = document.getElementById('move-modal-cancel');

    const cleanup = () => {
        modal.classList.add('hidden');
        confirmBtn.replaceWith(confirmBtn.cloneNode(true));
        cancelBtn.replaceWith(cancelBtn.cloneNode(true));
    };

    document.getElementById('move-modal-confirm').addEventListener('click', () => {
        cleanup();
        onConfirm();
    }, { once: true });

    document.getElementById('move-modal-cancel').addEventListener('click', () => {
        cleanup();
    }, { once: true });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) cleanup();
    }, { once: true });
}

function moveStudentBetweenClasses(studentName, fromClass, toClass) {
    if (!studentName || !fromClass || !toClass || fromClass === toClass) return;
    if (!currentRepartition[fromClass] || !currentRepartition[toClass]) return;

    showMoveConfirmModal(studentName, fromClass, toClass, () => {
        currentRepartition[fromClass] = currentRepartition[fromClass].filter(name => name !== studentName);
        if (!currentRepartition[toClass].includes(studentName)) {
            currentRepartition[toClass].push(studentName);
        }
        buildResultsIndicators(currentRepartition);
        buildResultGrid(currentRepartition);
    });
}

function bindResultDragAndDrop() {
    document.querySelectorAll('.result-student-card').forEach(card => {
        card.addEventListener('dragstart', (e) => {
            const student = card.dataset.student || '';
            const fromClass = card.dataset.classKey || '';
            dragPayload = { student, fromClass };

            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', JSON.stringify(dragPayload));
            card.classList.add('is-dragging');
        });

        card.addEventListener('dragend', () => {
            dragPayload = null;
            card.classList.remove('is-dragging');
            document.querySelectorAll('.result-class-list.is-drop-hover').forEach(list => list.classList.remove('is-drop-hover'));
        });
    });

    document.querySelectorAll('.result-class-list').forEach(list => {
        list.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            list.classList.add('is-drop-hover');
        });

        list.addEventListener('dragleave', () => {
            list.classList.remove('is-drop-hover');
        });

        list.addEventListener('drop', (e) => {
            e.preventDefault();
            list.classList.remove('is-drop-hover');

            const toClass = list.dataset.classKey || '';
            let payload = dragPayload;

            try {
                const raw = e.dataTransfer.getData('text/plain');
                if (raw) payload = JSON.parse(raw);
            } catch (_) {
                // Ignore parse errors and fallback to in-memory drag payload.
            }

            if (!payload) return;
            moveStudentBetweenClasses(payload.student, payload.fromClass, toClass);
        });
    });
}

function buildResultGrid(data, options = {}) {
    const { autoFocusMatch = false } = options;
    const grid = document.getElementById('result-grid');
    grid.innerHTML = '';
    const normalizedQuery = normalizeSearchText(resultSearchQuery);
    let matchCount = 0;

    Object.entries(data).forEach(([classe, eleves]) => {
        const sortedEleves = sortStudentNamesAlphabetically(eleves);
        const card = document.createElement('div');
        card.className = 'result-class-card';
        card.innerHTML = `
            <h3 class="result-class-name">${classe}</h3>
            <p class="result-class-count">${sortedEleves.length} élève(s)</p>
            <ul class="result-class-list" data-class-key="${escapeHtml(classe)}">
                ${sortedEleves.map(e => {
                    const isMatch = normalizedQuery && normalizeSearchText(e).includes(normalizedQuery);
                    if (isMatch) matchCount += 1;
                    return `<li class="result-student-card${isMatch ? ' result-student-match' : ''}" draggable="true" data-student="${escapeHtml(e)}" data-class-key="${escapeHtml(classe)}">${escapeHtml(e)}</li>`;
                }).join('')}
            </ul>
        `;
        grid.appendChild(card);
    });

    updateResultSearchCount(matchCount);

    if (autoFocusMatch && resultSearchQuery.trim()) {
        const firstMatch = grid.querySelector('.result-student-match');
        if (firstMatch) {
            firstMatch.classList.add('result-student-match-first');
            firstMatch.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    bindResultDragAndDrop();
}

function buildStudentClassMap(repartition) {
    const map = {};
    Object.entries(repartition || {}).forEach(([classe, eleves]) => {
        (eleves || []).forEach(eleve => {
            map[eleve] = classe;
        });
    });
    return map;
}

function computeMandatoryConstraintsStats(repartition) {
    let total = 0;
    let valid = 0;

    Object.entries(preAssignations || {}).forEach(([classe, forcedStudents]) => {
        (forcedStudents || []).forEach(studentName => {
            total += 1;
            if ((repartition[classe] || []).includes(studentName)) {
                valid += 1;
            }
        });
    });

    return {
        total,
        valid,
        invalid: total - valid,
        ratio: total ? Math.round((valid / total) * 100) : 100
    };
}

function computeGlobalIndicators(repartition) {
    const gc = getGlobalConstraints();
    const classes = Object.entries(repartition || {});

    if (!classes.length) {
        return {
            classSizes: { min: 0, max: 0, gap: 0 },
            mixity: { average: 0, respected: 0, total: 0, threshold: gc.mixity_min },
            schoolCluster: { min: 0, max: 0, respected: 0, total: 0, threshold: gc.min_same_school }
        };
    }

    const sizeValues = classes.map(([, eleves]) => eleves.length);
    const classMin = Math.min(...sizeValues);
    const classMax = Math.max(...sizeValues);

    let mixitySum = 0;
    let mixityRespected = 0;

    let schoolClusterMin = Number.POSITIVE_INFINITY;
    let schoolClusterMax = 0;
    let schoolClusterRespected = 0;

    classes.forEach(([, eleves]) => {
        let ilCount = 0;
        let elleCount = 0;
        const schoolCounts = {};

        eleves.forEach(fullName => {
            const student = getStudentByFullName(fullName);
            if (student?.genre === 'il') ilCount += 1;
            if (student?.genre === 'elle') elleCount += 1;

            const school = (student?.ecole || '').trim();
            if (school) {
                schoolCounts[school] = (schoolCounts[school] || 0) + 1;
            }
        });

        const knownGenderCount = ilCount + elleCount;
        const size = knownGenderCount || 1;
        const minority = Math.min(ilCount, elleCount);
        const mixityRate = Math.round((minority / size) * 100);
        mixitySum += mixityRate;

        if (gc.mixity_min !== null && mixityRate >= gc.mixity_min) {
            mixityRespected += 1;
        }

        const maxSameSchool = Object.values(schoolCounts).length
            ? Math.max(...Object.values(schoolCounts))
            : 0;

        schoolClusterMin = Math.min(schoolClusterMin, maxSameSchool);
        schoolClusterMax = Math.max(schoolClusterMax, maxSameSchool);

        if (gc.min_same_school !== null && maxSameSchool >= gc.min_same_school) {
            schoolClusterRespected += 1;
        }
    });

    if (schoolClusterMin === Number.POSITIVE_INFINITY) schoolClusterMin = 0;

    return {
        classSizes: {
            min: classMin,
            max: classMax,
            gap: classMax - classMin
        },
        mixity: {
            average: Math.round(mixitySum / classes.length),
            respected: gc.mixity_min !== null ? mixityRespected : classes.length,
            total: classes.length,
            threshold: gc.mixity_min
        },
        schoolCluster: {
            min: schoolClusterMin,
            max: schoolClusterMax,
            respected: gc.min_same_school !== null ? schoolClusterRespected : classes.length,
            total: classes.length,
            threshold: gc.min_same_school
        }
    };
}

function evaluateSingleConstraint(sourceClass, targetClasses, type, operator) {
    if (!targetClasses.length) return true;

    if (type === 'avec') {
        if (operator === 'OR') {
            return targetClasses.some(c => c === sourceClass);
        }
        return targetClasses.every(c => c === sourceClass);
    }

    if (operator === 'OR') {
        return targetClasses.some(c => c !== sourceClass);
    }
    return targetClasses.every(c => c !== sourceClass);
}

function computeSpecialConstraintsForStudents(studentsSubset, studentClassMap) {
    let total = 0;
    let valid = 0;
    let partial = 0;
    const validDetails = [];
    const partialDetails = [];
    const invalidDetails = [];

    studentsSubset.forEach(student => {
        ensureStudentConstraints(student);
        const sourceClass = studentClassMap[student.fullName];
        if (!sourceClass) return;

        const avec = (student.contraintes?.avec || []).filter(Boolean);
        if (avec.length) {
            const targets = avec.map(name => studentClassMap[name]).filter(Boolean);
            if (targets.length) {
                total += 1;
                const avecOp = student.contraintes?.avec_operator || 'AND';
                const avecConnector = avecOp === 'OR' ? ' ou ' : ' et ';
                const avecParts = avec.map(n => `avec ${n}`).join(avecConnector);
                const label = `${student.fullName} | ${avecParts}`;
                const op = avecOp;
                const matches = targets.filter(c => c === sourceClass).length;

                if (op === 'OR') {
                    if (matches >= 1) {
                        valid += 1;
                        validDetails.push(label);
                    } else {
                        invalidDetails.push(label);
                    }
                } else {
                    if (matches === targets.length) {
                        valid += 1;
                        validDetails.push(label);
                    } else if (matches > 0) {
                        partial += 1;
                        partialDetails.push(label);
                    } else {
                        invalidDetails.push(label);
                    }
                }
            }
        }

        const pasAvec = (student.contraintes?.pas_avec || []).filter(Boolean);
        if (pasAvec.length) {
            const targets = pasAvec.map(name => studentClassMap[name]).filter(Boolean);
            if (targets.length) {
                total += 1;
                const pasAvecOp = student.contraintes?.pas_avec_operator || 'AND';
                const pasAvecConnector = pasAvecOp === 'OR' ? ' ou ' : ' et ';
                const pasAvecParts = pasAvec.map(n => `pas avec ${n}`).join(pasAvecConnector);
                const label = `${student.fullName} | ${pasAvecParts}`;
                const op = pasAvecOp;
                const separated = targets.filter(c => c !== sourceClass).length;

                if (op === 'OR') {
                    if (separated >= 1) {
                        valid += 1;
                        validDetails.push(label);
                    } else {
                        invalidDetails.push(label);
                    }
                } else {
                    if (separated === targets.length) {
                        valid += 1;
                        validDetails.push(label);
                    } else if (separated > 0) {
                        partial += 1;
                        partialDetails.push(label);
                    } else {
                        invalidDetails.push(label);
                    }
                }
            }
        }
    });

    const score = valid + (partial * 0.5);

    return {
        total,
        valid,
        partial,
        invalid: total - valid,
        ratio: total ? Math.round((score / total) * 100) : 100,
        valid_details: validDetails,
        partial_details: partialDetails,
        invalid_details: invalidDetails
    };
}

function computeSpecialConstraintsStats(repartition) {
    const studentClassMap = buildStudentClassMap(repartition);
    return computeSpecialConstraintsForStudents(students, studentClassMap);
}

function statusClassByRatio(ratio) {
    if (ratio >= 90) return 'good';
    if (ratio >= 70) return 'warn';
    return 'bad';
}

function statusAgainstThreshold(value, threshold) {
    if (threshold === null || threshold === undefined) return statusClassByRatio(value);
    if (value >= threshold) return 'good';
    if (value >= Math.max(0, threshold - 10)) return 'warn';
    return 'bad';
}

function renderListPreview(items) {
    const safe = (items || []).filter(Boolean);

    if (!safe.length) {
        return '<li class="popover-empty">Aucune</li>';
    }

    return safe.map(item => `<li>${escapeHtml(item)}</li>`).join('');
}

function renderConditionsPopover(title, validItems, partialItems, invalidItems) {
    return `
        <div class="class-indicator-popover" role="tooltip">
            <div class="popover-title">${escapeHtml(title)}</div>
            <div class="popover-section">
                <div class="popover-section-title ok">Remplies (${(validItems || []).length})</div>
                <ul class="popover-list">${renderListPreview(validItems)}</ul>
            </div>
            ${(partialItems || []).length ? `
            <div class="popover-section">
                <div class="popover-section-title mid">Partiellement remplies (${(partialItems || []).length})</div>
                <ul class="popover-list">${renderListPreview(partialItems)}</ul>
            </div>
            ` : ''}
            <div class="popover-section">
                <div class="popover-section-title ko">Non remplies (${(invalidItems || []).length})</div>
                <ul class="popover-list">${renderListPreview(invalidItems)}</ul>
            </div>
        </div>
    `;
}

function renderMixityPopover(ilCount, elleCount, rate) {
    return `
        <div class="class-indicator-popover" role="tooltip">
            <div class="popover-title">Détail mixité</div>
            <div class="popover-inline-grid">
                <div class="popover-kpi"><span>Garçons</span><strong>${ilCount}</strong></div>
                <div class="popover-kpi"><span>Filles</span><strong>${elleCount}</strong></div>
                <div class="popover-kpi full"><span>Taux</span><strong>${rate}%</strong></div>
            </div>
        </div>
    `;
}

function renderSchoolPopover(schoolBreakdown) {
    const schoolLines = (schoolBreakdown || []).map(item => {
        const names = (item.students || []).join(', ');
        const namesPart = names ? `<div class="popover-school-students">${escapeHtml(names)}</div>` : '';
        const soloTag = item.global_single
            ? '<span class="popover-tag tag-warn">élève seul de cette école</span>'
            : '';

        return `
            <li>
                <div class="popover-school-row">
                    <span><strong>${escapeHtml(item.school)}</strong> : ${item.count}</span>
                    <span class="popover-tags">${soloTag}</span>
                </div>
                ${namesPart}
            </li>
        `;
    }).join('');

    return `
        <div class="class-indicator-popover" role="tooltip">
            <button type="button" class="popover-close" aria-label="Fermer">×</button>
            <div class="popover-title">Répartition par école</div>
            <ul class="popover-list popover-school-list">${schoolLines || '<li class="popover-empty">Aucune école renseignée</li>'}</ul>
        </div>
    `;
}

function computePerClassIndicators(repartition) {
    const gc = getGlobalConstraints();
    const nbClasses = Math.max(getNbClasses(), 1);
    const targetSize = students.length / nbClasses;
    const studentClassMap = buildStudentClassMap(repartition);
    const globalSchoolCounts = {};

    students.forEach(s => {
        const school = (s.ecole || '').trim();
        if (school) {
            globalSchoolCounts[school] = (globalSchoolCounts[school] || 0) + 1;
        }
    });

    return Object.entries(repartition || {}).map(([classe, eleves]) => {
        const members = (eleves || []).map(name => getStudentByFullName(name)).filter(Boolean);

        const forced = preAssignations[classe] || [];
        const mandatoryValid = forced.filter(name => (repartition[classe] || []).includes(name)).length;
        const mandatoryValidDetails = forced.filter(name => (repartition[classe] || []).includes(name));
        const mandatoryInvalidDetails = forced.filter(name => !(repartition[classe] || []).includes(name));
        const mandatoryRatio = forced.length ? Math.round((mandatoryValid / forced.length) * 100) : 100;

        let ilCount = 0;
        let elleCount = 0;
        const schoolCounts = {};
        const membersBySchool = {};

        members.forEach(student => {
            if (student.genre === 'il') ilCount += 1;
            if (student.genre === 'elle') elleCount += 1;
            const school = (student.ecole || '').trim();
            if (school) {
                schoolCounts[school] = (schoolCounts[school] || 0) + 1;
                if (!membersBySchool[school]) membersBySchool[school] = [];
                membersBySchool[school].push(student.fullName);
            }
        });

        const knownGenderCount = ilCount + elleCount;
        const mixityRate = knownGenderCount ? Math.round((Math.min(ilCount, elleCount) / knownGenderCount) * 100) : 0;
        const mixityStatus = gc.mixity_min !== null
            ? statusAgainstThreshold(mixityRate, gc.mixity_min)
            : (mixityRate >= 40 ? 'good' : (mixityRate >= 25 ? 'warn' : 'bad'));

        const size = eleves.length;
        const sizeDiff = Math.abs(size - targetSize);
        const sizeStatus = sizeDiff <= 1 ? 'good' : (sizeDiff <= 2 ? 'warn' : 'bad');

        const schoolValues = Object.values(schoolCounts);
        const maxSameSchool = schoolValues.length
            ? Math.max(...Object.values(schoolCounts))
            : 0;
        const eligibleSchoolValues = Object.entries(schoolCounts)
            .filter(([school]) => (globalSchoolCounts[school] || 0) > 1)
            .map(([, count]) => count);
        const minSameSchool = eligibleSchoolValues.length
            ? Math.min(...eligibleSchoolValues)
            : null;

        let schoolStatus = 'good';
        if (minSameSchool !== null) {
            schoolStatus = gc.min_same_school !== null
                ? (minSameSchool >= gc.min_same_school ? 'good' : (minSameSchool >= Math.max(1, gc.min_same_school - 1) ? 'warn' : 'bad'))
                : (minSameSchool >= 2 ? 'good' : (minSameSchool === 1 ? 'warn' : 'bad'));
        }

        const schoolBreakdown = Object.entries(schoolCounts)
            .map(([school, count]) => ({
                school,
                count,
                students: membersBySchool[school] || [],
                global_single: (globalSchoolCounts[school] || 0) === 1
            }))
            .sort((a, b) => a.count - b.count || a.school.localeCompare(b.school, 'fr'));

        const special = computeSpecialConstraintsForStudents(members, studentClassMap);

        return {
            classe,
            mandatory: {
                total: forced.length,
                valid: mandatoryValid,
                ratio: mandatoryRatio,
                status: statusClassByRatio(mandatoryRatio),
                valid_details: mandatoryValidDetails,
                partial_details: [],
                invalid_details: mandatoryInvalidDetails
            },
            mixity: {
                value: mixityRate,
                status: mixityStatus,
                il_count: ilCount,
                elle_count: elleCount
            },
            size: {
                value: size,
                target: Math.round(targetSize * 10) / 10,
                status: sizeStatus
            },
            school: {
                value: minSameSchool,
                value_display: minSameSchool === null ? 'n/a' : `min ${minSameSchool}`,
                status: schoolStatus,
                max_value: maxSameSchool,
                breakdown: schoolBreakdown
            },
            special: {
                total: special.total,
                valid: special.valid,
                partial: special.partial,
                invalid: special.invalid,
                ratio: special.ratio,
                status: statusClassByRatio(special.ratio),
                valid_details: special.valid_details,
                partial_details: special.partial_details,
                invalid_details: special.invalid_details
            }
        };
    });
}

function buildResultsIndicators(repartition) {
    const container = document.getElementById('result-indicators');
    if (!container) return;
    const perClassIndicators = computePerClassIndicators(repartition);

    const perClassHtml = perClassIndicators.map(ind => `
        <div class="class-indicator-card">
            <div class="class-indicator-title">${escapeHtml(ind.classe)}</div>
            <div class="class-indicator-metrics-grid">
                <div class="class-indicator-item has-popover status-${ind.mandatory.status}">
                    <button type="button" class="class-indicator-help" aria-label="Détail obligations">i</button>
                    <span class="class-indicator-label">Obligatoires</span>
                    <span class="class-indicator-value">${ind.mandatory.valid}/${ind.mandatory.total}</span>
                    ${renderConditionsPopover('Pré-assignations (étape 4)', ind.mandatory.valid_details, ind.mandatory.partial_details, ind.mandatory.invalid_details)}
                </div>
                <div class="class-indicator-item has-popover status-${ind.mixity.status}">
                    <button type="button" class="class-indicator-help" aria-label="Détail mixité">i</button>
                    <span class="class-indicator-label">Mixité</span>
                    <span class="class-indicator-value">${ind.mixity.value}%</span>
                    ${renderMixityPopover(ind.mixity.il_count, ind.mixity.elle_count, ind.mixity.value)}
                </div>
                <div class="class-indicator-item status-${ind.size.status}">
                    <span class="class-indicator-label">Effectif</span>
                    <span class="class-indicator-value">${ind.size.value} <small>cible ~${ind.size.target}</small></span>
                </div>
                <div class="class-indicator-item has-popover status-${ind.school.status}">
                    <button type="button" class="class-indicator-help" aria-label="Détail écoles">i</button>
                    <span class="class-indicator-label">Même école min</span>
                    <span class="class-indicator-value">${ind.school.value_display}</span>
                    ${renderSchoolPopover(ind.school.breakdown)}
                </div>
                <div class="class-indicator-item has-popover status-${ind.special.status}">
                    <button type="button" class="class-indicator-help" aria-label="Détail contraintes spéciales">i</button>
                    <span class="class-indicator-label">Spéciales</span>
                    <span class="class-indicator-value">${ind.special.valid}/${ind.special.total}</span>
                    ${renderConditionsPopover('Contraintes spéciales', ind.special.valid_details, ind.special.partial_details, ind.special.invalid_details)}
                </div>
            </div>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="indicator-level level-classes-only">
            <div class="indicator-level-title">Détail par classe</div>
            <div class="class-indicator-grid">
                ${perClassHtml}
            </div>
        </div>
    `;

    initIndicatorPopovers(container);
}

function initIndicatorPopovers(container) {
    if (container.dataset.popoverBound === '1') {
        return;
    }
    container.dataset.popoverBound = '1';

    const closeAll = () => {
        container.querySelectorAll('.class-indicator-item.has-popover.is-open').forEach(item => {
            item.classList.remove('is-open');
        });
        container.querySelectorAll('.class-indicator-card.popover-active').forEach(card => {
            card.classList.remove('popover-active');
        });
    };

    container.addEventListener('click', (e) => {
        const trigger = e.target.closest('.class-indicator-help');
        const closeBtn = e.target.closest('.popover-close');
        const item = e.target.closest('.class-indicator-item.has-popover');

        if (trigger && item) {
            e.preventDefault();
            e.stopPropagation();
            const willOpen = !item.classList.contains('is-open');
            closeAll();
            if (willOpen) {
                item.classList.add('is-open');
                const parentCard = item.closest('.class-indicator-card');
                if (parentCard) parentCard.classList.add('popover-active');

                // Flip to right-aligned if popover overflows viewport.
                const popover = item.querySelector('.class-indicator-popover');
                if (popover) {
                    popover.classList.remove('popover-align-right');
                    const rect = popover.getBoundingClientRect();
                    if (rect.right > window.innerWidth - 12) {
                        popover.classList.add('popover-align-right');
                    }
                }
            }
            return;
        }

        if (closeBtn && item) {
            e.preventDefault();
            e.stopPropagation();
            item.classList.remove('is-open');
            return;
        }

        if (!e.target.closest('.class-indicator-item.has-popover')) {
            closeAll();
        }
    });

    if (!window.__classIndicatorPopoverGlobalBound) {
        document.addEventListener('click', (e) => {
            document.querySelectorAll('.class-indicator-item.has-popover.is-open').forEach(item => {
                if (!item.contains(e.target)) {
                    item.classList.remove('is-open');
                }
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.class-indicator-item.has-popover.is-open').forEach(item => {
                    item.classList.remove('is-open');
                });
            }
        });

        window.__classIndicatorPopoverGlobalBound = true;
    }
}

function afficherResultats(data) {
    for (let i = 1; i <= MAX_STEPS; i++) {
        document.getElementById(`panel-${i}`).classList.remove('active');
    }
    document.getElementById('wizard-steps').classList.add('hidden');
    document.getElementById('wizard-nav').classList.add('hidden');

    document.getElementById('res-count').textContent   = students.length;
    document.getElementById('res-nb').textContent      = getNbClasses();
    document.getElementById('res-niveau').textContent  = getNiveau();

    initResultSearchControls();
    currentRepartition = cloneRepartition(data);

    buildResultsIndicators(currentRepartition);
    buildResultGrid(currentRepartition);
    document.getElementById('results-section').classList.remove('hidden');
}

// ─── Boutons résultats ────────────────────────────
document.getElementById('btn-recommencer').addEventListener('click', () => location.reload());

document.getElementById('btn-export-excel').addEventListener('click', async function () {
    if (!currentRepartition || Object.keys(currentRepartition).length === 0) {
        alert('Aucune répartition à exporter.');
        return;
    }

    const exportBtn = this;
    const initialText = exportBtn.textContent;
    exportBtn.disabled = true;
    exportBtn.textContent = 'Export en cours...';

    try {
        const contraintesForApi = {};
        students.forEach(s => {
            contraintesForApi[s.fullName] = {
                ecole: s.ecole,
                genre: s.genre || '',
                demande_raw: s.demande_raw || ''
            };
        });

        const response = await fetch('/creation-classe/export-excel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                niveau: getNiveau(),
                repartition: currentRepartition,
                contraintes: contraintesForApi
            })
        });

        if (!response.ok) {
            let errorMessage = 'Erreur lors de l\'export Excel';
            try {
                const payload = await response.json();
                errorMessage = payload.error || errorMessage;
            } catch (_) {
                // Réponse non-JSON, conserver le message générique.
            }
            throw new Error(errorMessage);
        }

        const blob = await response.blob();
        const contentDisposition = response.headers.get('content-disposition') || '';
        const filenameMatch = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
        const filename = filenameMatch ? filenameMatch[1] : 'repartition.xlsx';

        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(url);
    } catch (err) {
        alert(`Erreur: ${err.message}`);
    } finally {
        exportBtn.disabled = false;
        exportBtn.textContent = initialText;
    }
});

document.getElementById('btn-relancer').addEventListener('click', function () {
    const elevesForApi = students.map(s => s.fullName);
    const contraintesForApi = {};
    students.forEach(s => {
        contraintesForApi[s.fullName] = {
            ecole: s.ecole,
            genre: s.genre || '',
            demande_raw: s.demande_raw,
            avec: s.contraintes?.avec || [],
            avec_operator: s.contraintes?.avec_operator || 'AND',
            pas_avec: s.contraintes?.pas_avec || [],
            pas_avec_operator: s.contraintes?.pas_avec_operator || 'AND'
        };
    });

    setLoadingModalVisible(true, 'Nouvelle optimisation en cours...');

    fetch('/creation-classe/repartir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            niveau:           getNiveau(),
            nb_classes:       getNbClasses(),
            eleves:           elevesForApi,
            pre_assignations: preAssignations,
            contraintes:      contraintesForApi,
            global_constraints: getGlobalConstraints()
        })
    })
        .then(async r => {
            const payload = await r.json();
            if (!r.ok) {
                throw new Error(payload.error || 'Erreur lors de la répartition');
            }
            return payload;
        })
        .then(data => {
            currentRepartition = cloneRepartition(data);
            buildResultsIndicators(currentRepartition);
            buildResultGrid(currentRepartition);
        })
        .catch(err => alert(`Erreur: ${err.message}`))
        .finally(() => setLoadingModalVisible(false));
});

// ───────────────────────────────────────────────
// Navigation entre étapes
// ───────────────────────────────────────────────

// ───────────────────────────────────────────────
// Validation par étape
// ───────────────────────────────────────────────
