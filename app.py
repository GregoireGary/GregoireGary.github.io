from flask import Flask, render_template, request, jsonify, send_file
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

@app.route('/upload', methods=['POST'])
def upload_file():
    data = request.json  # Recevez les données JSON envoyées depuis le client
    # Traitez les données comme vous le souhaitez
    print(data)  # Affiche les données dans le terminal pour vérification
    return jsonify({'status': 'success'})

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

# Route pour télécharger le modèle Excel
@app.route('/telecharger_modele')
def telecharger_modele():
    chemin_du_fichier = 'data/Modele.xlsx'
    return send_file(chemin_du_fichier, as_attachment=True, download_name='modele_import_professeurs.xlsx')

if __name__ == '__main__':
    app.run(debug=True)

