from itertools import combinations
from collections import defaultdict
import random
import copy

# Fonction pour résoudre le problème d'attribution d'un créneau où tous les professeurs d'une classe sont libres
def resoudre_contraintesplus(disponibilites):
    
    # Créez un dictionnaire pour stocker les dates disponibles pour chaque classe
    disponibilites_classes = defaultdict(list)
    for classe, professeurs in disponibilites.items():
        dates_libres = set.intersection(*(set(dates) for dates in professeurs.values()))
        disponibilites_classes[classe] = list(dates_libres)

    # Trouvez un créneau où tous les professeurs d'une classe sont libres
    creneaux_attribues = {}
    for classe, dates_libres in disponibilites_classes.items():
        random.shuffle(dates_libres)

        for date in dates_libres:
            # Vérifiez si tous les professeurs de la classe sont disponibles à cette date
            professeurs_disponibles = [prof for prof, dates in disponibilites[classe].items() if date in dates]
            if len(professeurs_disponibles) == len(disponibilites[classe]):

                creneaux_attribues[classe] = date

                # Mettez à jour les disponibilités des professeurs en enlevant la date attribuée
                for prof in professeurs_disponibles:
                    disponibilites[classe][prof].remove(date)
                break

    return creneaux_attribues

# Fonction pour résoudre le problème d'attribution d'un créneau où tous les professeurs d'une classe sont libres
def resoudre_contraintes(disponibilites):

    disponibilites_tentative = {classe: professeurs.copy() for classe, professeurs in disponibilites.items()}
    
    # Nombre de tentatives pour trouver la meilleure combinaison
    nombre_tentatives = 1000
    meilleure_combinaison = None

    for _ in range(nombre_tentatives):

        # Obtenez une liste aléatoire des classes
        classes = list(disponibilites_tentative.keys())
        classes_random = random.sample(classes, len(classes))
        # Créez un nouvel objet disponibilites_random avec les classes dans un ordre aléatoire
        disponibilites_random = {classe: disponibilites_tentative[classe] for classe in classes_random}

        disponibilites_random_copy = copy.deepcopy(disponibilites_random)
        retourcrenaux = resoudre_contraintesplus(disponibilites_random_copy)
         
        # Vérifiez si c'est la meilleure combinaison trouvée jusqu'à présent
        if meilleure_combinaison is None or len(retourcrenaux) > len(meilleure_combinaison):
            meilleure_combinaison = retourcrenaux.copy()

    return meilleure_combinaison