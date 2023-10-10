from flask import Flask, render_template, request, jsonify
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

if __name__ == '__main__':
    app.run(debug=True)

