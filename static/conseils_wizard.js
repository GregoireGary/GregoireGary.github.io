let conseilsStep = 1;
const CONSEILS_MAX_STEPS = 6;
const conseilsState = {
    niveaux: [],
    classesParNiveau: {},
    dateStart: '',
    dateEnd: '',
    selectedDates: [],
    slotCount: null,
    useSpecificSlots: false,
    specificSlotsByDate: {},
    importedProfs: [],
    importFileName: '',
    manualProfs: [],
    sourceMode: 'import',
    profConstraintsById: {},
    selectedProfConstraintId: '',
    profUidCounter: 1,
    resultsMap: {},
    resultsWarning: ''
};

const WEEKDAY_ORDER = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const WORKDAY_ORDER = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];

function getSelectedNiveaux() {
    const checked = document.querySelectorAll('input[name="conseils_niveaux"]:checked');
    return Array.from(checked).map(el => el.value);
}

function normalizeClassesParNiveau() {
    const kept = {};
    conseilsState.niveaux.forEach(niveau => {
        if (conseilsState.classesParNiveau[niveau]) {
            kept[niveau] = conseilsState.classesParNiveau[niveau];
        }
    });
    conseilsState.classesParNiveau = kept;
}

function getSelectedClassLabels() {
    const labels = [];
    conseilsState.niveaux.forEach(niveau => {
        const count = conseilsState.classesParNiveau[niveau] || 0;
        for (let index = 1; index <= count; index++) {
            labels.push(`${niveau}${index}`);
        }
    });
    return labels;
}

function normalizeHeader(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/\s+/g, '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function normalizeCellValue(value) {
    return String(value == null ? '' : value).trim();
}

function getSelectedSlotCount() {
    const el = document.querySelector('input[name="conseils_slot_count"]:checked');
    return el ? parseInt(el.value, 10) : 0;
}

function parseIsoDate(isoDate) {
    if (!isoDate) return null;
    const [y, m, d] = isoDate.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
}

function formatDateFr(isoDate) {
    const date = parseIsoDate(isoDate);
    if (!date) return isoDate;
    const formatted = new Intl.DateTimeFormat('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    }).format(date);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatDateShortFr(isoDate) {
    const date = parseIsoDate(isoDate);
    if (!date) return isoDate;
    return new Intl.DateTimeFormat('fr-FR', {
        day: 'numeric',
        month: 'short'
    }).format(date);
}

function getIsoWeekData(isoDate) {
    const date = parseIsoDate(isoDate);
    if (!date) return null;

    const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = utcDate.getUTCDay() || 7;
    utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);

    const year = utcDate.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const week = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);

    return {
        year,
        week,
        key: `${year}-W${String(week).padStart(2, '0')}`
    };
}

function formatWeekRangeLabel(dateList) {
    if (!Array.isArray(dateList) || !dateList.length) {
        return 'Semaine';
    }

    const sortedDates = dateList
        .filter(dateIso => parseIsoDate(dateIso))
        .sort((a, b) => parseIsoDate(a) - parseIsoDate(b));

    if (!sortedDates.length) {
        return 'Semaine';
    }

    const start = sortedDates[0];
    const end = sortedDates[sortedDates.length - 1];
    const weekInfo = getIsoWeekData(start);
    const weekText = weekInfo ? `S${weekInfo.week}` : 'Semaine';

    if (start === end) {
        return `${weekText} - ${formatDateShortFr(start)}`;
    }

    return `${weekText} - ${formatDateShortFr(start)} au ${formatDateShortFr(end)}`;
}

function getOpenDatesBetween(startIso, endIso) {
    const start = parseIsoDate(startIso);
    const end = parseIsoDate(endIso);
    if (!start || !end || start > end) return [];

    const result = [];
    const cursor = new Date(start.getTime());

    while (cursor <= end) {
        const day = cursor.getDay();
        if (day >= 1 && day <= 5) {
            const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
            result.push(iso);
        }
        cursor.setDate(cursor.getDate() + 1);
    }

    return result;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function resetProfessorData() {
    conseilsState.importedProfs = [];
    conseilsState.importFileName = '';
    conseilsState.manualProfs = [];
    conseilsState.profConstraintsById = {};
    conseilsState.selectedProfConstraintId = '';
    conseilsState.resultsMap = {};
    conseilsState.resultsWarning = '';
}

function resetScheduleData() {
    conseilsState.dateStart = '';
    conseilsState.dateEnd = '';
    conseilsState.selectedDates = [];
    conseilsState.slotCount = null;
    conseilsState.useSpecificSlots = false;
    conseilsState.specificSlotsByDate = {};
    conseilsState.resultsMap = {};
    conseilsState.resultsWarning = '';

    const startInput = document.getElementById('conseils-date-start');
    const endInput = document.getElementById('conseils-date-end');
    if (startInput) startInput.value = '';
    if (endInput) endInput.value = '';

    document.querySelectorAll('input[name="conseils_slot_count"]').forEach(input => {
        input.checked = false;
    });
    toggleSpecificSlots(false);
    renderAvailableDates();
    renderScheduleSummary();
}

function syncSpecificSlotsMapWithSelectedDates() {
    const kept = {};
    conseilsState.selectedDates.forEach(dateIso => {
        if (conseilsState.specificSlotsByDate[dateIso]) {
            kept[dateIso] = conseilsState.specificSlotsByDate[dateIso];
        } else if (conseilsState.slotCount) {
            kept[dateIso] = conseilsState.slotCount;
        } else {
            kept[dateIso] = 1;
        }
    });
    conseilsState.specificSlotsByDate = kept;
}

function renderSpecificSlotsEditor() {
    const block = document.getElementById('conseils-specific-slots');
    const grid = document.getElementById('conseils-specific-slots-grid');
    const toggleBtn = document.getElementById('conseils-toggle-specific-slots');
    const genericTitle = document.getElementById('conseils-generic-slots-title');
    const genericGrid = document.getElementById('conseils-generic-slots-grid');
    if (!block || !grid || !toggleBtn) return;

    toggleBtn.classList.toggle('active', conseilsState.useSpecificSlots);
    block.classList.toggle('hidden', !conseilsState.useSpecificSlots);
    if (genericTitle) genericTitle.classList.toggle('hidden', conseilsState.useSpecificSlots);
    if (genericGrid) genericGrid.classList.toggle('hidden', conseilsState.useSpecificSlots);

    if (!conseilsState.useSpecificSlots) {
        return;
    }

    if (!conseilsState.selectedDates.length) {
        grid.innerHTML = '<p class="wizard-panel-hint">Selectionnez d abord une ou plusieurs dates.</p>';
        return;
    }

    syncSpecificSlotsMapWithSelectedDates();
    grid.innerHTML = conseilsState.selectedDates.map(isoDate => {
        const value = conseilsState.specificSlotsByDate[isoDate] || 1;
        return `
            <label class="conseils-specific-slot-item">
                <span>${formatDateFr(isoDate)}</span>
                <input type="number" min="1" max="10" step="1" value="${value}" data-slot-date="${isoDate}">
            </label>
        `;
    }).join('');

    grid.querySelectorAll('input[data-slot-date]').forEach(input => {
        input.addEventListener('input', function() {
            const isoDate = this.dataset.slotDate;
            const parsed = parseInt(this.value, 10);
            const safeValue = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
            conseilsState.specificSlotsByDate[isoDate] = safeValue;
            renderScheduleSummary();
            setError(3, '');
        });
    });
}

function toggleSpecificSlots(forceValue) {
    const nextValue = typeof forceValue === 'boolean' ? forceValue : !conseilsState.useSpecificSlots;
    conseilsState.useSpecificSlots = nextValue;
    if (conseilsState.useSpecificSlots) {
        syncSpecificSlotsMapWithSelectedDates();
    }
    renderSpecificSlotsEditor();
    renderScheduleSummary();
}

function updateStepIndicators() {
    for (let i = 1; i <= CONSEILS_MAX_STEPS; i++) {
        const indicator = document.getElementById(`conseils-step-indicator-${i}`);
        if (!indicator) continue;
        indicator.classList.toggle('active', i === conseilsStep);
        indicator.classList.toggle('done', i < conseilsStep);
    }
}

function updatePanels() {
    for (let i = 1; i <= CONSEILS_MAX_STEPS; i++) {
        const panel = document.getElementById(`conseils-panel-${i}`);
        if (!panel) continue;
        panel.classList.toggle('active', i === conseilsStep);
    }
}

function updateNav() {
    const prevBtn = document.getElementById('conseils-btn-prev');
    const nextBtn = document.getElementById('conseils-btn-next');

    if (!prevBtn || !nextBtn) return;

    prevBtn.classList.toggle('hidden', conseilsStep === 1);
    if (conseilsStep === 1) {
        nextBtn.textContent = 'Suivant →';
    } else if (conseilsStep === 2) {
        nextBtn.textContent = 'Valider cette base';
    } else if (conseilsStep === 3) {
        nextBtn.textContent = 'Continuer vers les profs';
    } else if (conseilsStep === 4) {
        nextBtn.textContent = 'Suivant';
    } else if (conseilsStep === 5) {
        nextBtn.textContent = 'Voir les resultats';
    } else {
        nextBtn.textContent = 'Exporter Excel';
    }
}

function assignProfIds(profs) {
    return (profs || []).map(prof => {
        const existingId = normalizeCellValue(prof && prof.id ? prof.id : '');
        if (existingId) {
            return {
                ...prof,
                id: existingId
            };
        }
        const id = `prof_${conseilsState.profUidCounter++}`;
        return {
            ...prof,
            id
        };
    });
}

function getAvailableWeekdays() {
    const labels = conseilsState.selectedDates
        .map(dateIso => formatDateFr(dateIso).split(' ')[0].toLowerCase())
        .filter(Boolean);
    const set = new Set(labels);
    return WEEKDAY_ORDER.filter(label => set.has(label));
}

function getSlotOptionsForConstraint() {
    if (conseilsState.useSpecificSlots) {
        const values = Object.values(conseilsState.specificSlotsByDate || {}).filter(v => Number.isFinite(v) && v >= 1);
        const max = values.length ? Math.max(...values) : 1;
        return Array.from({ length: max }, (_, index) => index + 1);
    }

    const max = Number.isFinite(conseilsState.slotCount) && conseilsState.slotCount >= 1 ? conseilsState.slotCount : 1;
    return Array.from({ length: max }, (_, index) => index + 1);
}

function getSelectedConstraintProf() {
    return conseilsState.importedProfs.find(prof => prof.id === conseilsState.selectedProfConstraintId) || null;
}

function syncManualProfsFromImported() {
    if (conseilsState.sourceMode !== 'manual') return;
    conseilsState.manualProfs = conseilsState.importedProfs.map(prof => ({
        name: prof.name,
        classes: Array.isArray(prof.classes) ? [...prof.classes] : [],
        mainClasses: Array.isArray(prof.mainClasses) ? [...prof.mainClasses] : []
    }));
}

function formatConstraintLabel(constraint) {
    if (!constraint) return '';

    if (constraint.type === 'day_weekday') {
        const labels = (constraint.weekdays || []).join(', ');
        return `Pas dispo les jours: ${labels}`;
    }
    if (constraint.type === 'slot_weekday') {
        const labels = (constraint.weekdays || []).join(', ');
        return `Pas dispo creneau ${constraint.slot} les jours: ${labels}`;
    }
    if (constraint.type === 'day_date') {
        return `Pas dispo le jour: ${formatDateFr(constraint.dateIso)}`;
    }
    if (constraint.type === 'slot_date') {
        return `Pas dispo creneau ${constraint.slot} le jour: ${formatDateFr(constraint.dateIso)}`;
    }

    return 'Contrainte non reconnue';
}

function formatConstraintTagLabel(constraint) {
    if (!constraint) return '';

    if (constraint.type === 'day_weekday') {
        const labels = (constraint.weekdays || []).join(', ');
        return `Indisponible tous les: ${labels}`;
    }
    if (constraint.type === 'slot_weekday') {
        const labels = (constraint.weekdays || []).join(', ');
        return `Indisponible au creneau ${constraint.slot} les: ${labels}`;
    }
    if (constraint.type === 'day_date') {
        return `Indisponible le: ${formatDateFr(constraint.dateIso)}`;
    }
    if (constraint.type === 'slot_date') {
        return `Indisponible au creneau ${constraint.slot} le: ${formatDateFr(constraint.dateIso)}`;
    }

    return 'Contrainte';
}

function formatClassChipHtml(rawLabel) {
    const label = normalizeCellValue(rawLabel);
    const match = label.match(/^(\d)eme(\d+)$/i);
    if (!match) {
        return escapeHtml(label);
    }

    const level = match[1];
    const index = match[2];
    return `${level}<sup>e</sup>${index}`;
}

function formatClassLabelCompact(rawLabel) {
    const label = normalizeCellValue(rawLabel);
    const match = label.match(/^(\d)eme(\d+)$/i);
    if (!match) {
        return label;
    }
    return `${match[1]}e${match[2]}`;
}

function normalizeClassToken(rawValue) {
    const value = normalizeCellValue(rawValue)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^0-9a-z]/g, '');

    const match = value.match(/^([6543])(?:eme|em|e)?(\d{1,2})$/);
    if (!match) return '';
    const level = match[1];
    const classIndex = String(parseInt(match[2], 10));
    return `${level}eme${classIndex}`;
}

function parsePrincipalClassesCell(rawValue, expectedClasses) {
    const expectedMap = new Map(expectedClasses.map(label => [normalizeClassToken(label), label]));
    const normalizedRaw = normalizeCellValue(rawValue)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const found = new Set();
    const regex = /([6543])\s*(?:eme|em|e)?\s*(\d{1,2})/g;
    let match;

    while ((match = regex.exec(normalizedRaw)) !== null) {
        const token = `${match[1]}eme${String(parseInt(match[2], 10))}`;
        if (expectedMap.has(token)) {
            found.add(expectedMap.get(token));
        }
    }

    if (!found.size) {
        const compactToken = normalizeClassToken(normalizedRaw);
        if (expectedMap.has(compactToken)) {
            found.add(expectedMap.get(compactToken));
        }
    }

    return Array.from(found);
}

function looksLikeProfessorName(rawValue) {
    const value = normalizeCellValue(rawValue);
    if (!value) return false;

    const normalized = value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    if (/\d/.test(normalized)) return false;
    if (normalizeClassToken(normalized)) return false;

    const words = normalized
        .split(/\s+/)
        .map(part => part.replace(/[^a-z\-']/g, ''))
        .filter(Boolean);

    if (words.length < 2) return false;
    return words.every(word => word.length >= 2);
}

function getColumnScore(dataRows, columnIndex, matcher) {
    let nonEmpty = 0;
    let matched = 0;

    dataRows.forEach(row => {
        const cell = normalizeCellValue((row || [])[columnIndex] || '');
        if (!cell) return;
        nonEmpty += 1;
        if (matcher(cell)) {
            matched += 1;
        }
    });

    const ratio = nonEmpty ? matched / nonEmpty : 0;
    return { nonEmpty, matched, ratio };
}

function detectBestColumnIndex(dataRows, columnCount, matcher, preferredIndex, minMatched, minRatio, excludedIndexes) {
    const excluded = new Set(excludedIndexes || []);
    const safePreferred = Number.isInteger(preferredIndex) && preferredIndex >= 0 && preferredIndex < columnCount
        ? preferredIndex
        : null;

    if (safePreferred !== null && !excluded.has(safePreferred)) {
        const preferredScore = getColumnScore(dataRows, safePreferred, matcher);
        if (preferredScore.matched >= minMatched && preferredScore.ratio >= minRatio) {
            return safePreferred;
        }
    }

    let bestIndex = safePreferred !== null && !excluded.has(safePreferred) ? safePreferred : -1;
    let bestScore = bestIndex >= 0
        ? getColumnScore(dataRows, bestIndex, matcher)
        : { nonEmpty: 0, matched: 0, ratio: 0 };

    for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
        if (excluded.has(columnIndex)) continue;
        const score = getColumnScore(dataRows, columnIndex, matcher);
        if (score.matched < minMatched) continue;

        const isBetter = (score.ratio > bestScore.ratio)
            || (score.ratio === bestScore.ratio && score.matched > bestScore.matched)
            || (score.ratio === bestScore.ratio && score.matched === bestScore.matched && bestIndex >= 0 && columnIndex < bestIndex);

        if (isBetter) {
            bestIndex = columnIndex;
            bestScore = score;
        }
    }

    return bestIndex >= 0 ? bestIndex : safePreferred;
}

function detectClassColumnsByHeader(header, expectedClasses, occupiedIndexes) {
    const occupied = new Set(occupiedIndexes || []);
    const expectedByToken = new Map(expectedClasses.map(label => [normalizeClassToken(label), label]));
    const mapped = {};

    header.forEach((rawHeader, index) => {
        if (occupied.has(index)) return;

        const candidates = parsePrincipalClassesCell(rawHeader, expectedClasses);
        if (!candidates.length) return;

        const token = normalizeClassToken(candidates[0]);
        const expectedLabel = expectedByToken.get(token);
        if (!expectedLabel) return;
        if (mapped[expectedLabel] !== undefined) return;

        mapped[expectedLabel] = index;
        occupied.add(index);
    });

    return mapped;
}

function detectImportColumns(header, dataRows, expectedClasses) {
    const columnCount = Math.max(
        header.length,
        ...dataRows.map(row => (row || []).length),
        expectedClasses.length + 2
    );

    const nameCol = detectBestColumnIndex(
        dataRows,
        columnCount,
        looksLikeProfessorName,
        0,
        1,
        0.35,
        []
    );

    const principalMatcher = cell => parsePrincipalClassesCell(cell, expectedClasses).length > 0;
    let principalCol = detectBestColumnIndex(
        dataRows,
        columnCount,
        principalMatcher,
        1,
        1,
        0.2,
        [nameCol]
    );

    if (principalCol === null || principalCol === undefined || principalCol < 0) {
        const fallbackPrincipal = [1, 0, 2].find(index => index >= 0 && index < columnCount && index !== nameCol);
        principalCol = fallbackPrincipal !== undefined ? fallbackPrincipal : 0;
    }

    const classColumns = detectClassColumnsByHeader(header, expectedClasses, [nameCol, principalCol]);
    expectedClasses.forEach((label, index) => {
        if (classColumns[label] !== undefined) return;
        const fallbackIndex = index + 2;
        if (fallbackIndex < columnCount && fallbackIndex !== nameCol && fallbackIndex !== principalCol) {
            classColumns[label] = fallbackIndex;
        }
    });

    return {
        nameCol,
        principalCol,
        classColumns
    };
}

function getWeekdayLabelFromIso(isoDate) {
    const date = parseIsoDate(isoDate);
    if (!date) return '';
    const day = date.getDay();
    if (day === 0) return 'dimanche';
    return WEEKDAY_ORDER[day - 1] || '';
}

function buildSessionTokensFromSchedule() {
    const tokens = [];

    conseilsState.selectedDates.forEach(dateIso => {
        const slotTotal = conseilsState.useSpecificSlots
            ? (conseilsState.specificSlotsByDate[dateIso] || 0)
            : (conseilsState.slotCount || 0);

        for (let slot = 1; slot <= slotTotal; slot++) {
            tokens.push(`${dateIso}#${slot}`);
        }
    });

    return tokens;
}

function applyProfessorConstraintsToSessions(prof, sessionTokens) {
    const constraints = conseilsState.profConstraintsById[prof.id] || [];
    const allowed = sessionTokens.filter(token => {
        const [dateIso, slotStr] = String(token).split('#');
        const slot = parseInt(slotStr, 10);
        const weekday = getWeekdayLabelFromIso(dateIso);

        for (const c of constraints) {
            if (c.type === 'day_weekday' && (c.weekdays || []).includes(weekday)) {
                return false;
            }
            if (c.type === 'slot_weekday' && (c.weekdays || []).includes(weekday) && slot === parseInt(c.slot, 10)) {
                return false;
            }
            if (c.type === 'day_date' && c.dateIso === dateIso) {
                return false;
            }
            if (c.type === 'slot_date' && c.dateIso === dateIso && slot === parseInt(c.slot, 10)) {
                return false;
            }
        }

        return true;
    });

    return allowed;
}

function buildSolverPayload() {
    const baseSessions = buildSessionTokensFromSchedule();
    if (!baseSessions.length) return [];

    return conseilsState.importedProfs
        .filter(prof => normalizeCellValue(prof.name) && Array.isArray(prof.classes) && prof.classes.length)
        .map(prof => {
            const sessions = applyProfessorConstraintsToSessions(prof, baseSessions);
            return {
                name: normalizeCellValue(prof.name),
                classes: prof.classes,
                sessions
            };
        })
        .filter(p => p.sessions.length);
}

function formatSessionTokenLabel(token) {
    const [dateIso, slotStr] = String(token || '').split('#');
    const slot = parseInt(slotStr, 10);
    if (!dateIso || !Number.isFinite(slot)) return String(token || '');
    return `${formatDateFr(dateIso)} - Creneau ${slot}`;
}

function getProfessorsForClass(classLabel) {
    return (conseilsState.importedProfs || []).filter(prof =>
        Array.isArray(prof.classes) && prof.classes.includes(classLabel)
    );
}

function isConstraintViolatedAtSlot(constraint, toDateIso, toWeekday, toSlot) {
    if (!constraint) return false;

    if (constraint.type === 'day_weekday' && (constraint.weekdays || []).includes(toWeekday)) {
        return true;
    }
    if (constraint.type === 'slot_weekday' && (constraint.weekdays || []).includes(toWeekday) && toSlot === parseInt(constraint.slot, 10)) {
        return true;
    }
    if (constraint.type === 'day_date' && constraint.dateIso === toDateIso) {
        return true;
    }
    if (constraint.type === 'slot_date' && constraint.dateIso === toDateIso && toSlot === parseInt(constraint.slot, 10)) {
        return true;
    }

    return false;
}

function renderTooltipListItems(items, emptyText) {
    if (!items || !items.length) {
        return `<li class="popover-empty">${escapeHtml(emptyText || 'Aucune')}</li>`;
    }
    return items.map(item => `<li>${item}</li>`).join('');
}

function buildClassChipPopoverHtml(classLabel, slotToken) {
    const compactClass = escapeHtml(formatClassLabelCompact(classLabel));
    const profs = getProfessorsForClass(classLabel);
    const declaredConstraints = [];
    const profNames = profs
        .map(prof => normalizeCellValue(prof.name))
        .filter(Boolean)
        .map(name => escapeHtml(name));

    const profLine = profNames.length
        ? profNames.join(', ')
        : 'Non identifies';

    profs.forEach(prof => {
        const profName = escapeHtml(normalizeCellValue(prof.name) || 'Professeur inconnu');
        const constraints = conseilsState.profConstraintsById[prof.id] || [];

        if (!constraints.length) {
            declaredConstraints.push(`${profName} : Aucune contrainte explicite`);
            return;
        }

        constraints.forEach(constraint => {
            declaredConstraints.push(`${profName} : ${escapeHtml(formatConstraintTagLabel(constraint))}`);
        });
    });

    if (slotToken === '__UNASSIGNED__') {
        return `
            <div class="class-indicator-popover conseils-chip-popover" role="tooltip">
                <div class="popover-title">${compactClass}</div>
                <div class="popover-section">
                    <div class="popover-section-title">Statut</div>
                    <ul class="popover-list">
                        <li>Non affectee a un creneau</li>
                    </ul>
                </div>
                <div class="popover-section">
                    <div class="popover-section-title">Professeur(s)</div>
                    <ul class="popover-list">
                        <li>${profLine}</li>
                    </ul>
                </div>
                <div class="popover-section">
                    <div class="popover-section-title mid">Contraintes</div>
                    <ul class="popover-list">
                        ${renderTooltipListItems(declaredConstraints, 'Aucune contrainte declaree')}
                        <li>Evaluation complete apres affectation a un creneau</li>
                    </ul>
                </div>
            </div>
        `;
    }

    const [toDateIso, toSlotStr] = String(slotToken || '').split('#');
    const toSlot = parseInt(toSlotStr, 10);

    if (!parseIsoDate(toDateIso) || !Number.isFinite(toSlot)) {
        return `
            <div class="class-indicator-popover conseils-chip-popover" role="tooltip">
                <div class="popover-title">${compactClass}</div>
                <div class="popover-section">
                    <div class="popover-section-title">Creneau</div>
                    <ul class="popover-list"><li>${escapeHtml(formatSessionTokenLabel(slotToken))}</li></ul>
                </div>
                <div class="popover-section">
                    <div class="popover-section-title">Professeur(s)</div>
                    <ul class="popover-list"><li>${profLine}</li></ul>
                </div>
            </div>
        `;
    }

    const toWeekday = getWeekdayLabelFromIso(toDateIso);
    const respected = [];
    const violated = [];

    profs.forEach(prof => {
        const constraints = conseilsState.profConstraintsById[prof.id] || [];
        const profName = escapeHtml(normalizeCellValue(prof.name) || 'Professeur inconnu');

        constraints.forEach(constraint => {
            const label = `${profName} : ${escapeHtml(formatConstraintTagLabel(constraint))}`;
            if (isConstraintViolatedAtSlot(constraint, toDateIso, toWeekday, toSlot)) {
                violated.push(label);
            } else {
                respected.push(label);
            }
        });
    });

    const collisions = checkConstraintViolationsForMove(classLabel, '__UNASSIGNED__', slotToken)
        .filter(v => v.type === 'double_booking')
        .map(v => v.label);

    return `
        <div class="class-indicator-popover conseils-chip-popover" role="tooltip">
            <div class="popover-title">${compactClass}</div>
            <div class="popover-section">
                <div class="popover-section-title">Creneau</div>
                <ul class="popover-list">
                    <li>${escapeHtml(formatSessionTokenLabel(slotToken))}</li>
                </ul>
            </div>
            <div class="popover-section">
                <div class="popover-section-title">Professeur(s)</div>
                <ul class="popover-list">
                    <li>${profLine}</li>
                </ul>
            </div>
            <div class="popover-section">
                <div class="popover-section-title ok">Contraintes respectees (${respected.length})</div>
                <ul class="popover-list">${renderTooltipListItems(respected, 'Aucune contrainte explicite')}</ul>
            </div>
            <div class="popover-section">
                <div class="popover-section-title ko">Contraintes non respectees (${violated.length + collisions.length})</div>
                <ul class="popover-list">${renderTooltipListItems(violated.concat(collisions), 'Aucune')}</ul>
            </div>
        </div>
    `;
}

function adjustResultsChipPopovers() {
    const anchors = document.querySelectorAll('.conseils-chip-popover-anchor');
    if (!anchors.length) return;

    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1200;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 800;
    const margin = 12;

    anchors.forEach(anchor => {
        const popover = anchor.querySelector('.conseils-chip-popover');
        if (!popover) return;

        anchor.classList.remove('popover-below', 'popover-align-right');
        popover.classList.remove('popover-align-right', 'popover-below');

        const anchorRect = anchor.getBoundingClientRect();
        const popoverWidth = popover.offsetWidth || 320;
        const popoverHeight = popover.offsetHeight || 220;

        if (anchorRect.left + popoverWidth > viewportWidth - margin) {
            anchor.classList.add('popover-align-right');
            popover.classList.add('popover-align-right');
        }

        if (anchorRect.top < popoverHeight + 24) {
            anchor.classList.add('popover-below');
            popover.classList.add('popover-below');
        }

        if (anchorRect.bottom + popoverHeight > viewportHeight - margin && anchor.classList.contains('popover-below')) {
            anchor.classList.remove('popover-below');
            popover.classList.remove('popover-below');
        }
    });
}

function renderResultsTable() {
    const metrics = document.getElementById('conseils-results-metrics');
    const calendar = document.getElementById('conseils-results-calendar');
    const warning = document.getElementById('conseils-results-warning');
    if (!metrics || !calendar || !warning) return;

    const entries = Object.entries(conseilsState.resultsMap || {});
    const expectedClasses = getSelectedClassLabels();
    const assignedClassSet = new Set(entries.map(([classLabel]) => classLabel));
    const unassignedClasses = expectedClasses.filter(label => !assignedClassSet.has(label));
    const uniqueSlots = new Set(entries.map(([, token]) => String(token))).size;

    metrics.innerHTML = `
        <article class="conseils-results-metric">
            <div class="conseils-results-metric-title">Classes configurees</div>
            <div class="conseils-results-metric-value">${expectedClasses.length}</div>
        </article>
        <article class="conseils-results-metric">
            <div class="conseils-results-metric-title">Classes affectees</div>
            <div class="conseils-results-metric-value">${entries.length}</div>
        </article>
        <article class="conseils-results-metric">
            <div class="conseils-results-metric-title">Non affectees</div>
            <div class="conseils-results-metric-value">${unassignedClasses.length}</div>
        </article>
        <article class="conseils-results-metric">
            <div class="conseils-results-metric-title">Creneaux utilises</div>
            <div class="conseils-results-metric-value">${uniqueSlots}</div>
        </article>
    `;

    const byDateSlot = new Map();
    const fallbackEntries = [];
    let hasConflictInCalendar = false;
    let hasWarningInCalendar = false;

    entries.forEach(([classLabel, token]) => {
        const parts = String(token || '').split('#');
        const dateIso = parts[0];
        const slot = parseInt(parts[1], 10);

        if (!parseIsoDate(dateIso) || !Number.isFinite(slot)) {
            fallbackEntries.push([classLabel, token]);
            return;
        }

        const key = `${dateIso}#${slot}`;
        if (!byDateSlot.has(key)) {
            byDateSlot.set(key, []);
        }
        byDateSlot.get(key).push(classLabel);
    });

    const resultDates = Array.from(new Set(entries
        .map(([, token]) => String(token || '').split('#')[0])
        .filter(dateIso => parseIsoDate(dateIso))));

    const dayOrder = conseilsState.selectedDates.length
        ? conseilsState.selectedDates.slice()
        : resultDates.sort((a, b) => parseIsoDate(a) - parseIsoDate(b));

    const extraDates = resultDates.filter(dateIso => !dayOrder.includes(dateIso)).sort((a, b) => parseIsoDate(a) - parseIsoDate(b));
    const allDays = dayOrder.concat(extraDates);

    const weekMap = new Map();
    allDays.forEach(dateIso => {
        const info = getIsoWeekData(dateIso);
        const weekKey = info ? info.key : `no-week-${dateIso}`;
        if (!weekMap.has(weekKey)) {
            weekMap.set(weekKey, []);
        }
        weekMap.get(weekKey).push(dateIso);
    });

    const timelineHeaderHtml = `
        <div class="conseils-timeline-header">
            ${WORKDAY_ORDER.map(day => `<div class="conseils-timeline-col-head">${escapeHtml(day.charAt(0).toUpperCase() + day.slice(1))}</div>`).join('')}
        </div>
    `;

    const weekRowsHtml = Array.from(weekMap.entries()).map(([, dateList]) => {
        const dateByWeekday = new Map();
        dateList.forEach(dateIso => {
            const weekday = getWeekdayLabelFromIso(dateIso);
            if (WORKDAY_ORDER.includes(weekday)) {
                dateByWeekday.set(weekday, dateIso);
            }
        });

        const dayCardsHtml = WORKDAY_ORDER.map(weekday => {
            const dateIso = dateByWeekday.get(weekday);

            if (!dateIso) {
                return `
                    <article class="conseils-calendar-day conseils-calendar-day-empty">
                        <div class="conseils-calendar-day-head">
                            <div class="conseils-calendar-day-title">-</div>
                        </div>
                        <div class="conseils-calendar-empty">Aucun jour selectionne</div>
                    </article>
                `;
            }

            const foundSlots = Array.from(byDateSlot.keys())
                .map(key => key.split('#'))
                .filter(parts => parts[0] === dateIso)
                .map(parts => parseInt(parts[1], 10))
                .filter(Number.isFinite);

            const configuredSlots = conseilsState.useSpecificSlots
                ? (conseilsState.specificSlotsByDate[dateIso] || 0)
                : (conseilsState.slotCount || 0);
            const slotCount = Math.max(configuredSlots, foundSlots.length ? Math.max(...foundSlots) : 0);

            if (!slotCount) {
                return `
                    <article class="conseils-calendar-day">
                        <div class="conseils-calendar-day-head">
                            <div class="conseils-calendar-day-title">${escapeHtml(formatDateFr(dateIso))}</div>
                        </div>
                        <div class="conseils-calendar-empty">Aucun creneau configure</div>
                    </article>
                `;
            }

            const rowsHtml = Array.from({ length: slotCount }, (_, idx) => idx + 1)
                .map(slot => {
                    const key = `${dateIso}#${slot}`;
                    const classes = byDateSlot.get(key) || [];
                    const classesHtml = classes.length
                        ? classes
                            .sort((a, b) => String(a).localeCompare(String(b), 'fr'))
                            .map((label, idx) => {
                                const violations = checkConstraintViolationsForMove(label, '__UNASSIGNED__', key);
                                const hasConflict = violations.some(v => v.type === 'double_booking');
                                const hasConstraintIssue = violations.some(v => v.type === 'constraint');
                                if (hasConflict) {
                                    hasConflictInCalendar = true;
                                } else if (hasConstraintIssue) {
                                    hasWarningInCalendar = true;
                                }
                                const extraChipClass = hasConflict
                                    ? ' conseils-class-chip-conflict'
                                    : hasConstraintIssue
                                        ? ' conseils-class-chip-warning'
                                        : '';
                                const popoverHtml = buildClassChipPopoverHtml(label, key);
                                return `<span class="conseils-chip-popover-anchor"><span class="conseils-class-chip conseils-class-chip-colored${extraChipClass}" draggable="true" data-class-label="${escapeHtml(label)}" data-from-token="${key}" data-chip-index="${idx}">${formatClassChipHtml(label)}</span>${popoverHtml}</span>`;
                            })
                            .join('')
                        : '<span class="conseils-class-chip muted">Libre</span>';

                    return `
                        <div class="conseils-calendar-slot-row" data-slot-token="${key}" data-drop-zone="true">
                            <span class="conseils-result-card-slot">Creneau ${slot}</span>
                            <div class="conseils-class-chip-wrap">${classesHtml}</div>
                        </div>
                    `;
                })
                .join('');

            return `
                <article class="conseils-calendar-day">
                    <div class="conseils-calendar-day-head">
                        <div class="conseils-calendar-day-title">${escapeHtml(formatDateShortFr(dateIso))}</div>
                    </div>
                    <div class="conseils-calendar-slots">${rowsHtml}</div>
                </article>
            `;
        }).join('');

        return `
            <section class="conseils-week-row">
                <div class="conseils-week-row-title">${escapeHtml(formatWeekRangeLabel(dateList))}</div>
                <div class="conseils-week-grid">${dayCardsHtml}</div>
            </section>
        `;
    }).join('');

    const fallbackHtml = fallbackEntries.length
        ? `
            <div class="conseils-results-unassigned">
                <div class="conseils-results-unassigned-title">Affectations non interpretees</div>
                <div class="conseils-class-chip-wrap">
                    ${fallbackEntries.map(([classLabel, token]) => `<span class="conseils-class-chip muted">${formatClassChipHtml(classLabel)} -> ${escapeHtml(String(token))}</span>`).join('')}
                </div>
            </div>
        `
        : '';

    const unassignedHtml = `
        <div class="conseils-results-unassigned conseils-unassigned-drop-zone" data-slot-token="__UNASSIGNED__" data-drop-zone="true">
            <div class="conseils-results-unassigned-title">Classes non affectees</div>
            <div class="conseils-class-chip-wrap">
                ${unassignedClasses.length
                    ? unassignedClasses
                        .sort((a, b) => String(a).localeCompare(String(b), 'fr'))
                        .map(label => {
                            const popoverHtml = buildClassChipPopoverHtml(label, '__UNASSIGNED__');
                            return `<span class="conseils-chip-popover-anchor"><span class="conseils-class-chip muted" draggable="true" data-class-label="${escapeHtml(label)}" data-from-token="__UNASSIGNED__">${formatClassChipHtml(label)}</span>${popoverHtml}</span>`;
                        })
                        .join('')
                    : '<span class="conseils-class-chip muted">Aucune</span>'
                }
            </div>
            <p class="conseils-unassigned-hint">Glissez une classe ici pour la desaffecter, ou vers un creneau pour l affecter.</p>
        </div>
    `;

    const calendarHtml = weekRowsHtml
        ? timelineHeaderHtml + weekRowsHtml
        : '<div class="conseils-result-empty">Aucun jour configure pour afficher un planning.</div>';

    const legendItems = [];
    if (hasConflictInCalendar) {
        legendItems.push(`
            <span class="conseils-results-legend-item">
                <span class="conseils-results-legend-dot is-conflict"></span>
                Conflit prof au meme creneau
            </span>
        `);
    }
    if (hasWarningInCalendar) {
        legendItems.push(`
            <span class="conseils-results-legend-item">
                <span class="conseils-results-legend-dot is-warning"></span>
                Contrainte prof non respectee
            </span>
        `);
    }

    const legendHtml = legendItems.length
        ? `<div class="conseils-results-legend" aria-label="Legende des alertes">${legendItems.join('')}</div>`
        : '';

    calendar.innerHTML = legendHtml + calendarHtml + fallbackHtml + unassignedHtml;
    enableResultsDragAndDrop();
    adjustResultsChipPopovers();

    if (conseilsState.resultsWarning) {
        warning.textContent = conseilsState.resultsWarning;
        warning.classList.remove('hidden');
    } else {
        warning.textContent = '';
        warning.classList.add('hidden');
    }
}

function checkConstraintViolationsForMove(classLabel, fromToken, toToken) {
    const violations = [];

    const targetProfs = getProfessorsForClass(classLabel);
    if (!targetProfs.length) {
        return violations;
    }

    const [toDateIso, toSlotStr] = String(toToken || '').split('#');
    const toSlot = parseInt(toSlotStr, 10);

    if (!parseIsoDate(toDateIso) || !Number.isFinite(toSlot)) {
        return violations;
    }

    const toWeekday = getWeekdayLabelFromIso(toDateIso);

    targetProfs.forEach(targetProf => {
        const constraints = conseilsState.profConstraintsById[targetProf.id] || [];

        constraints.forEach(constraint => {
            let isViolated = false;

            if (constraint.type === 'day_weekday' && (constraint.weekdays || []).includes(toWeekday)) {
                isViolated = true;
            }
            if (constraint.type === 'slot_weekday' && (constraint.weekdays || []).includes(toWeekday) && toSlot === parseInt(constraint.slot, 10)) {
                isViolated = true;
            }
            if (constraint.type === 'day_date' && constraint.dateIso === toDateIso) {
                isViolated = true;
            }
            if (constraint.type === 'slot_date' && constraint.dateIso === toDateIso && toSlot === parseInt(constraint.slot, 10)) {
                isViolated = true;
            }

            if (isViolated) {
                const profName = normalizeCellValue(targetProf.name) || 'Professeur inconnu';
                violations.push({
                    type: 'constraint',
                    constraint,
                    label: `Prof ${escapeHtml(profName)} (${escapeHtml(formatClassLabelCompact(classLabel))}) : ${escapeHtml(formatConstraintTagLabel(constraint))}`
                });
            }
        });
    });

    const occupiedKeys = new Set();
    Object.entries(conseilsState.resultsMap || {}).forEach(([otherClassLabel, assignedToken]) => {
        if (otherClassLabel === classLabel) return;
        if (String(assignedToken) !== String(toToken)) return;

        targetProfs.forEach(targetProf => {
            if (!(targetProf.classes || []).includes(otherClassLabel)) return;

            const key = `${targetProf.id}::${otherClassLabel}`;
            if (occupiedKeys.has(key)) return;
            occupiedKeys.add(key);

            const profName = normalizeCellValue(targetProf.name) || 'Professeur inconnu';
            violations.push({
                type: 'double_booking',
                label: `Prof ${escapeHtml(profName)} deja occupe sur ${escapeHtml(formatClassLabelCompact(otherClassLabel))} au meme creneau.`
            });
        });
    });

    return violations;
}

function showDragValidationModal(classLabel, fromToken, toToken, violations) {
    const modal = document.getElementById('conseils-drag-validation-modal');
    const summary = document.getElementById('conseils-drag-validation-summary');
    const warningsContainer = document.getElementById('conseils-drag-validation-warnings');
    const confirmBtn = document.getElementById('conseils-drag-confirm');
    const cancelBtn = document.getElementById('conseils-drag-cancel');

    if (!modal || !warningsContainer || !confirmBtn || !cancelBtn) return;

    const concernedProfs = getProfessorsForClass(classLabel)
        .map(prof => normalizeCellValue(prof.name))
        .filter(Boolean);

    if (summary) {
        const profsText = concernedProfs.length
            ? concernedProfs.map(name => escapeHtml(name)).join(', ')
            : 'Non identifies';
        summary.innerHTML = `
            <strong>Classe :</strong> ${escapeHtml(formatClassLabelCompact(classLabel))}<br>
            <strong>De :</strong> ${escapeHtml(formatSessionTokenLabel(fromToken))}<br>
            <strong>Vers :</strong> ${escapeHtml(formatSessionTokenLabel(toToken))}<br>
            <strong>Prof(s) concerne(s) :</strong> ${profsText}
        `;
    }

    const warningsHtml = violations.length
        ? `<div class="conseils-drag-warnings-list">
            <p style="margin-bottom: 10px; font-weight: 700; color: #d32f2f;">Points a verifier avant confirmation :</p>
            ${violations.map(v => `<div class="conseils-drag-warning-item">✗ ${v.label}</div>`).join('')}
          </div>`
        : '<div class="conseils-drag-warnings-list"><p style="color: #1b5e20;">Aucune contrainte detectee pour ce deplacement.</p></div>';

    warningsContainer.innerHTML = warningsHtml;

    confirmBtn.onclick = function() {
        conseilsState.resultsMap[classLabel] = toToken;
        modal.classList.add('hidden');
        renderResultsTable();
    };

    cancelBtn.onclick = function() {
        modal.classList.add('hidden');
    };

    modal.classList.remove('hidden');
}

function hideDragValidationModal() {
    const modal = document.getElementById('conseils-drag-validation-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function enableResultsDragAndDrop() {
    const chips = document.querySelectorAll('[data-class-label][data-from-token]');
    const dropZones = document.querySelectorAll('[data-slot-token][data-drop-zone]');

    chips.forEach(chip => {
        chip.addEventListener('dragstart', function(e) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', JSON.stringify({
                classLabel: this.dataset.classLabel,
                fromToken: this.dataset.fromToken
            }));
            this.style.opacity = '0.5';
            document.body.classList.add('conseils-dragging');
        });

        chip.addEventListener('dragend', function(e) {
            this.style.opacity = '1';
            document.body.classList.remove('conseils-dragging');
        });
    });

    dropZones.forEach(zone => {
        zone.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            this.classList.add('conseils-drop-zone-active');
        });

        zone.addEventListener('dragleave', function(e) {
            if (e.target === this) {
                this.classList.remove('conseils-drop-zone-active');
            }
        });

        zone.addEventListener('drop', function(e) {
            e.preventDefault();
            this.classList.remove('conseils-drop-zone-active');
            document.body.classList.remove('conseils-dragging');

            try {
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                const { classLabel, fromToken } = data;
                const toToken = this.dataset.slotToken;

                if (fromToken === toToken) {
                    return;
                }

                if (toToken === '__UNASSIGNED__') {
                    delete conseilsState.resultsMap[classLabel];
                    renderResultsTable();
                    return;
                }

                const violations = checkConstraintViolationsForMove(classLabel, fromToken, toToken);
                showDragValidationModal(classLabel, fromToken, toToken, violations);
            } catch (err) {
                console.error('[DRAG_DROP]', err);
            }
        });
    });
}

async function runResultsComputation() {
    const status = document.getElementById('conseils-results-status');
    const error = document.getElementById('conseils-error-6');
    const runBtn = document.getElementById('conseils-run-results');

    if (status) status.textContent = 'Calcul en cours...';
    setError(6, '');
    if (runBtn) runBtn.disabled = true;

    try {
        const payload = buildSolverPayload();
        if (!payload.length) {
            throw new Error('Aucune donnee exploitable pour le calcul (professeurs, classes ou disponibilites).');
        }

        const response = await fetch('/trouver_creneau', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Le calcul a echoue.');
        }

        const resultMap = { ...data };
        const warningMessage = resultMap._warning || '';
        delete resultMap._warning;

        conseilsState.resultsMap = resultMap;
        conseilsState.resultsWarning = warningMessage;

        renderResultsTable();

        const count = Object.keys(resultMap).length;
        if (status) {
            status.textContent = count
                ? `Proposition generee: ${count} classe(s) affectee(s).`
                : 'Calcul termine, mais aucune classe n a pu etre affectee.';
        }
    } catch (err) {
        console.error('[CONSEILS_RESULTS]', err);
        conseilsState.resultsMap = {};
        conseilsState.resultsWarning = '';
        renderResultsTable();
        if (status) status.textContent = 'Echec du calcul.';
        if (error) {
            setError(6, err.message || 'Impossible de generer une proposition.');
        }
    } finally {
        if (runBtn) runBtn.disabled = false;
    }
}

function sanitizeConstraintsAgainstSchedule() {
    const validDates = new Set(conseilsState.selectedDates);
    const validWeekdays = new Set(getAvailableWeekdays());
    const maxSlot = Math.max(...getSlotOptionsForConstraint());

    Object.keys(conseilsState.profConstraintsById).forEach(profId => {
        const cleaned = (conseilsState.profConstraintsById[profId] || [])
            .map(constraint => {
                const base = { ...constraint };

                if (base.type === 'day_weekday' || base.type === 'slot_weekday') {
                    base.weekdays = (base.weekdays || []).filter(day => validWeekdays.has(day));
                }
                if (base.type === 'day_date' || base.type === 'slot_date') {
                    if (!validDates.has(base.dateIso)) {
                        return null;
                    }
                }
                if (base.type === 'slot_weekday' || base.type === 'slot_date') {
                    const parsed = parseInt(base.slot, 10);
                    base.slot = Number.isFinite(parsed) && parsed >= 1 ? Math.min(parsed, maxSlot) : 1;
                }

                if ((base.type === 'day_weekday' || base.type === 'slot_weekday') && !(base.weekdays || []).length) {
                    return null;
                }

                return base;
            })
            .filter(Boolean);

        conseilsState.profConstraintsById[profId] = cleaned;
    });
}

function renderConstraintFormFields() {
    const typeSelect = document.getElementById('conseils-constraint-type');
    const slotWrap = document.getElementById('conseils-constraint-slot-wrap');
    const slotInput = document.getElementById('conseils-constraint-slot');
    const weekdaysWrap = document.getElementById('conseils-constraint-weekdays-wrap');
    const weekdaysContainer = document.getElementById('conseils-constraint-weekdays');
    const dateWrap = document.getElementById('conseils-constraint-date-wrap');
    const dateSelect = document.getElementById('conseils-constraint-date');
    if (!typeSelect || !slotWrap || !slotInput || !weekdaysWrap || !weekdaysContainer || !dateWrap || !dateSelect) return;

    const selectedType = typeSelect.value;
    const showSlot = selectedType === 'slot_weekday' || selectedType === 'slot_date';
    const showWeekdays = selectedType === 'day_weekday' || selectedType === 'slot_weekday';
    const showDate = selectedType === 'day_date' || selectedType === 'slot_date';

    slotWrap.classList.toggle('hidden', !showSlot);
    weekdaysWrap.classList.toggle('hidden', !showWeekdays);
    dateWrap.classList.toggle('hidden', !showDate);

    const slotOptions = getSlotOptionsForConstraint();
    const currentSlot = parseInt(slotInput.value, 10);
    const safeSlot = slotOptions.includes(currentSlot) ? currentSlot : slotOptions[0];
    slotInput.min = String(slotOptions[0]);
    slotInput.max = String(slotOptions[slotOptions.length - 1]);
    slotInput.value = String(safeSlot);

    const weekdays = getAvailableWeekdays();
    weekdaysContainer.innerHTML = weekdays.length
        ? weekdays.map(day => {
            const label = day.charAt(0).toUpperCase() + day.slice(1);
            return `
                <label class="conseils-weekday-item">
                    <input type="checkbox" value="${day}">
                    <span>${label}</span>
                </label>
            `;
        }).join('')
        : '<p class="wizard-panel-hint">Aucun jour ouvre disponible dans la selection actuelle.</p>';

    dateSelect.innerHTML = conseilsState.selectedDates.length
        ? conseilsState.selectedDates.map(dateIso => `<option value="${dateIso}">${formatDateFr(dateIso)}</option>`).join('')
        : '<option value="">Aucune date disponible</option>';
}

function renderSelectedProfConstraints() {
    const list = document.getElementById('conseils-constraint-list');
    const selectedProf = getSelectedConstraintProf();
    if (!list) return;

    if (!selectedProf) {
        list.innerHTML = '<li class="conseils-constraint-empty">Selectionnez un professeur pour afficher ses contraintes.</li>';
        return;
    }

    const constraints = conseilsState.profConstraintsById[selectedProf.id] || [];
    if (!constraints.length) {
        list.innerHTML = '<li class="conseils-constraint-empty">Aucune contrainte enregistree pour ce professeur.</li>';
        return;
    }

    list.innerHTML = constraints.map((constraint, index) => `
        <li class="conseils-constraint-item">
            <span>${escapeHtml(formatConstraintLabel(constraint))}</span>
            <button type="button" class="conseils-constraint-remove" data-constraint-index="${index}">Supprimer</button>
        </li>
    `).join('');

    list.querySelectorAll('.conseils-constraint-remove').forEach(button => {
        button.addEventListener('click', function() {
            const constraintIndex = parseInt(this.dataset.constraintIndex, 10);
            const targetList = conseilsState.profConstraintsById[selectedProf.id] || [];
            targetList.splice(constraintIndex, 1);
            conseilsState.profConstraintsById[selectedProf.id] = targetList;
            renderStep5ProfessorTable();
            renderSelectedProfConstraints();
        });
    });
}

function renderStep5ProfessorTable() {
    const head = document.getElementById('conseils-prof-summary-head');
    const body = document.getElementById('conseils-prof-summary-body');
    if (!head || !body) return;

    head.innerHTML = '<tr><th>Professeur</th><th>Classes</th><th class="conseils-col-contraintes">Contraintes</th></tr>';

    if (!conseilsState.importedProfs.length) {
        body.innerHTML = '<tr><td colspan="3">Aucun professeur disponible.</td></tr>';
        return;
    }

    body.innerHTML = conseilsState.importedProfs.map(prof => {
        const allAssigned = (prof.classes || []);
        const mainClasses = new Set(prof.mainClasses || []);
        const classesHtml = allAssigned.length
            ? allAssigned.map(label => {
                const chipClass = mainClasses.has(label) ? 'conseils-class-chip main' : 'conseils-class-chip';
                return `<span class="${chipClass}">${formatClassChipHtml(label)}</span>`;
              }).join('')
            : '<span class="conseils-class-chip muted">Aucune</span>';
        const constraints = conseilsState.profConstraintsById[prof.id] || [];
        const constraintsHtml = constraints.length
            ? constraints.map(constraint => `<span class="conseils-constraint-chip" title="${escapeHtml(formatConstraintLabel(constraint))}">${escapeHtml(formatConstraintTagLabel(constraint))}</span>`).join('')
            : '<span class="conseils-constraint-chip muted">Aucune</span>';
        const selectedClass = prof.id === conseilsState.selectedProfConstraintId ? 'selected' : '';

        return `
            <tr class="conseils-prof-row ${selectedClass}" data-prof-id="${prof.id}">
                <td class="conseils-prof-name">${escapeHtml(prof.name)}</td>
                <td><div class="conseils-class-chip-wrap">${classesHtml}</div></td>
                <td><div class="conseils-constraint-chip-wrap">${constraintsHtml}</div></td>
            </tr>
        `;
    }).join('');

    body.querySelectorAll('.conseils-prof-row').forEach(row => {
        row.addEventListener('click', function() {
            conseilsState.selectedProfConstraintId = this.dataset.profId || '';
            setError(5, '');
            renderConstraintEditorHeader();
            renderSelectedProfEditor();
            renderStep5ProfessorTable();
            renderSelectedProfConstraints();
        });
    });

}

function renderSelectedProfEditor() {
    const nameInput = document.getElementById('conseils-prof-edit-name');
    const classesWrap = document.getElementById('conseils-prof-edit-classes');
    const selectedProf = getSelectedConstraintProf();
    if (!nameInput || !classesWrap) return;

    if (!selectedProf) {
        nameInput.value = '';
        nameInput.disabled = true;
        classesWrap.innerHTML = '<p class="wizard-panel-hint">Selectionnez un professeur pour modifier ses classes.</p>';
        return;
    }

    nameInput.disabled = false;
    nameInput.value = selectedProf.name || '';

    const allClasses = getSelectedClassLabels();
    if (!allClasses.length) {
        classesWrap.innerHTML = '<p class="wizard-panel-hint">Aucune classe disponible.</p>';
        return;
    }

    classesWrap.innerHTML = allClasses.map(label => {
        const inClasses = (selectedProf.classes || []).includes(label);
        const inMain = (selectedProf.mainClasses || []).includes(label);
        const state = inMain ? 'main' : inClasses ? 'assigned' : 'none';
        return `
            <button type="button" class="conseils-prof-class-option state-${state}" data-class-label="${escapeHtml(label)}">
                ${formatClassChipHtml(label)}
            </button>
        `;
    }).join('');

    classesWrap.querySelectorAll('.conseils-prof-class-option').forEach(btn => {
        btn.addEventListener('click', function() {
            const label = this.dataset.classLabel;
            const classes = selectedProf.classes || [];
            const mainClasses = selectedProf.mainClasses || [];
            const inClasses = classes.includes(label);
            const inMain = mainClasses.includes(label);

            if (!inClasses && !inMain) {
                // white → blue
                selectedProf.classes = [...classes, label];
                selectedProf.mainClasses = mainClasses.filter(l => l !== label);
            } else if (inClasses && !inMain) {
                // blue → yellow
                selectedProf.mainClasses = [...mainClasses, label];
            } else {
                // yellow → white
                selectedProf.classes = classes.filter(l => l !== label);
                selectedProf.mainClasses = mainClasses.filter(l => l !== label);
            }

            syncManualProfsFromImported();
            if (conseilsState.sourceMode === 'manual') {
                renderManualTable();
            }
            renderImportedProfsPreview();
            renderSelectedProfEditor();
            renderStep5ProfessorTable();
        });
    });
}

function renderConstraintEditorHeader() {
    const title = document.getElementById('conseils-constraint-prof-title');
    const hint = document.getElementById('conseils-constraint-prof-hint');
    const selectedProf = getSelectedConstraintProf();
    if (!title || !hint) return;

    if (!selectedProf) {
        title.textContent = 'Selectionnez un professeur';
        hint.textContent = 'Puis ajoutez une ou plusieurs contraintes ci-dessous.';
        return;
    }

    title.textContent = selectedProf.name;
    const classes = (selectedProf.classes || []).length
        ? selectedProf.classes.map(label => formatClassLabelCompact(label)).join(', ')
        : 'Aucune classe';
    hint.textContent = `Classes: ${classes}`;
}

function addConstraintForSelectedProf() {
    const selectedProf = getSelectedConstraintProf();
    if (!selectedProf) {
        setError(5, 'Veuillez selectionner un professeur avant d ajouter une contrainte.');
        return;
    }

    const typeSelect = document.getElementById('conseils-constraint-type');
    const slotInput = document.getElementById('conseils-constraint-slot');
    const dateSelect = document.getElementById('conseils-constraint-date');
    const weekdaysChecks = document.querySelectorAll('#conseils-constraint-weekdays input[type="checkbox"]:checked');
    if (!typeSelect || !slotInput || !dateSelect) return;

    const type = typeSelect.value;
    const slot = parseInt(slotInput.value, 10);
    const weekdays = Array.from(weekdaysChecks).map(el => el.value);
    const dateIso = dateSelect.value;

    if ((type === 'day_weekday' || type === 'slot_weekday') && !weekdays.length) {
        setError(5, 'Veuillez selectionner au moins un jour de semaine.');
        return;
    }

    if ((type === 'day_date' || type === 'slot_date') && !dateIso) {
        setError(5, 'Veuillez selectionner une date precise.');
        return;
    }

    if ((type === 'slot_weekday' || type === 'slot_date') && (!Number.isFinite(slot) || slot < 1)) {
        setError(5, 'Veuillez saisir un numero de creneau valide.');
        return;
    }

    const constraint = { type };
    if (type === 'day_weekday' || type === 'slot_weekday') {
        constraint.weekdays = weekdays;
    }
    if (type === 'day_date' || type === 'slot_date') {
        constraint.dateIso = dateIso;
    }
    if (type === 'slot_weekday' || type === 'slot_date') {
        constraint.slot = slot;
    }

    if (!conseilsState.profConstraintsById[selectedProf.id]) {
        conseilsState.profConstraintsById[selectedProf.id] = [];
    }
    conseilsState.profConstraintsById[selectedProf.id].push(constraint);

    setError(5, '');
    renderStep5ProfessorTable();
    renderSelectedProfConstraints();
}

function addProfessorFromStep5() {
    const created = assignProfIds([{ name: '', classes: [] }])[0];
    conseilsState.importedProfs.push(created);
    conseilsState.profConstraintsById[created.id] = [];
    conseilsState.selectedProfConstraintId = created.id;

    if (conseilsState.sourceMode === 'manual') {
        conseilsState.manualProfs.push({ name: '', classes: [] });
        renderManualTable();
    }

    renderImportedProfsPreview();
    renderSelectedProfEditor();
    renderStep5ProfessorTable();
    renderSelectedProfConstraints();
    setError(5, '');

    const nameInput = document.getElementById('conseils-prof-edit-name');
    if (nameInput) {
        nameInput.focus();
        nameInput.select();
    }
}

function removeSelectedProfessorFromStep5() {
    const selected = getSelectedConstraintProf();
    if (!selected) {
        setError(5, 'Veuillez selectionner un professeur a retirer.');
        return;
    }

    const idx = conseilsState.importedProfs.findIndex(prof => prof.id === selected.id);
    if (idx >= 0) {
        conseilsState.importedProfs.splice(idx, 1);
    }
    delete conseilsState.profConstraintsById[selected.id];

    if (conseilsState.sourceMode === 'manual') {
        syncManualProfsFromImported();
        renderManualTable();
    }

    conseilsState.selectedProfConstraintId = conseilsState.importedProfs[0]?.id || '';
    renderImportedProfsPreview();
    renderConstraintEditorHeader();
    renderSelectedProfEditor();
    renderStep5ProfessorTable();
    renderSelectedProfConstraints();
    setError(5, '');
}

function buildConstraintsPanel() {
    conseilsState.importedProfs = assignProfIds(conseilsState.importedProfs);

    const validProfIds = new Set(conseilsState.importedProfs.map(prof => prof.id));
    Object.keys(conseilsState.profConstraintsById).forEach(profId => {
        if (!validProfIds.has(profId)) {
            delete conseilsState.profConstraintsById[profId];
        }
    });
    conseilsState.importedProfs.forEach(prof => {
        if (!conseilsState.profConstraintsById[prof.id]) {
            conseilsState.profConstraintsById[prof.id] = [];
        }
    });

    if (!conseilsState.selectedProfConstraintId || !validProfIds.has(conseilsState.selectedProfConstraintId)) {
        conseilsState.selectedProfConstraintId = conseilsState.importedProfs[0]?.id || '';
    }

    sanitizeConstraintsAgainstSchedule();
    renderConstraintFormFields();
    renderConstraintEditorHeader();
    renderSelectedProfEditor();
    renderStep5ProfessorTable();
    renderSelectedProfConstraints();
}

function setError(step, message) {
    const errorEl = document.getElementById(`conseils-error-${step}`);
    if (!errorEl) return;

    if (message) {
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    } else {
        errorEl.classList.add('hidden');
    }
}

function setSourceMode(mode) {
    conseilsState.sourceMode = mode;

    const importBtn = document.getElementById('conseils-open-import');
    const manualBtn = document.getElementById('conseils-open-manual');
    const downloadBtn = document.getElementById('conseils-download-template');
    const expectedWrap = document.getElementById('conseils-expected-wrap');
    const importBlock = document.getElementById('conseils-import-block');
    const manualBlock = document.getElementById('conseils-manual-block');

    if (importBtn) importBtn.classList.toggle('active', mode === 'import');
    if (manualBtn) manualBtn.classList.toggle('active', mode === 'manual');
    if (importBtn) importBtn.setAttribute('aria-pressed', mode === 'import' ? 'true' : 'false');
    if (manualBtn) manualBtn.setAttribute('aria-pressed', mode === 'manual' ? 'true' : 'false');
    if (downloadBtn) {
        downloadBtn.classList.remove('active');
        downloadBtn.setAttribute('aria-pressed', 'false');
    }
    if (expectedWrap) expectedWrap.classList.toggle('hidden', mode === 'manual');
    if (importBlock) importBlock.classList.toggle('hidden', mode !== 'import');
    if (manualBlock) manualBlock.classList.toggle('hidden', mode !== 'manual');
}

function buildClassesPanel() {
    const container = document.getElementById('conseils-classes-grid');
    if (!container) return;

    conseilsState.niveaux = getSelectedNiveaux();
    normalizeClassesParNiveau();

    if (!conseilsState.niveaux.length) {
        container.innerHTML = '<p class="wizard-panel-hint">Aucun niveau selectionne.</p>';
        return;
    }

    container.innerHTML = conseilsState.niveaux.map(niveau => {
        const saved = conseilsState.classesParNiveau[niveau] || '';
        const options = [1, 2, 3, 4, 5].map(nb => {
            const checked = String(saved) === String(nb) ? 'checked' : '';
            return `
                <label class="nb-card">
                    <input type="radio" name="conseils_nb_${niveau}" value="${nb}" ${checked}>
                    <span>${nb}</span>
                </label>
            `;
        }).join('');

        return `
            <section class="conseils-level-config" data-level="${niveau}">
                <h3>${niveau}</h3>
                <div class="nb-grid">${options}</div>
            </section>
        `;
    }).join('');

    container.querySelectorAll('input[type="radio"]').forEach(input => {
        input.addEventListener('change', function() {
            const level = this.name.replace('conseils_nb_', '');
            conseilsState.classesParNiveau[level] = parseInt(this.value, 10);
            resetProfessorData();
            renderSummary();
            setError(2, '');
        });
    });

    renderSummary();
}

function renderSummary() {
    const summary = document.getElementById('conseils-summary');
    if (!summary) return;

    const entries = conseilsState.niveaux
        .filter(niveau => conseilsState.classesParNiveau[niveau])
        .map(niveau => {
            const count = conseilsState.classesParNiveau[niveau];
            const label = count > 1 ? 'classes' : 'classe';
            return `<li><strong>${niveau}</strong> : ${count} ${label}</li>`;
        })
        .join('');

    if (!entries) {
        summary.innerHTML = '<p class="wizard-panel-hint">Resume: en attente de selection du nombre de classes.</p>';
        return;
    }

    summary.innerHTML = `
        <h3 class="conseils-summary-title">Resume de configuration</h3>
        <ul>${entries}</ul>
    `;
}

function renderScheduleSummary() {
    const summary = document.getElementById('conseils-schedule-summary');
    if (!summary) return;

    const dayCount = conseilsState.selectedDates.length;
    const slotCount = conseilsState.slotCount;
    const useSpecific = conseilsState.useSpecificSlots;
    const hasSpecificValues = conseilsState.selectedDates.every(dateIso => {
        const v = conseilsState.specificSlotsByDate[dateIso];
        return Number.isFinite(v) && v >= 1;
    });

    if (!dayCount || (!useSpecific && !slotCount) || (useSpecific && !hasSpecificValues)) {
        summary.innerHTML = '<p class="wizard-panel-hint">Resume: en attente du parametrage des dates et des creneaux.</p>';
        return;
    }

    syncSpecificSlotsMapWithSelectedDates();
    const totalSlots = useSpecific
        ? conseilsState.selectedDates.reduce((sum, dateIso) => sum + (conseilsState.specificSlotsByDate[dateIso] || 0), 0)
        : dayCount * slotCount;
    const dayLabel = dayCount > 1 ? 'jours' : 'jour';
    const slotLabel = slotCount > 1 ? 'creneaux' : 'creneau';
    const totalLabel = totalSlots > 1 ? 'creneaux ouverts' : 'creneau ouvert';

    const details = useSpecific
        ? `<li><strong>Detail</strong> : ${conseilsState.selectedDates.map(dateIso => `${formatDateFr(dateIso)} (${conseilsState.specificSlotsByDate[dateIso] || 1})`).join(' ; ')}</li>`
        : '';
    const slotLine = useSpecific
        ? '<li><strong>Creneaux</strong> : configuration specifique par jour</li>'
        : `<li><strong>${slotCount}</strong> ${slotLabel} par jour</li>`;

    summary.innerHTML = `
        <h3 class="conseils-summary-title">Resume de configuration</h3>
        <ul>
            <li><strong>Intervalle</strong> : du ${formatDateFr(conseilsState.dateStart)} au ${formatDateFr(conseilsState.dateEnd)}</li>
            <li><strong>${dayCount}</strong> ${dayLabel}</li>
            ${slotLine}
            <li><strong>${totalSlots}</strong> ${totalLabel} au total</li>
            ${details}
        </ul>
    `;
}

function renderAvailableDates() {
    const container = document.getElementById('conseils-available-dates');
    if (!container) return;

    const startIso = conseilsState.dateStart;
    const endIso = conseilsState.dateEnd;
    const openDates = getOpenDatesBetween(startIso, endIso);

    if (!startIso || !endIso) {
        container.innerHTML = '<p class="wizard-panel-hint">Choisissez d abord un intervalle de dates.</p>';
        return;
    }

    if (!openDates.length) {
        container.innerHTML = '<p class="wizard-panel-hint">Aucun jour ouvre trouve dans cet intervalle.</p>';
        conseilsState.selectedDates = [];
        renderScheduleSummary();
        return;
    }

    const selectedSet = new Set(conseilsState.selectedDates);
    conseilsState.selectedDates = openDates.filter(d => selectedSet.has(d));
    syncSpecificSlotsMapWithSelectedDates();

    container.innerHTML = openDates.map(isoDate => {
        const checked = conseilsState.selectedDates.includes(isoDate) ? 'checked' : '';
        return `
            <label class="conseils-date-choice">
                <input type="checkbox" value="${isoDate}" ${checked}>
                <span>${formatDateFr(isoDate)}</span>
            </label>
        `;
    }).join('');

    container.querySelectorAll('input[type="checkbox"]').forEach(input => {
        input.addEventListener('change', function() {
            const checkedDates = Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(el => el.value);
            conseilsState.selectedDates = checkedDates;
            syncSpecificSlotsMapWithSelectedDates();
            setError(3, '');
            renderSpecificSlotsEditor();
            renderScheduleSummary();
        });
    });

    renderSpecificSlotsEditor();
    renderScheduleSummary();
}

function renderExpectedColumns() {
    const container = document.getElementById('conseils-expected-columns');
    if (!container) return;

    const classes = getSelectedClassLabels();

    container.innerHTML = `
        <span class="conseils-expected-chip">Nom et Prenom du Professeur</span>
        <span class="conseils-expected-chip">Professeur principal (ex: 62, 6e2, 6 eme 2)</span>
        ${classes.map(label => `<span class="conseils-expected-chip">${formatClassChipHtml(label)}</span>`).join('')}
    `;
}

function renderImportedProfsPreview() {
    const wrap = document.getElementById('conseils-import-result');
    const count = document.getElementById('conseils-prof-count');
    const head = document.getElementById('conseils-import-head');
    const body = document.getElementById('conseils-import-body');
    if (!wrap || !count || !head || !body) return;

    if (!conseilsState.importedProfs.length) {
        wrap.classList.add('hidden');
        head.innerHTML = '';
        body.innerHTML = '';
        return;
    }

    const profCount = conseilsState.importedProfs.length;
    const profLabel = profCount > 1 ? 'professeurs importes' : 'professeur importe';
    count.textContent = `${profCount} ${profLabel} depuis ${conseilsState.importFileName || 'le fichier'}.`;
    head.innerHTML = `<tr><th>Professeur</th><th>Classes detectees</th><th>Classes principales</th></tr>`;
    body.innerHTML = conseilsState.importedProfs.map(prof => {
        const classesHtml = prof.classes.length
            ? `<div class="conseils-class-chip-wrap">${prof.classes.map(label => `<span class="conseils-class-chip">${formatClassChipHtml(label)}</span>`).join('')}</div>`
            : '<span class="conseils-class-chip muted">Aucune classe cochee</span>';
        const mainHtml = (prof.mainClasses || []).length
            ? `<div class="conseils-class-chip-wrap">${prof.mainClasses.map(label => `<span class="conseils-class-chip main">${formatClassChipHtml(label)}</span>`).join('')}</div>`
            : '<span class="conseils-class-chip muted">Aucune</span>';
        return `<tr><td>${escapeHtml(prof.name)}</td><td>${classesHtml}</td><td>${mainHtml}</td></tr>`;
    }).join('');
    wrap.classList.remove('hidden');
}

function renderManualTable() {
    const head = document.getElementById('conseils-manual-head');
    const body = document.getElementById('conseils-manual-body');
    const tableWrap = document.querySelector('#conseils-manual-block .conseils-manual-table-wrap');
    const emptyState = document.getElementById('conseils-manual-empty');
    const classes = getSelectedClassLabels();

    if (!head || !body) return;

    if (!conseilsState.manualProfs.length) {
        head.innerHTML = '';
        body.innerHTML = '';
        if (tableWrap) tableWrap.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (tableWrap) tableWrap.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');

    head.innerHTML = `
        <tr>
            <th>Nom et Prenom du Professeur</th>
            ${classes.map(label => `<th>${formatClassChipHtml(label)}</th>`).join('')}
            <th>Action</th>
        </tr>
    `;

    body.innerHTML = conseilsState.manualProfs.map((prof, index) => `
        <tr data-manual-index="${index}">
            <td><input type="text" class="conseils-manual-name" value="${escapeHtml(prof.name || '')}" placeholder="Nom prenom"></td>
            ${classes.map(label => {
                const checked = (prof.classes || []).includes(label) ? 'checked' : '';
                return `<td><input type="checkbox" class="conseils-manual-check" data-class-label="${escapeHtml(label)}" ${checked}></td>`;
            }).join('')}
            <td><button type="button" class="conseils-manual-remove">Supprimer</button></td>
        </tr>
    `).join('');

    body.querySelectorAll('.conseils-manual-name').forEach(input => {
        input.addEventListener('input', syncManualStateFromTable);
    });
    body.querySelectorAll('.conseils-manual-check').forEach(input => {
        input.addEventListener('change', syncManualStateFromTable);
    });
    body.querySelectorAll('.conseils-manual-remove').forEach(button => {
        button.addEventListener('click', function() {
            const row = this.closest('tr');
            const index = parseInt(row.dataset.manualIndex, 10);
            conseilsState.manualProfs.splice(index, 1);
            renderManualTable();
            syncManualStateFromTable();
        });
    });
}

function syncManualStateFromTable() {
    const rows = document.querySelectorAll('#conseils-manual-body tr[data-manual-index]');
    const classes = getSelectedClassLabels();

    conseilsState.manualProfs = Array.from(rows).map(row => {
        const name = normalizeCellValue(row.querySelector('.conseils-manual-name')?.value || '');
        const selectedClasses = classes.filter(label => {
            const checkbox = row.querySelector(`.conseils-manual-check[data-class-label="${label}"]`);
            return checkbox && checkbox.checked;
        });
        return { name, classes: selectedClasses };
    });

    conseilsState.importedProfs = assignProfIds(conseilsState.manualProfs.filter(prof => prof.name));
    conseilsState.importFileName = 'saisie manuelle';
    renderImportedProfsPreview();
    setError(4, '');
}

function addManualProfessorRow() {
    conseilsState.manualProfs.push({ name: '', classes: [] });
    renderManualTable();
}

function downloadTemplateWorkbook() {
    const classes = getSelectedClassLabels();
    const headers = ['Nom et Prenom du Professeur', 'Professeur principal (ex: 62, 6e2, 6 eme 2)'].concat(classes);
    const rows = [headers, ['Exemple Professeur', '62, 5e3', ...classes.map(() => 'X')]];

    if (typeof XLSX === 'undefined') {
        setError(4, 'Le generateur Excel n est pas disponible.');
        return;
    }

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Professeurs');
    XLSX.writeFile(workbook, 'modele_professeurs_conseils.xlsx');
    setError(4, '');
}

function exportCurrentConfigurationWorkbook() {
    if (typeof XLSX === 'undefined') {
        setError(6, 'Le generateur Excel n est pas disponible.');
        return;
    }

    const expectedClasses = getSelectedClassLabels();
    const sessionsConfigured = buildSessionTokensFromSchedule();

    const configRows = [
        ['Champ', 'Valeur'],
        ['Niveaux selectionnes', conseilsState.niveaux.join(', ') || 'Aucun'],
        ['Classes configurees', expectedClasses.join(', ') || 'Aucune'],
        ['Date debut', conseilsState.dateStart || ''],
        ['Date fin', conseilsState.dateEnd || ''],
        ['Dates retenues', conseilsState.selectedDates.join(', ') || 'Aucune'],
        ['Mode creneaux', conseilsState.useSpecificSlots ? 'Specifique par jour' : 'Identique chaque jour'],
        ['Nombre total de creneaux ouverts', String(sessionsConfigured.length)]
    ];

    const profRows = [
        ['Professeur', 'Classes', 'Classes principales', 'Contraintes']
    ];
    (conseilsState.importedProfs || []).forEach(prof => {
        const constraints = (conseilsState.profConstraintsById[prof.id] || [])
            .map(c => formatConstraintTagLabel(c))
            .join(' | ');

        profRows.push([
            normalizeCellValue(prof.name),
            (prof.classes || []).map(label => formatClassLabelCompact(label)).join(', '),
            (prof.mainClasses || []).map(label => formatClassLabelCompact(label)).join(', '),
            constraints
        ]);
    });

    const assignmentRows = [
        ['Classe', 'Statut', 'Date', 'Jour', 'Creneau', 'Professeurs', 'Alerte']
    ];

    expectedClasses.forEach(classLabel => {
        const token = conseilsState.resultsMap[classLabel];
        const compactClass = formatClassLabelCompact(classLabel);
        const profNames = getProfessorsForClass(classLabel)
            .map(prof => normalizeCellValue(prof.name))
            .filter(Boolean)
            .join(', ');

        if (!token) {
            assignmentRows.push([compactClass, 'Non affectee', '', '', '', profNames, '']);
            return;
        }

        const [dateIso, slotStr] = String(token).split('#');
        const slot = parseInt(slotStr, 10);
        const weekday = getWeekdayLabelFromIso(dateIso);
        const violations = checkConstraintViolationsForMove(classLabel, '__UNASSIGNED__', token);
        const hasConflict = violations.some(v => v.type === 'double_booking');
        const hasConstraintIssue = violations.some(v => v.type === 'constraint');
        const alert = hasConflict ? 'Conflit prof' : hasConstraintIssue ? 'Contrainte non respectee' : '';

        assignmentRows.push([
            compactClass,
            parseIsoDate(dateIso) && Number.isFinite(slot) ? 'Affectee' : 'Affectation non interpretee',
            parseIsoDate(dateIso) ? dateIso : String(token),
            parseIsoDate(dateIso) ? weekday : '',
            Number.isFinite(slot) ? String(slot) : '',
            profNames,
            alert
        ]);
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(assignmentRows), 'Affectations');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(profRows), 'Professeurs');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(configRows), 'Configuration');

    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    XLSX.writeFile(workbook, `configuration_conseils_${stamp}.xlsx`);
    setError(6, '');
}

function buildImportPanel() {
    renderExpectedColumns();
    renderManualTable();
    renderImportedProfsPreview();
}

function parseCsvLine(line, delimiter) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === delimiter && !inQuotes) {
            result.push(current);
            current = '';
            continue;
        }

        current += char;
    }

    result.push(current);
    return result;
}

function processCsvText(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (!lines.length) return [];

    const firstLine = lines[0];
    const delimiter = [';', ',', '\t'].reduce((best, candidate) => {
        const count = firstLine.split(candidate).length;
        return count > best.count ? { delimiter: candidate, count } : best;
    }, { delimiter: ';', count: 0 }).delimiter;

    return lines.map(line => parseCsvLine(line, delimiter));
}

function processImportedRows(rows, fileName) {
    const expectedClasses = getSelectedClassLabels();

    if (!rows.length || rows.length < 2) {
        throw new Error('Le fichier doit contenir une ligne d entete et au moins une ligne de donnees.');
    }

    const header = rows[0].map(normalizeCellValue);
    if (header.length < expectedClasses.length + 2) {
        throw new Error(`Le fichier doit contenir au moins ${expectedClasses.length + 2} colonnes.`);
    }

    const dataRows = rows.slice(1).map(row => row.map(normalizeCellValue));
    const columnMapping = detectImportColumns(header, dataRows, expectedClasses);

    if (columnMapping.nameCol === null || columnMapping.nameCol === undefined || columnMapping.nameCol < 0) {
        throw new Error('Impossible de detecter la colonne contenant les noms de professeurs.');
    }

    if (columnMapping.principalCol === null || columnMapping.principalCol === undefined || columnMapping.principalCol < 0) {
        throw new Error('Impossible de detecter la colonne des classes de professeur principal.');
    }

    const importedProfs = rows.slice(1)
        .map(row => {
            const cells = row.map(normalizeCellValue);
            const name = cells[columnMapping.nameCol] || '';
            if (!name) return null;

            const mainClasses = parsePrincipalClassesCell(cells[columnMapping.principalCol] || '', expectedClasses);

            const classes = expectedClasses.filter((classLabel, index) => {
                const classCol = columnMapping.classColumns[classLabel];
                if (classCol === undefined) return false;
                const cell = normalizeCellValue(cells[classCol] || '');
                return ['x', 'X', '1', 'oui', 'yes'].includes(cell.toLowerCase());
            });

            const mergedClasses = Array.from(new Set([...classes, ...mainClasses]));

            return { name, classes: mergedClasses, mainClasses };
        })
        .filter(Boolean);

    if (!importedProfs.length) {
        throw new Error('Aucun professeur exploitable n a ete detecte dans le fichier.');
    }

    conseilsState.importedProfs = assignProfIds(importedProfs);
    conseilsState.importFileName = fileName;
    conseilsState.manualProfs = [];
    setSourceMode('import');
    renderManualTable();
    renderImportedProfsPreview();
    setError(4, '');
}

function parseUploadedProfsFile(file) {
    const zone = document.getElementById('conseils-csv-zone');
    if (zone) {
        const label = zone.querySelector('p');
        if (label) {
            label.innerHTML = `<strong>${file.name}</strong> charge`;
        }
    }

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const isExcel = ext === 'xlsx' || ext === 'xls';
    const reader = new FileReader();

    reader.onload = function(event) {
        try {
            const bytes = new Uint8Array(event.target.result);
            let rows = [];

            if (isExcel) {
                if (typeof XLSX === 'undefined') {
                    throw new Error('Le lecteur Excel n est pas disponible.');
                }
                const workbook = XLSX.read(bytes, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false, defval: '' });
            } else {
                let text;
                try {
                    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
                } catch {
                    text = new TextDecoder('windows-1252').decode(bytes);
                }
                rows = processCsvText(text);
            }

            processImportedRows(rows, file.name);
        } catch (error) {
            console.error('[CONSEILS_IMPORT]', error);
            conseilsState.importedProfs = [];
            conseilsState.importFileName = '';
            renderImportedProfsPreview();
            setError(4, error.message || 'Import impossible.');
        }
    };

    reader.readAsArrayBuffer(file);
}

function validateCurrentStep() {
    if (conseilsStep === 1) {
        const niveaux = getSelectedNiveaux();
        if (!niveaux.length) {
            setError(1, 'Veuillez selectionner au moins un niveau.');
            return false;
        }

        conseilsState.niveaux = niveaux;
        setError(1, '');
        return true;
    }

    if (conseilsStep === 2) {
        const missing = conseilsState.niveaux.filter(niveau => !conseilsState.classesParNiveau[niveau]);
        if (missing.length) {
            setError(2, 'Veuillez renseigner le nombre de classes pour: ' + missing.join(', ') + '.');
            return false;
        }
        setError(2, '');
        return true;
    }

    if (conseilsStep === 3) {
        const startIso = conseilsState.dateStart;
        const endIso = conseilsState.dateEnd;
        const hasValidRange = !!startIso && !!endIso && parseIsoDate(startIso) && parseIsoDate(endIso) && parseIsoDate(startIso) <= parseIsoDate(endIso);
        const selectedDays = conseilsState.selectedDates.length;
        const slotCount = getSelectedSlotCount();
        const hasSpecific = conseilsState.useSpecificSlots;
        const hasValidSpecificValues = !hasSpecific || conseilsState.selectedDates.every(dateIso => {
            const v = conseilsState.specificSlotsByDate[dateIso];
            return Number.isFinite(v) && v >= 1;
        });
        if (!hasValidRange || !selectedDays || (!hasSpecific && !slotCount) || !hasValidSpecificValues) {
            setError(3, 'Veuillez definir un intervalle valide, selectionner au moins une date, puis choisir un nombre de creneaux par jour.');
            return false;
        }
        conseilsState.dateStart = startIso;
        conseilsState.dateEnd = endIso;
        if (!hasSpecific) {
            conseilsState.slotCount = slotCount;
        }
        renderScheduleSummary();
        setError(3, '');
        return true;
    }

    if (conseilsStep === 4) {
        if (conseilsState.sourceMode === 'import' && !conseilsState.importedProfs.length) {
            setError(4, 'Veuillez importer un fichier valide avec au moins un professeur.');
            return false;
        }
        setError(4, '');
        return true;
    }

    if (conseilsStep === 5) {
        setError(5, '');
        return true;
    }

    if (conseilsStep === 6) {
        setError(6, '');
        return true;
    }

    return true;
}

function goToStep(step) {
    conseilsStep = Math.max(1, Math.min(CONSEILS_MAX_STEPS, step));
    updateStepIndicators();
    updatePanels();
    updateNav();
}

document.addEventListener('DOMContentLoaded', function() {
    const nextBtn = document.getElementById('conseils-btn-next');
    const prevBtn = document.getElementById('conseils-btn-prev');
    const uploadZone = document.getElementById('conseils-csv-zone');
    const uploadInput = document.getElementById('conseils-csv-file');
    const importModeBtn = document.getElementById('conseils-open-import');
    const manualModeBtn = document.getElementById('conseils-open-manual');
    const downloadBtn = document.getElementById('conseils-download-template');
    const addProfBtn = document.getElementById('conseils-add-prof');
    const specificToggleBtn = document.getElementById('conseils-toggle-specific-slots');
    const constraintType = document.getElementById('conseils-constraint-type');
    const addConstraintBtn = document.getElementById('conseils-add-constraint');
    const addProfStep5Btn = document.getElementById('conseils-add-prof-step5');
    const removeProfStep5Btn = document.getElementById('conseils-remove-prof-step5');
    const editProfNameInput = document.getElementById('conseils-prof-edit-name');
    const runResultsBtn = document.getElementById('conseils-run-results');

    document.querySelectorAll('input[name="conseils_niveaux"]').forEach(input => {
        input.addEventListener('change', function() {
            resetScheduleData();
            resetProfessorData();
            setError(1, '');
        });
    });

    const startInput = document.getElementById('conseils-date-start');
    const endInput = document.getElementById('conseils-date-end');

    function attachDatePickerAutoOpen(input) {
        if (!input) return;

        const openPicker = function() {
            if (typeof input.showPicker === 'function') {
                try {
                    input.showPicker();
                } catch {
                    // Ignore browsers that block programmatic picker opening.
                }
            }
        };

        input.addEventListener('click', openPicker);
        input.addEventListener('focus', openPicker);
    }

    attachDatePickerAutoOpen(startInput);
    attachDatePickerAutoOpen(endInput);

    if (startInput) {
        startInput.addEventListener('change', function() {
            conseilsState.dateStart = this.value || '';
            renderAvailableDates();
            setError(3, '');
        });
    }
    if (endInput) {
        endInput.addEventListener('change', function() {
            conseilsState.dateEnd = this.value || '';
            renderAvailableDates();
            setError(3, '');
        });
    }

    document.querySelectorAll('input[name="conseils_slot_count"]').forEach(input => {
        input.addEventListener('change', function() {
            conseilsState.slotCount = parseInt(this.value, 10);
            if (conseilsState.useSpecificSlots) {
                syncSpecificSlotsMapWithSelectedDates();
                renderSpecificSlotsEditor();
            }
            renderScheduleSummary();
            setError(3, '');
        });
    });

    if (specificToggleBtn) {
        specificToggleBtn.addEventListener('click', function() {
            toggleSpecificSlots();
            setError(3, '');
        });
    }

    if (importModeBtn) {
        importModeBtn.addEventListener('click', function() {
            setSourceMode('import');
        });
    }

    if (manualModeBtn) {
        manualModeBtn.addEventListener('click', function() {
            setSourceMode('manual');
            renderManualTable();
        });
    }

    if (downloadBtn) {
        downloadBtn.addEventListener('click', function() {
            downloadTemplateWorkbook();
        });
    }

    if (addProfBtn) {
        addProfBtn.addEventListener('click', function() {
            setSourceMode('manual');
            addManualProfessorRow();
        });
    }

    if (constraintType) {
        constraintType.addEventListener('change', function() {
            renderConstraintFormFields();
            setError(5, '');
        });
    }

    if (addConstraintBtn) {
        addConstraintBtn.addEventListener('click', function() {
            addConstraintForSelectedProf();
        });
    }

    if (addProfStep5Btn) {
        addProfStep5Btn.addEventListener('click', function() {
            addProfessorFromStep5();
        });
    }

    if (removeProfStep5Btn) {
        removeProfStep5Btn.addEventListener('click', function() {
            removeSelectedProfessorFromStep5();
        });
    }

    if (editProfNameInput) {
        editProfNameInput.addEventListener('input', function() {
            const selectedProf = getSelectedConstraintProf();
            if (!selectedProf) return;
            selectedProf.name = this.value;
            syncManualProfsFromImported();
            if (conseilsState.sourceMode === 'manual') {
                renderManualTable();
            }
            renderImportedProfsPreview();
            renderConstraintEditorHeader();
            renderStep5ProfessorTable();
        });

        editProfNameInput.addEventListener('blur', function() {
            const selectedProf = getSelectedConstraintProf();
            if (!selectedProf) return;
            const cleanName = normalizeCellValue(this.value || '');
            if (!cleanName) {
                this.value = selectedProf.name || '';
                return;
            }
            selectedProf.name = cleanName;
            this.value = cleanName;
            syncManualProfsFromImported();
            if (conseilsState.sourceMode === 'manual') {
                renderManualTable();
            }
            renderImportedProfsPreview();
            renderConstraintEditorHeader();
            renderStep5ProfessorTable();
        });
    }

    if (runResultsBtn) {
        runResultsBtn.addEventListener('click', function() {
            runResultsComputation();
        });
    }

    window.addEventListener('resize', function() {
        adjustResultsChipPopovers();
    });

    if (nextBtn) {
        nextBtn.addEventListener('click', function() {
            if (!validateCurrentStep()) return;

            if (conseilsStep === 1) {
                buildClassesPanel();
                goToStep(2);
                return;
            }

            if (conseilsStep === 2) {
                resetProfessorData();
                renderScheduleSummary();
                goToStep(3);
                return;
            }

            if (conseilsStep === 3) {
                buildImportPanel();
                goToStep(4);
                return;
            }

            if (conseilsStep === 4) {
                buildConstraintsPanel();
                goToStep(5);
                return;
            }

            if (conseilsStep === 5) {
                goToStep(6);
                runResultsComputation();
                return;
            }

            if (conseilsStep === 6) {
                exportCurrentConfigurationWorkbook();
            }
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', function() {
            if (conseilsStep > 1) {
                goToStep(conseilsStep - 1);
                const btn = document.getElementById('conseils-btn-next');
                if (btn) {
                    btn.disabled = false;
                    updateNav();
                }
            }
        });
    }

    if (uploadZone && uploadInput) {
        let isOpeningFileDialog = false;

        uploadZone.addEventListener('click', function(event) {
            if (event.target === uploadInput || isOpeningFileDialog) return;
            isOpeningFileDialog = true;
            uploadInput.click();
            setTimeout(function() {
                isOpeningFileDialog = false;
            }, 0);
        });

        uploadInput.addEventListener('click', function(event) {
            event.stopPropagation();
        });

        uploadZone.addEventListener('dragover', function(event) {
            event.preventDefault();
            uploadZone.classList.add('drag-over');
        });

        uploadZone.addEventListener('dragleave', function() {
            uploadZone.classList.remove('drag-over');
        });

        uploadZone.addEventListener('drop', function(event) {
            event.preventDefault();
            uploadZone.classList.remove('drag-over');
            if (event.dataTransfer.files[0]) {
                parseUploadedProfsFile(event.dataTransfer.files[0]);
            }
        });

        uploadInput.addEventListener('change', function(event) {
            if (event.target.files[0]) {
                parseUploadedProfsFile(event.target.files[0]);
            }
        });
    }

    setSourceMode('import');
    renderAvailableDates();
    renderSpecificSlotsEditor();
    renderScheduleSummary();
    renderResultsTable();
    goToStep(1);
});
