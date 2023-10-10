class Professeur:
    def __init__(self, nom, indisponibilites):
        self.nom = nom
        self.indisponibilites = indisponibilites

    # Méthodes pour gérer les indisponibilités, par exemple, ajouter, supprimer, vérifier.

professeurs = {
    "professeur1": Professeur("Professeur 1", ["lundi", "mardi"]),
    "professeur2": Professeur("Professeur 2", ["mercredi", "jeudi"]),
    # ...
}
