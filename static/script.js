// script.js
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

    // Ajoutez du contenu aux cellules (par exemple, des champs de formulaire)
    cell1.innerHTML = '<input type="text" name="professor_name[]">';
    cell2.innerHTML = '<select name="professor_subject[]"><option value="math">Math</option><option value="science">Science</option></select>';
    cell3.innerHTML = '<input type="checkbox" name="class_a[]">';
    cell4.innerHTML = '<input type="checkbox" name="class_b[]">';
    cell5.innerHTML = '<input type="checkbox" name="class_c[]">';
    cell6.innerHTML = '<input type="checkbox" name="monday_session_1[]">';
    cell7.innerHTML = '<input type="checkbox" name="monday_session_2[]">';

    // Ajoutez les cellules à la nouvelle ligne
    newRow.appendChild(cell1);
    newRow.appendChild(cell2);
    newRow.appendChild(cell3);
    newRow.appendChild(cell4);
    newRow.appendChild(cell5);
    newRow.appendChild(cell6);
    newRow.appendChild(cell7);

    // Ajoutez la nouvelle ligne au corps du tableau
    tableBody.appendChild(newRow);
}

// Associez la fonction `addRow` au clic du bouton "Ajouter un Professeur"
document.getElementById("addRowButton").addEventListener("click", addRow);

document.getElementById("availabilityForm").addEventListener("submit", function(event) {
    event.preventDefault();
    // Code JavaScript pour récupérer les données du formulaire et les envoyer au backend
    // ...

});