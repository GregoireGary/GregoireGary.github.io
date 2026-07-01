var tableBody = document.getElementById("professorsTableBody");
var popup = document.getElementById("popupContainer");
var statusMessage = document.getElementById("statusMessage");

var CLASS_KEYS = ["61", "62", "63", "64", "51", "52", "53", "54", "41", "42", "43", "44", "31", "32", "33", "34"];
var SESSION_KEYS = ["S1L1", "S1L2", "S1M1", "S1M2", "S1J1", "S1J2", "S2L1", "S2L2", "S2M1", "S2M2", "S2J1", "S2J2"];
var SUBJECT_OPTIONS = ["math", "frs", "SC", "ang", "HG", "art", "EPS", "LV2"];

function setStatus(message, type) {
    if (!statusMessage) return;
    statusMessage.textContent = message || "";
    statusMessage.className = "status-message" + (type ? " status-" + type : "");
}

function getCheckedValues(row, keys) {
    return keys.filter(function(key) {
        var checkbox = row.querySelector("input[name='" + key + "[]']");
        return checkbox && checkbox.checked;
    });
}

function isRowEmpty(row) {
    var name = row.querySelector("[name='professor_name[]']").value.trim();
    var classes = getCheckedValues(row, CLASS_KEYS);
    var sessions = getCheckedValues(row, SESSION_KEYS);
    return !name && classes.length === 0 && sessions.length === 0;
}

function addDeleteButtonToRow(row) {
    var deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "x";
    deleteButton.className = "delete-button";
    deleteButton.addEventListener("click", function() {
        deleteRow(row);
    });

    var deleteCell = document.createElement("td");
    deleteCell.appendChild(deleteButton);
    row.appendChild(deleteCell);
}

function deleteRow(row) {
    var body = row.parentNode;
    body.removeChild(row);
}

function buildSubjectSelect(selectedValue) {
    var normalized = String(selectedValue || "math");
    var html = "<select name=\"professor_subject[]\">";
    SUBJECT_OPTIONS.forEach(function(subject) {
        var selected = normalized === subject ? " selected" : "";
        html += "<option value=\"" + subject + "\"" + selected + ">" + subject + "</option>";
    });
    html += "</select>";
    return html;
}

function buildPPSelect(selectedValue) {
    var normalized = String(selectedValue || "-");
    var values = ["-"].concat(CLASS_KEYS);
    var html = "<select name=\"professor_PP[]\">";
    values.forEach(function(pp) {
        var selected = normalized === pp ? " selected" : "";
        html += "<option value=\"" + pp + "\"" + selected + ">" + pp + "</option>";
    });
    html += "</select>";
    return html;
}

function addRow() {
    var newRow = document.createElement("tr");
    newRow.innerHTML = "<td><input type=\"text\" name=\"professor_name[]\"></td>" +
        "<td>" + buildSubjectSelect("math") + "</td>" +
        "<td>" + buildPPSelect("-") + "</td>";

    CLASS_KEYS.forEach(function(classe) {
        newRow.innerHTML += "<td><input type=\"checkbox\" name=\"" + classe + "[]\"></td>";
    });

    SESSION_KEYS.forEach(function(session) {
        newRow.innerHTML += "<td><input type=\"checkbox\" name=\"" + session + "[]\"></td>";
    });

    addDeleteButtonToRow(newRow);
    tableBody.appendChild(newRow);
}

function clearResultsDisplay() {
    var cells = document.querySelectorAll(".creneau-result");
    cells.forEach(function(cell) {
        cell.textContent = "";
    });

    var notFound = document.getElementById("creneauxNonTrouves");
    if (notFound) {
        notFound.innerHTML = "";
    }
}

function collectCalculationPayload() {
    var rows = document.querySelectorAll("#professorsTableBody tr");
    var payload = [];
    var issues = [];
    var selectedClassesMap = {};

    rows.forEach(function(row, idx) {
        if (isRowEmpty(row)) {
            return;
        }

        var name = row.querySelector("[name='professor_name[]']").value.trim();
        var subject = row.querySelector("[name='professor_subject[]']").value;
        var PP = row.querySelector("[name='professor_PP[]']").value;
        var classes = getCheckedValues(row, CLASS_KEYS);
        var sessions = getCheckedValues(row, SESSION_KEYS);

        if (!name) {
            issues.push("Ligne " + (idx + 1) + ": nom manquant.");
        }
        if (!classes.length) {
            issues.push("Ligne " + (idx + 1) + " (" + (name || "sans nom") + "): aucune classe cochée.");
        }
        if (!sessions.length) {
            issues.push("Ligne " + (idx + 1) + " (" + (name || "sans nom") + "): aucune disponibilité cochée.");
        }

        classes.forEach(function(c) {
            selectedClassesMap[c] = true;
        });

        payload.push({
            name: name,
            subject: subject,
            PP: PP,
            classes: classes,
            sessions: sessions
        });
    });

    return {
        payload: payload,
        issues: issues,
        selectedClasses: Object.keys(selectedClassesMap)
    };
}

function displayAssignments(data, selectedClasses) {
    clearResultsDisplay();

    var classesNonTrouvees = [];
    var warning = data._warning;
    delete data._warning;

    selectedClasses.forEach(function(classe) {
        if (!Object.prototype.hasOwnProperty.call(data, classe)) {
            classesNonTrouvees.push(classe);
            return;
        }

        var slot = data[classe];
        var cell = document.getElementById("R" + slot);
        if (!cell) {
            classesNonTrouvees.push(classe);
            return;
        }

        if (cell.textContent.trim() !== "") {
            cell.textContent += ", " + classe;
        } else {
            cell.textContent = classe;
        }
    });

    var listeCreneauxNonTrouves = document.getElementById("creneauxNonTrouves");
    var message = "Tous les créneaux ont été attribués.";

    if (classesNonTrouvees.length > 0) {
        message = "Aucun créneau trouvé pour les classes suivantes : " + classesNonTrouvees.join(", ");
    }
    if (warning) {
        message += " " + warning;
    }

    var listItem = document.createElement("p");
    listItem.textContent = message;
    listeCreneauxNonTrouves.appendChild(listItem);

    popup.style.display = "block";
}

async function launchCalculation(event) {
    event.preventDefault();

    var button = document.getElementById("Find");
    var result = collectCalculationPayload();

    if (!result.payload.length) {
        setStatus("Aucune donnée exploitable: ajoute au moins une ligne de professeur.", "error");
        return;
    }

    if (result.issues.length) {
        setStatus("Vérifie les données avant calcul: " + result.issues.join(" "), "error");
        return;
    }

    button.disabled = true;
    setStatus("Calcul en cours...", "info");

    try {
        var response = await fetch("/trouver_creneau", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(result.payload)
        });

        var data = await response.json();

        if (!response.ok) {
            setStatus((data && data.error) || "Erreur serveur pendant le calcul.", "error");
            return;
        }

        displayAssignments(data, result.selectedClasses);
        setStatus("Calcul terminé.", "success");
    } catch (error) {
        console.error(error);
        setStatus("Erreur réseau pendant le calcul.", "error");
    } finally {
        button.disabled = false;
    }
}

async function saveData(event) {
    event.preventDefault();

    var rows = document.querySelectorAll("#professorsTableBody tr");
    var updatedData = [];

    rows.forEach(function(row) {
        if (isRowEmpty(row)) {
            return;
        }

        var updatedProfessor = {
            name: row.querySelector('input[name="professor_name[]"]').value.trim(),
            subject: row.querySelector('select[name="professor_subject[]"]').value,
            PP: row.querySelector('select[name="professor_PP[]"]').value
        };

        CLASS_KEYS.forEach(function(classe) {
            updatedProfessor["c" + classe] = row.querySelector('input[name="' + classe + '[]"]').checked;
        });

        SESSION_KEYS.forEach(function(session) {
            updatedProfessor[session] = row.querySelector('input[name="' + session + '[]"]').checked;
        });

        updatedData.push(updatedProfessor);
    });

    try {
        var response = await fetch("/update", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ professors: updatedData })
        });

        var data = await response.json();

        if (!response.ok) {
            setStatus((data && data.error) || "Échec de sauvegarde.", "error");
            return;
        }

        showPopup();
        setStatus("Sauvegarde effectuée (" + (data.count || updatedData.length) + " professeurs).", "success");
    } catch (error) {
        console.error("Erreur lors de la mise à jour des données :", error);
        setStatus("Erreur réseau pendant la sauvegarde.", "error");
    }
}

function showPopup() {
    var popupsave = document.getElementById("myPopup");
    popupsave.style.display = "block";

    setTimeout(function() {
        popupsave.style.display = "none";
    }, 2000);
}

function updateTable(data) {
    var body = document.getElementById("professorsTableBody");
    body.innerHTML = "";

    for (var i = 1; i < data.length; i++) {
        var row = data[i] || [];
        var tr = document.createElement("tr");

        tr.innerHTML += "<td><input type=\"text\" name=\"professor_name[]\" value=\"" + (row[0] || "") + "\"></td>";
        tr.innerHTML += "<td>" + buildSubjectSelect(row[1]) + "</td>";
        tr.innerHTML += "<td>" + buildPPSelect(row[2]) + "</td>";

        for (var c = 0; c < CLASS_KEYS.length; c++) {
            tr.innerHTML += "<td><input type=\"checkbox\" name=\"" + CLASS_KEYS[c] + "[]\" " + (String(row[3 + c] || "").toUpperCase() === "X" ? "checked" : "") + "></td>";
        }

        for (var s = 0; s < SESSION_KEYS.length; s++) {
            tr.innerHTML += "<td><input type=\"checkbox\" name=\"" + SESSION_KEYS[s] + "[]\" " + (String(row[19 + s] || "").toUpperCase() === "X" ? "checked" : "") + "></td>";
        }

        body.appendChild(tr);
        addDeleteButtonToRow(tr);
    }

    setStatus("Import terminé.", "success");
}

function handleFileSelect(event) {
    var file = event.target.files[0];
    if (!file) {
        setStatus("Aucun fichier sélectionné.", "error");
        return;
    }

    var reader = new FileReader();

    reader.onload = function(loadEvent) {
        try {
            var data = new Uint8Array(loadEvent.target.result);
            var workbook = XLSX.read(data, { type: "array" });
            var worksheet = workbook.Sheets[workbook.SheetNames[0]];
            var json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            updateTable(json);
        } catch (error) {
            console.error("Erreur de lecture du fichier :", error);
            setStatus("Le fichier Excel n'a pas pu être lu.", "error");
        }
    };

    reader.readAsArrayBuffer(file);
}

var existingRows = document.querySelectorAll("#professorsTableBody tr");
existingRows.forEach(function(row) {
    addDeleteButtonToRow(row);
});

var closeButton = document.getElementById("closePopupButton");
if (closeButton) {
    closeButton.addEventListener("click", function() {
        clearResultsDisplay();
        popup.style.display = "none";
    });
}

document.getElementById("addRowButton").addEventListener("click", addRow);
document.getElementById("Find").addEventListener("click", launchCalculation);
document.getElementById("availabilityForm").addEventListener("submit", saveData);

document.addEventListener("DOMContentLoaded", function() {
    var fileInput = document.getElementById("file-upload");
    if (fileInput) {
        fileInput.addEventListener("change", handleFileSelect);
    }

    var importButton = document.querySelector(".import-button button");
    if (importButton) {
        importButton.addEventListener("click", function() {
            document.getElementById("file-upload").click();
        });
    }
});
