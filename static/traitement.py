from itertools import combinations
from collections import defaultdict
import random
import copy

# Fonction pour résoudre le problème d'attribution d'un créneau où tous les professeurs d'une classe sont libres
def resoudre_contraintesplus(disponibilites):
    print(disponibilites)
    # Créez un dictionnaire pour stocker les dates disponibles pour chaque classe
    disponibilites_classes = defaultdict(list)
    for classe, professeurs in disponibilites.items():
        dates_libres = set.intersection(*(set(dates) for dates in professeurs.values()))
        disponibilites_classes[classe] = list(dates_libres)
    
    print("*************disponibilites_classes")
    print(disponibilites_classes)

    # Trouvez un créneau où tous les professeurs d'une classe sont libres
    creneaux_attribues = {}
    for classe, dates_libres in disponibilites_classes.items():
        print("************************classes")
        print("************************" + classe)
        print(dates_libres)
        random.shuffle(dates_libres)

        for date in dates_libres:
            print("*************************************date")
            print("*************************************" + date)
            # Vérifiez si tous les professeurs de la classe sont disponibles à cette date
            professeurs_disponibles = [prof for prof, dates in disponibilites[classe].items() if date in dates]
            print("professeurs_disponibles")
            print(professeurs_disponibles)
            print(disponibilites[classe])
            print(str(len(professeurs_disponibles) == len(disponibilites[classe])))
            if len(professeurs_disponibles) == len(disponibilites[classe]):

                creneaux_attribues[classe] = date
                print("creneaux_attribues[classe]")
                print(creneaux_attribues)

                # Mettez à jour les disponibilités des professeurs en enlevant la date attribuée
                for prof in professeurs_disponibles:
                    print("On retire la dispo " + date + " au prof suivant: " + prof)
                    disponibilites[classe][prof].remove(date)
                
                # Mettez à jour les disponibilités pour les autres classes
                #for autre_classe, professeurs in disponibilites.items():
                #    if autre_classe != classe:
                #        professeurs_non_disponibles = [prof for prof, dates in professeurs.items() if date in dates]
                #        for prof_non_disponible in professeurs_non_disponibles:
                #            disponibilites[autre_classe][prof_non_disponible].remove(date)
                
                break

    return creneaux_attribues

# Fonction pour résoudre le problème d'attribution d'un créneau où tous les professeurs d'une classe sont libres
def resoudre_contraintes(disponibilites):

    disponibilites_tentative = {classe: professeurs.copy() for classe, professeurs in disponibilites.items()}
    
    # Nombre de tentatives pour trouver la meilleure combinaison
    nombre_tentatives = 3
    meilleure_combinaison = None

    for _ in range(nombre_tentatives):
        print("------------------ Tentative n°" + str(_))
        # Obtenez une liste aléatoire des classes
        classes = list(disponibilites_tentative.keys())
        classes_random = random.sample(classes, len(classes))
        print("classes_random")
        print(classes_random)
        # Créez un nouvel objet disponibilites_random avec les classes dans un ordre aléatoire
        disponibilites_random = {classe: disponibilites_tentative[classe] for classe in classes_random}
        print("disponibilites_random")

        disponibilites_random_copy = copy.deepcopy(disponibilites_random)
        retourcrenaux = resoudre_contraintesplus(disponibilites_random_copy)
        
        print("retourcrenaux")
        print(retourcrenaux)
         
        # Vérifiez si c'est la meilleure combinaison trouvée jusqu'à présent
        if meilleure_combinaison is None or len(retourcrenaux) > len(meilleure_combinaison):
            meilleure_combinaison = retourcrenaux.copy()

    return meilleure_combinaison