from flask import Flask, render_template, request

app = Flask(__name__, static_url_path='/static')


# Stockage des disponibilités des professeurs (c'est un exemple, vous pouvez utiliser une base de données)
professors_availability = []

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/submit', methods=['POST'])
def submit():
    # Récupérer les données du formulaire
    data = request.form.to_dict(flat=False)

    # Traiter les données et les ajouter à la liste professors_availability
    professors_availability.append(data)

    # Rediriger vers la page d'accueil ou afficher un message de confirmation
    return "Données enregistrées avec succès!"

if __name__ == '__main__':
    app.run(debug=True)
