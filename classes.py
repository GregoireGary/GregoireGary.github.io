class Classe:
    def __init__(self, class_number):
        self.class_number = class_number
        self.professors = []  # Liste pour stocker les professeurs associés à cette classe

    def add_professor(self, professor_availability):
        self.professors.append(professor_availability)

# Maintenant, 'classes' est un dictionnaire où les clés sont les numéros de classe
# et les valeurs sont les objets de classe correspondants avec les professeurs associés.
