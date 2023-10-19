from itertools import combinations
from collections import defaultdict

# Fonction pour résoudre le problème d'attribution d'un créneau où tous les professeurs d'une classe sont libres
def resoudre_contraintes(disponibilites):
    # Créez un dictionnaire pour stocker les dates disponibles pour chaque classe
    disponibilites_classes = defaultdict(list)
    for classe, professeurs in disponibilites.items():
        dates_libres = set.intersection(*(set(dates) for dates in professeurs.values()))
        disponibilites_classes[classe] = list(dates_libres)

    # Trouvez un créneau où tous les professeurs d'une classe sont libres
    creneaux_attribues = {}
    for classe, dates_libres in disponibilites_classes.items():
        for date in dates_libres:
            # Vérifiez si tous les professeurs de la classe sont disponibles à cette date
            professeurs_disponibles = [prof for prof, dates in disponibilites[classe].items() if date in dates]
            if len(professeurs_disponibles) == len(disponibilites[classe]):
                creneaux_attribues[classe] = date
                break

    return creneaux_attribues
