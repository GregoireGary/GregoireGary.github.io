from flask import Flask, render_template, request, jsonify
from ProfessorAvailability import ProfessorAvailability
from classes import Classe
import json

app = Flask(__name__, static_url_path='/static')

def load_data_from_json():
    try:
        with open('data/data.json', 'r') as json_file:
            data = json.load(json_file)
        return data
    except FileNotFoundError:
        # Si le fichier n'existe pas encore, retournez un dictionnaire vide
        return {}

# Charger les données au démarrage de l'application
loaded_data = load_data_from_json()

@app.route('/')
def index():
    return render_template('index.html', data=loaded_data)

@app.route('/update', methods=['POST'])
def update():
    global loaded_data
    updated_data = request.get_json()
    
    # Mettre à jour les données chargées avec les nouvelles données
    loaded_data = updated_data
    
    # Écrivez les données dans le fichier JSON
    with open('data/data.json', 'w') as json_file:
        json.dump(updated_data, json_file)

    # Répondre avec un message de succès
    return jsonify({'message': 'Données mises à jour avec succès!'})

@app.route('/trouver_creneau', methods=['POST'])
def trouver_creneau():
    # Récupérer les données du formulaire
    data = request.form.to_dict(flat=False)

        # Préparation des données

    # Supposons que 'data' contient les données du tableau rempli par l'utilisateur
    professors_availability_list = []
    
    # Boucle à travers les données et crée des objets ProfessorAvailability
    for professor_data in data:
        name = professor_data['professor_name'][0]  # Supposons que le nom est le premier élément de la liste
        subject = professor_data['professor_subject'][0]  # Supposons que la matière est le premier élément de la liste
        pp = professor_data['professor_PP'][0]  # Supposons que le professeur principal est le premier élément de la liste
        classes_data = professor_data['classes'][0]
        sessions_data = professor_data['sessions'][0]

        # Divisez les chaînes en valeurs individuelles
        classes_list = classes_data.split()  # Convertit la chaîne en liste de valeurs
        sessions_list = sessions_data.split()  # Convertit la chaîne en liste de valeurs

        professor_availability = ProfessorAvailability(name, subject, pp, classes_list, sessions_list)
        professors_availability_list.append(professor_availability)

    # Affichez la liste dans la console Python
    for professor_availability in professors_availability_list:
        print(f"Nom: {professor_availability.name}")
        print(f"Matière: {professor_availability.subject}")
        print(f"PP de la classe: {professor_availability.pp}")
        print(f"Classes: {professor_availability.classes}")
        print(f"Sessions: {professor_availability.sessions}")
        print("--------------------------")

    # Supposons que professors_availability_list est la liste d'objets ProfessorAvailability

    # Dictionnaire pour stocker les objets de classe
    classes = {}

    # Parcourir la liste des disponibilités des professeurs
    for professor_availability in professors_availability_list:
        # Parcourir la liste des classes auxquelles le professeur est associé
        for class_number in professor_availability.classes:
            # Vérifier si la classe existe déjà dans le dictionnaire
            if class_number not in classes:
                # Si non, créez un nouvel objet de classe avec le numéro de classe
                classes[class_number] = Classe(class_number)
            # Ajoutez le professeur à la classe correspondante
            classes[class_number].add_professor(professor_availability)

    # Affichez le contenu du dictionnaire 'classes' dans la console
    for class_number, classe_object in classes.items():
        print(f"Classe {class_number}:")
        for professor in classe_object.professors:
            print(f"    Professeur: {professor.name}, Matière: {professor.subject}")


    # Exemple de réponse avec un créneau trouvé (à adapter)
    creneau = {
        'date': '2023-11-01',
        'heure': '14:00',
        'salle': 'Salle 101'
    }

    # Envoyer la réponse au client au format JSON
    return jsonify(creneau)

if __name__ == '__main__':
    app.run(debug=True)

