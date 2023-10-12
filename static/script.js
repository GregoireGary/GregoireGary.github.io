
// Récupérez le corps du tableau où les lignes seront ajoutées
var tableBody = document.getElementById("professorsTableBody");

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
    cell17.innerHTML = '<input type="checkbox" name="L1[]">';
    cell18.innerHTML = '<input type="checkbox" name="L2[]">';
    cell19.innerHTML = '<input type="checkbox" name="M1[]">';
    cell20.innerHTML = '<input type="checkbox" name="M2[]">';
    cell21.innerHTML = '<input type="checkbox" name="J1[]">';
    cell22.innerHTML = '<input type="checkbox" name="J2[]">';

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

// Récupérez le formulaire et ajoutez un gestionnaire d'événement pour le soumettre
document.getElementById("Find").addEventListener("click", function(event) {
    event.preventDefault();

    // Effectuez une requête POST vers la route /trouver_creneau avec les données du formulaire
    fetch('/trouver_creneau', {
        method: 'POST',
        body: new FormData(document.getElementById("availabilityForm")),
    })
    .then(response => response.json())
    .then(data => {
        // Traitez la réponse JSON (les créneaux trouvés) ici
        console.log(data);
        // Mettez à jour l'interface utilisateur en conséquence
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
        var L1 = row.querySelector('input[name="L1[]"]').checked;
        var L2 = row.querySelector('input[name="L2[]"]').checked;
        var M1 = row.querySelector('input[name="M1[]"]').checked;
        var M2 = row.querySelector('input[name="M2[]"]').checked;
        var J1 = row.querySelector('input[name="J1[]"]').checked;
        var J2 = row.querySelector('input[name="J2[]"]').checked;

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
            L1: L1,
            L2: L2,
            M1: M1,
            M2: M2,
            J1: J1,
            J2: J2
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
        console.log('Données mises à jour avec succès !');
    })
    .catch(function(error) {
        // Gérer les erreurs de la requête ici
        console.error('Erreur lors de la mise à jour des données :', error);
    });
});
