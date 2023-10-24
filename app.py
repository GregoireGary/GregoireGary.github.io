from flask import Flask, render_template, request, jsonify
from static.traitement import resoudre_contraintes 
import json
import os

app = Flask(__name__, static_url_path='/static')

def load_data_from_json():
    try:
        # Obtenez le chemin absolu du répertoire de votre script
        script_dir = os.path.dirname(__file__)
        # Construisez le chemin complet vers votre fichier JSON en utilisant un chemin relatif
        json_file_path = os.path.join(script_dir, 'data', 'data.json')
        with open(json_file_path, 'r') as json_file:
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
    with open('/data/data.json', 'w') as json_file:
        json.dump(updated_data, json_file)

    # Répondre avec un message de succès
    return jsonify({'message': 'Données mises à jour avec succès!'})

@app.route('/trouver_creneau', methods=['POST'])
def trouver_creneau():
    # Récupérer les données du formulaire
    data = request.get_json()
    
        # Préparation des données

    # Dictionnaire pour stocker les classes avec les professeurs et leurs disponibilités
    classes = {}

    # Parcourir les données
    for professor in data:
        name = professor['name']
        classes_list = professor['classes']
        sessions_list = professor['sessions']
        
        # Associer les professeurs aux classes avec leurs disponibilités
        for class_number in classes_list:
            if class_number not in classes:
                classes[class_number] = {}
            classes[class_number][name] = sessions_list

    # Afficher le résultat

    print("***********************Lancement traitement************************")
    
    # Résoudre les contraintes
    assignations = resoudre_contraintes(classes)

    # Afficher les résultats
    print("Assignation des créneaux aux classes :")
    print(assignations)

    # Envoyer la réponse au client au format JSON
    return jsonify(assignations)

if __name__ == '__main__':
    app.run(debug=True)

