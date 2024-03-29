
// Récupérez le corps du tableau où les lignes seront ajoutées
var tableBody = document.getElementById("professorsTableBody");

var popup = document.getElementById("popupContainer");

// Fonction pour ajouter une nouvelle ligne au tableau
function addRow() {
    // Créez une nouvelle ligne et des cellules
    var newRow = document.createElement("tr");
    var cell1 = document.createElement("td");
    var cell2 = document.createElement("td");
    var cell3 = document.createElement("td");
    var cell4 = document.createElement("td");
    var cell5 = document.createElement("td");
    var cell6 = document.createElement("td");
    var cell7 = document.createElement("td");
    var cell8 = document.createElement("td");
    var cell9 = document.createElement("td");
    var cell10 = document.createElement("td");
    var cell11 = document.createElement("td");
    var cell12 = document.createElement("td");
    var cell13 = document.createElement("td");
    var cell14 = document.createElement("td");
    var cell15 = document.createElement("td");
    var cell16 = document.createElement("td");
    var cell17 = document.createElement("td");
    var cell18 = document.createElement("td");
    var cell19 = document.createElement("td");
    var cell20 = document.createElement("td");
    var cell21 = document.createElement("td");
    var cell22 = document.createElement("td");
    var cell23 = document.createElement("td");
    var cell24 = document.createElement("td");
    var cell25 = document.createElement("td");
    var cell26 = document.createElement("td");
    var cell27 = document.createElement("td");
    var cell28 = document.createElement("td");


    // Ajoutez du contenu aux cellules (champs de formulaire, cases à cocher, etc.)
    cell1.innerHTML = '<input type="text" name="professor_name[]">';
    cell2.innerHTML = '<select name="professor_subject[]"><option value="math">Math</option><option value="frs">Frs</option><option value="SC">SC</option><option value="ang">ang</option><option value="HG">HG</option><option value="art">art</option><option value="EPS">EPS</option><option value="LV2">LV2</option></select>';
    cell3.innerHTML = '<select name="professor_PP[]"><option value="-">-</option><option value="61">61</option><option value="62">62</option><option value="63">63</option><option value="64">64</option><option value="51">51</option><option value="52">52</option><option value="53">53</option><option value="54">54</option><option value="41">41</option><option value="42">42</option><option value="43">43</option><option value="31">31</option><option value="32">32</option></select>';
    cell4.innerHTML = '<input type="checkbox" name="61[]">';
    cell5.innerHTML = '<input type="checkbox" name="62[]">';
    cell6.innerHTML = '<input type="checkbox" name="63[]">';
    cell7.innerHTML = '<input type="checkbox" name="64[]">';
    cell8.innerHTML = '<input type="checkbox" name="51[]">';
    cell9.innerHTML = '<input type="checkbox" name="52[]">';
    cell10.innerHTML = '<input type="checkbox" name="53[]">';
    cell11.innerHTML = '<input type="checkbox" name="54[]">';
    cell12.innerHTML = '<input type="checkbox" name="41[]">';
    cell13.innerHTML = '<input type="checkbox" name="42[]">';
    cell14.innerHTML = '<input type="checkbox" name="43[]">';
    cell15.innerHTML = '<input type="checkbox" name="31[]">';
    cell16.innerHTML = '<input type="checkbox" name="32[]">';
    cell17.innerHTML = '<input type="checkbox" name="S1L1[]">';
    cell18.innerHTML = '<input type="checkbox" name="S1L2[]">';
    cell19.innerHTML = '<input type="checkbox" name="S1M1[]">';
    cell20.innerHTML = '<input type="checkbox" name="S1M2[]">';
    cell21.innerHTML = '<input type="checkbox" name="S1J1[]">';
    cell22.innerHTML = '<input type="checkbox" name="S1J2[]">';
    cell23.innerHTML = '<input type="checkbox" name="S2L1[]">';
    cell24.innerHTML = '<input type="checkbox" name="S2L2[]">';
    cell25.innerHTML = '<input type="checkbox" name="S2M1[]">';
    cell26.innerHTML = '<input type="checkbox" name="S2M2[]">';
    cell27.innerHTML = '<input type="checkbox" name="S2J1[]">';
    cell28.innerHTML = '<input type="checkbox" name="S2J2[]">';

    var deleteButton = document.createElement("button");
    deleteButton.textContent = "x";
    deleteButton.className = "delete-button";
    deleteButton.addEventListener("click", function() {
        // Appellez la fonction pour supprimer la ligne lorsque le bouton est cliqué
        deleteRow(newRow);
    });

    // Ajoutez le bouton de suppression à une cellule de la ligne
    var deleteCell = document.createElement("td");
    deleteCell.appendChild(deleteButton);

    // Ajoutez les cellules à la nouvelle ligne
    newRow.appendChild(cell1);
    newRow.appendChild(cell2);
    newRow.appendChild(cell3);
    newRow.appendChild(cell4);
    newRow.appendChild(cell5);
    newRow.appendChild(cell6);
    newRow.appendChild(cell7);
    newRow.appendChild(cell8);
    newRow.appendChild(cell9);
    newRow.appendChild(cell10);
    newRow.appendChild(cell11);
    newRow.appendChild(cell12);
    newRow.appendChild(cell13);
    newRow.appendChild(cell14);
    newRow.appendChild(cell15);
    newRow.appendChild(cell16);
    newRow.appendChild(cell17);
    newRow.appendChild(cell18);
    newRow.appendChild(cell19);
    newRow.appendChild(cell20);
    newRow.appendChild(cell21);
    newRow.appendChild(cell22);
    newRow.appendChild(cell23);
    newRow.appendChild(cell24);
    newRow.appendChild(cell25);
    newRow.appendChild(cell26);
    newRow.appendChild(cell27);
    newRow.appendChild(cell28);

    // Ajoutez la cellule de suppression à la nouvelle ligne
    newRow.appendChild(deleteCell);

    // Ajoutez la nouvelle ligne au corps du tableau
    tableBody.appendChild(newRow);
}

// Fonction pour ajouter le bouton de suppression à une ligne existante
function addDeleteButtonToRow(row) {
    var deleteButton = document.createElement("button");
    deleteButton.textContent = "x";
    deleteButton.className = "delete-button";
    deleteButton.addEventListener("click", function() {
        // Appellez la fonction pour supprimer la ligne lorsque le bouton est cliqué
        deleteRow(row);
    });

    // Ajoutez le bouton de suppression à une cellule de la ligne
    var deleteCell = document.createElement("td");
    deleteCell.appendChild(deleteButton);

    // Ajoutez la cellule de suppression à la fin de la ligne existante
    row.appendChild(deleteCell);
}

// Sélectionnez toutes les lignes existantes dans le tableau
var existingRows = document.querySelectorAll("#professorsTableBody tr");

// Ajoutez le bouton de suppression à chaque ligne existante
existingRows.forEach(function(row) {
    addDeleteButtonToRow(row);
});

// Fonction pour supprimer une ligne
function deleteRow(row) {
    // Obtenez le tableau parent de la ligne
    var tableBody = row.parentNode;

    // Supprimez la ligne du tableau
    tableBody.removeChild(row);
}

// Associez la fonction `addRow` au clic du bouton "Ajouter un Professeur"
document.getElementById("addRowButton").addEventListener("click", addRow);

document.getElementById("Find").addEventListener("click", function(event) {
    event.preventDefault();

    // Récupérez toutes les lignes du tableau
    var rows = document.querySelectorAll("#professorsTableBody tr");
    
    // Créez un tableau pour stocker les objets JSON
    var jsonData = [];

    // Parcourez chaque ligne du tableau
    rows.forEach(function(row) {
        // Récupérez les éléments de la ligne
        var name = row.querySelector("[name='professor_name[]']").value;
        var subject = row.querySelector("[name='professor_subject[]']").value;
        var PP = row.querySelector("[name='professor_PP[]']").value;

        // Créez un objet pour stocker les classes et sessions
        var classes = [];
        var sessions = [];

        // Ajoutez les valeurs des cases à cocher de classe (61,62, etc.)
        ["61", "62", "63", "64", "51", "52", "53", "54", "41", "42", "43", "31", "32"].forEach(function(classe) {
            var classeCheckbox = row.querySelector("[name='" + classe + "[]']");
            if (classeCheckbox.checked) {
                classes.push(classe);
            }
        });
        // Ajoutez les valeurs des cases à cocher de session (L1, L2, etc.)
        ["S1L1", "S1L2", "S1M1", "S1M2", "S1J1", "S1J2", "S2L1", "S2L2", "S2M1", "S2M2", "S2J1", "S2J2"].forEach(function(session) {
            var sessionCheckbox = row.querySelector("[name='" + session + "[]']");
            if (sessionCheckbox.checked) {
                sessions.push(session);
            }
        });

        // Créez un objet JSON pour cette ligne
        var jsonRow = {
            name: name,
            subject: subject,
            PP: PP,
            classes: classes,
            sessions: sessions
        };

        // Ajoutez l'objet JSON au tableau
        jsonData.push(jsonRow);
    });

    // Effectuez une requête POST vers la route /trouver_creneau avec les données du formulaire
    fetch('/trouver_creneau', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json' // Indiquez que vous envoyez du JSON
        },
        body: JSON.stringify(jsonData) // Convertissez le tableau d'objets JavaScript en chaîne JSON
    })
    .then(response => response.json())
    .then(data => {
        // Traitez la réponse JSON (les créneaux trouvés) ici
        console.log(data)

        var classes = ["31", "32", "41", "42", "43", "51", "52", "53", "54", "61", "62", "63", "64"];
        // Liste des classes non trouvées
        var classesNonTrouvees = [];

        // Associez les données aux identifiants des cellules du tableau
        classes.forEach(function(classe) {
            var cellId = "R" + data[classe];
            var cell = document.getElementById(cellId);
            if (cell) {
                // Vérifiez si un créneau a été trouvé pour cette classe
                if (data.hasOwnProperty(classe)) {
                    // Vérifiez s'il y a déjà une valeur dans la cellule
                    if (cell.textContent.trim() !== "") {
                        // S'il y a déjà une valeur, ajoutez une virgule avant la nouvelle valeur
                        cell.textContent += ", " + classe;
                    } else {
                        // Sinon, ajoutez simplement la nouvelle valeur
                        cell.textContent = classe;
                    }
                } 
            }
            else {
                // Si aucun créneau n'a été trouvé, ajoutez la classe à la liste des classes non trouvées
                classesNonTrouvees.push(classe);
            }
        });

        // Affichez la liste des créneaux non trouvés
        var listeCreneauxNonTrouves = document.getElementById("creneauxNonTrouves");
        var message = "Aucun créneau trouvé pour les classes suivantes : ";

        if (classesNonTrouvees.length > 0) {
            // S'il y a des classes non trouvées, créez le message
            message += classesNonTrouvees.join(", ");
        } else {
            // Sinon, affichez un message par défaut
            message = "Tous les créneaux ont été attribués.";
        }

        var listItem = document.createElement("p");
        listItem.textContent = message;
        listeCreneauxNonTrouves.appendChild(listItem);

        popup.style.display = "block";

        // Ajoutez un gestionnaire d'événements pour le bouton "Fermer" du popup
        var closeButton = document.getElementById("closePopupButton");
        closeButton.addEventListener("click", function() {
            // Réinitialisez le contenu des cellules du tableau
        var cells = document.querySelectorAll(".creneau-result");
        cells.forEach(function(cell) {
            cell.textContent = "";
        });

        listeCreneauxNonTrouves.innerHTML = "";
            // Fermez le popup lorsque le bouton "Fermer" est cliqué
            popup.style.display = "none";
        });
    })
    .catch(error => {
        // Gérez les erreurs ici
        console.error(error);
    });
});

document.getElementById("availabilityForm").addEventListener("submit", function(event) {
    event.preventDefault();

    // Récupérer toutes les lignes du tableau
    var rows = document.querySelectorAll("#professorsTableBody tr");

    // Initialiser un tableau pour stocker les données mises à jour
    var updatedData = [];

    // Parcourir chaque ligne et mettre à jour l'objet `data`
    rows.forEach(function(row) {
        var professorName = row.querySelector('input[name="professor_name[]"]').value;
        var professorSubject = row.querySelector('select[name="professor_subject[]"]').value;
        var professorPP = row.querySelector('select[name="professor_PP[]"]').value;
        // Récupérer d'autres valeurs de champ ici...

        var c61 = row.querySelector('input[name="61[]"]').checked;
        var c62 = row.querySelector('input[name="62[]"]').checked;
        var c63 = row.querySelector('input[name="63[]"]').checked;
        var c64 = row.querySelector('input[name="64[]"]').checked;
        var c51 = row.querySelector('input[name="51[]"]').checked;
        var c52 = row.querySelector('input[name="52[]"]').checked;
        var c53 = row.querySelector('input[name="53[]"]').checked;
        var c54 = row.querySelector('input[name="54[]"]').checked;
        var c41 = row.querySelector('input[name="41[]"]').checked;
        var c42 = row.querySelector('input[name="42[]"]').checked;
        var c43 = row.querySelector('input[name="43[]"]').checked;
        var c31 = row.querySelector('input[name="31[]"]').checked;
        var c32 = row.querySelector('input[name="32[]"]').checked;
        var S1L1 = row.querySelector('input[name="S1L1[]"]').checked;
        var S1L2 = row.querySelector('input[name="S1L2[]"]').checked;
        var S1M1 = row.querySelector('input[name="S1M1[]"]').checked;
        var S1M2 = row.querySelector('input[name="S1M2[]"]').checked;
        var S1J1 = row.querySelector('input[name="S1J1[]"]').checked;
        var S1J2 = row.querySelector('input[name="S1J2[]"]').checked;
        var S2L1 = row.querySelector('input[name="S2L1[]"]').checked;
        var S2L2 = row.querySelector('input[name="S2L2[]"]').checked;
        var S2M1 = row.querySelector('input[name="S2M1[]"]').checked;
        var S2M2 = row.querySelector('input[name="S2M2[]"]').checked;
        var S2J1 = row.querySelector('input[name="S2J1[]"]').checked;
        var S2J2 = row.querySelector('input[name="S2J2[]"]').checked;

        var updatedProfessor = {
            name: professorName,
            subject: professorSubject,
            PP: professorPP,
            c61: c61,
            c62: c62,
            c63: c63,
            c64: c64,
            c51: c51,
            c52: c52,
            c53: c53,
            c54: c54,
            c41: c41,
            c42: c42,
            c43: c43,
            c31: c31,
            c32: c32,            
            S1L1: S1L1,
            S1L2: S1L2,
            S1M1: S1M1,
            S1M2: S1M2,
            S1J1: S1J1,
            S1J2: S1J2,
            S2L1: S2L1,
            S2L2: S2L2,
            S2M1: S2M1,
            S2M2: S2M2,
            S2J1: S2J1,
            S2J2: S2J2,
        };

        // Ajouter le professeur mis à jour au tableau `updatedData`
        updatedData.push(updatedProfessor);
    });

    // Mettre à jour l'objet `data` avec les nouvelles données
    var data = { professors: updatedData };

    // Envoyer l'objet `data` au backend via une requête AJAX
    fetch('/update', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(function(response) {
        // Gérer la réponse du serveur ici (par exemple, afficher un message de succès)
        console.log(data)
        console.log('Données mises à jour avec succès !');
        // Appeler la fonction d'affichage du popupsavesave après l'enregistrement des données
        showPopup();
    })
    .catch(function(error) {
        // Gérer les erreurs de la requête ici
        console.error('Erreur lors de la mise à jour des données :', error);
    });
});

// Affiche le popupsave
function showPopup() {
    var popupsave = document.getElementById("myPopup");
    popupsave.style.display = "block";

    // Ferme le popupsave après 3 secondes
    setTimeout(function() {
        popupsave.style.display = "none";
    }, 2000);
}

