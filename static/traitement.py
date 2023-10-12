from scipy.optimize import linear_sum_assignment

# Classes avec les professeurs associés et leurs indisponibilités
classes = {
    61: {'Prof1': ['L1', 'L2'], 'Prof2': ['M1']},
    62: {'Prof3': ['J1'], 'Prof4': []},
    # Ajoutez d'autres classes avec les professeurs associés et leurs indisponibilités
}

# Créneaux disponibles
creneaux = ['L1', 'L2', 'M1', 'M2', 'J1', 'J2']

# Fonction pour résoudre le problème d'attribution des créneaux aux classes
def resoudre_contraintes(classes, creneaux):
    couts = []
    for _, professeurs in classes.items():
        cout_ligne = []
        for creneau in creneaux:
            # Coût élevé si le créneau est une indisponibilité pour le professeur
            cout_ligne.append(-1 if any(creneau in indispos for indispos in professeurs.values()) else 0)
        couts.append(cout_ligne)

    couts = [[-c for c in ligne] for ligne in couts]  # L'algorithme hongrois minimise, donc nous changeons les signes

    lignes, colonnes = linear_sum_assignment(couts)

    assignations = {}
    for i, classe in enumerate(classes.keys()):
        creneau_attribue = creneaux[colonnes[i]]
        assignations[classe] = creneau_attribue

    return assignations

# Résoudre les contraintes
assignations = resoudre_contraintes(classes, creneaux)

# Afficher les résultats
print("Assignation des créneaux aux classes :")
for classe, creneau in assignations.items():
    print(f"Classe {classe} : Créneau {creneau}")
