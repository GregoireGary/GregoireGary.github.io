class ProfessorAvailability:
    def __init__(self, name, subject, pp, classes, sessions):
        self.name = name
        self.subject = subject
        self.pp = pp
        self.classes = classes  # Liste des classes auxquelles le professeur est associé (par exemple, ['61', '62'])
        self.sessions = sessions  # Liste des sessions auxquelles le professeur est disponible (par exemple, ['L1', 'M1'])

    def __repr__(self):
        return f"ProfessorAvailability(name={self.name}, subject={self.subject}, pp={self.pp}, classes={self.classes}, sessions={self.sessions})"
