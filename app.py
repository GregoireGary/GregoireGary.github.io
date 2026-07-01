from flask import Flask, render_template, request, jsonify, send_file
from static.traitement import resoudre_contraintes
import json
import os
import random
import smtplib
from io import BytesIO
from datetime import datetime
from email.message import EmailMessage

app = Flask(__name__, static_url_path='/static')

def get_data_file_path():
    script_dir = os.path.dirname(__file__)
    return os.path.join(script_dir, 'data', 'data.json')

def load_data_from_json():
    try:
        json_file_path = get_data_file_path()
        with open(json_file_path, 'r') as json_file:
            data = json.load(json_file)
        return data
    except FileNotFoundError:
        # Si le fichier n'existe pas encore, retournez un dictionnaire vide
        return {}

# Charger les données au démarrage de l'application
loaded_data = load_data_from_json()

@app.route('/')
def home():
    return render_template('accueil.html')


@app.route('/feedback', methods=['POST'])
def send_feedback():
    payload = request.get_json() or {}
    sender_name = (payload.get('name') or '').strip()
    sender_email = (payload.get('email') or '').strip()
    message = (payload.get('message') or '').strip()

    if len(message) < 5:
        return jsonify({'error': 'Le message est trop court.'}), 400

    smtp_host = os.getenv('FEEDBACK_SMTP_HOST', 'smtp.gmail.com')
    smtp_port = int(os.getenv('FEEDBACK_SMTP_PORT', '587'))
    smtp_user = os.getenv('FEEDBACK_SMTP_USER', '').strip()
    smtp_password = os.getenv('FEEDBACK_SMTP_PASSWORD', '').strip()
    mail_to = os.getenv('FEEDBACK_TO', 'gregoire.gary8@gmail.com').strip()
    mail_from = os.getenv('FEEDBACK_FROM', smtp_user or 'no-reply@outil-scolarite.local').strip()

    if not smtp_user or not smtp_password:
        return jsonify({
            'error': 'Configuration SMTP manquante. Définis FEEDBACK_SMTP_USER et FEEDBACK_SMTP_PASSWORD côté serveur.'
        }), 500

    subject = '[Outil Conseils] Nouvelle idee/recommandation'
    lines = [
        'Nouvelle suggestion envoyee depuis la page d accueil.',
        '',
        f'Nom: {sender_name or "Non renseigne"}',
        f'Email: {sender_email or "Non renseigne"}',
        '',
        'Message:',
        message,
    ]

    email_message = EmailMessage()
    email_message['Subject'] = subject
    email_message['From'] = mail_from
    email_message['To'] = mail_to
    email_message.set_content('\n'.join(lines))

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(email_message)
    except Exception:
        return jsonify({'error': "L'envoi de l'email a echoue. Verifie la configuration SMTP."}), 500

    return jsonify({'status': 'success'})

@app.route('/conseils-de-classe')
def conseils_de_classe():
    return render_template('index.html', data=loaded_data)

@app.route('/creation-classe')
def creation_classe():
    return render_template('creation_classe.html')

@app.route('/creation-classe/repartir', methods=['POST'])
def repartir_eleves():
    soft_overflow = 2  # marge autorisée au-dessus du max par classe quand nécessaire

    data = request.get_json() or {}
    niveau = data.get('niveau', '').strip()
    nb_classes = int(data.get('nb_classes', 1))
    eleves = [e.strip() for e in data.get('eleves', []) if e.strip()]
    pre_assignations = data.get('pre_assignations', {})
    contraintes = data.get('contraintes', {}) or {}
    global_constraints = data.get('global_constraints', {}) or {}

    max_per_class = global_constraints.get('max_per_class')
    min_same_school = global_constraints.get('min_same_school')
    mixity_min = global_constraints.get('mixity_min')

    try:
        max_per_class = int(max_per_class) if max_per_class is not None else None
    except (ValueError, TypeError):
        return jsonify({'error': 'max_per_class invalide'}), 400

    try:
        min_same_school = int(min_same_school) if min_same_school is not None else None
    except (ValueError, TypeError):
        return jsonify({'error': 'min_same_school invalide'}), 400

    if max_per_class is not None and max_per_class < 1:
        return jsonify({'error': 'max_per_class doit être >= 1'}), 400
    if min_same_school is not None and min_same_school < 1:
        return jsonify({'error': 'min_same_school doit être >= 1'}), 400

    if not eleves or nb_classes < 1 or nb_classes > 5:
        return jsonify({'error': 'Paramètres invalides'}), 400

    if max_per_class is not None and (max_per_class + soft_overflow) * nb_classes < len(eleves):
        return jsonify({'error': 'Capacité insuffisante, même avec une marge de dépassement'}), 400

    attempts = [
        {
            'name': 'strict',
            'min_same_school': min_same_school,
            'relax_hard_constraints': False,
            'use_school_bonus': True,
        },
        {
            'name': 'no_school_grouping',
            'min_same_school': None,
            'relax_hard_constraints': False,
            'use_school_bonus': False,
        },
        {
            'name': 'tolerant',
            'min_same_school': None,
            'relax_hard_constraints': True,
            'use_school_bonus': False,
        },
    ]

    # Lancer plusieurs itérations et garder le meilleur résultat
    best_result = None
    best_score = -float('inf')
    last_error = None

    for iteration in range(1000):
        for attempt in attempts:
            result = generate_single_repartition(
                niveau, nb_classes, eleves, pre_assignations, contraintes,
                global_constraints, max_per_class, attempt['min_same_school'], soft_overflow,
                relax_hard_constraints=attempt['relax_hard_constraints'],
                use_school_bonus=attempt['use_school_bonus']
            )

            if isinstance(result, tuple) and result[0] is False:
                last_error = result[1]
                if 'Pré-assignations' in result[1]:
                    return jsonify({'error': result[1]}), 400
                continue

            score = evaluate_repartition(result, eleves, contraintes, global_constraints)
            if score > best_score:
                best_score = score
                best_result = result
                

    if best_result is None:
        return jsonify({'error': last_error or 'Impossible de générer une répartition valide'}), 400

    return jsonify(best_result)


def generate_single_repartition(niveau, nb_classes, eleves, pre_assignations, contraintes, 
                                global_constraints, max_per_class, min_same_school, soft_overflow,
                                relax_hard_constraints=False, use_school_bonus=True):
    """
    Génère une répartition aléatoire des élèves dans les classes en respectant les contraintes.
    Retourne un dict {class_name: [student_names]} ou une tuple d'erreur (False, message).
    """
    keys = [f"{niveau} - Classe {i + 1}" for i in range(nb_classes)]

    # Partir des pré-assignations validées (conserver seulement les élèves connus)
    eleves_set = set(eleves)
    classes = {}
    for k in keys:
        classes[k] = [e for e in pre_assignations.get(k, []) if e in eleves_set]

    # Élèves non encore placés après application des pré-assignations.
    already_assigned = set(e for lst in classes.values() for e in lst)
    remaining = [e for e in eleves if e not in already_assigned]

    if max_per_class is not None:
        for k in keys:
            if len(classes[k]) > max_per_class + soft_overflow:
                return (False, f'Pré-assignations trop nombreuses dans {k}')

    def class_limit(allow_overflow=False):
        if max_per_class is None:
            return 10**9
        return max_per_class + (soft_overflow if allow_overflow else 0)

    def class_capacity(class_key, allow_overflow=False):
        return class_limit(allow_overflow=allow_overflow) - len(classes[class_key])

    def select_target_class(required_slots=1, allow_overflow=False):
        candidates = [k for k in keys if class_capacity(k, allow_overflow=allow_overflow) >= required_slots]
        if not candidates:
            return None
        return min(candidates, key=lambda c: len(classes[c]))

    def get_student_school(student_name):
        info = contraintes.get(student_name, {}) or {}
        return (info.get('ecole') or '').strip()

    def score_target_class_for_student(student, target_class):
        """
        Score de placement: plus haut = meilleur placement vis-à-vis des contraintes.
        L'équilibrage est conservé mais avec un poids faible.
        """
        score = 0.0
        student_contraintes = contraintes.get(student, {}) or {}
        class_members = set(classes[target_class])

        avec = [n for n in student_contraintes.get('avec', []) if n in eleves_set]
        avec_op = student_contraintes.get('avec_operator', 'AND')
        if avec:
            matches = sum(1 for n in avec if n in class_members)
            if avec_op == 'AND':
                score += matches * 10.0
            else:
                score += matches * 7.0

        pas_avec = [n for n in student_contraintes.get('pas_avec', []) if n in eleves_set]
        pas_avec_op = student_contraintes.get('pas_avec_operator', 'AND')
        if pas_avec:
            conflicts = sum(1 for n in pas_avec if n in class_members)
            if pas_avec_op == 'AND':
                score -= conflicts * 9.0
            else:
                score -= conflicts * 4.0

        # Bonus pour regrouper les élèves d'une même école, uniquement en mode strict.
        if use_school_bonus:
            school = get_student_school(student)
            if school:
                same_school_count = sum(1 for member in class_members if get_student_school(member) == school)
                score += same_school_count * 2.0

        # L'équilibrage reste un second critère (faible poids).
        score -= len(classes[target_class]) * 0.2

        # Léger coût si on dépasse max_per_class (possible via overflow contrôlé).
        if max_per_class is not None and len(classes[target_class]) >= max_per_class:
            score -= (len(classes[target_class]) - max_per_class + 1) * 1.5

        return score

    def choose_target_class_for_student(student, valid_classes):
        if not valid_classes:
            return None

        scored = []
        for c in valid_classes:
            scored.append((score_target_class_for_student(student, c), c))

        best_score = max(scored, key=lambda x: x[0])[0]
        best_classes = [c for s, c in scored if s == best_score]

        # Briser les égalités sans forcer une répartition strictement uniforme.
        return random.choice(best_classes)

    def choose_target_class_for_group(group_members, valid_classes):
        if not valid_classes:
            return None

        scored = []
        for c in valid_classes:
            group_score = sum(score_target_class_for_student(member, c) for member in group_members)
            scored.append((group_score, c))

        best_score = max(scored, key=lambda x: x[0])[0]
        best_classes = [c for s, c in scored if s == best_score]
        return random.choice(best_classes)

    def check_avec_constraint(student, target_class, operator, names):
        """
        Vérifie si on peut placer 'student' dans 'target_class' en respectant 'avec' constraints.
        
        AND: Tous les noms doivent être dans la classe
        OR: Au moins UN doit être dans la classe (accepté même si aucun placé)
        """
        if not names:
            return True
        
        class_members = set(classes[target_class])
        names_set = set(n for n in names if n in eleves_set)
        
        if operator == 'AND':
            # Tous doivent être dans la classe (OU tous ne sont pas encore placés)
            already_in = names_set & class_members
            not_yet = names_set - class_members
            
            # Si certains sont dans la classe, tous les autres DOIVENT y être
            if already_in and not_yet:
                return False
            return True
        
        # Pour OR et autres opérateurs, on est plus permissif
        # (on va vérifier via les AND et pas_avec)
        return True

    def check_pas_avec_constraint(student, target_class, operator, names):
        """
        Vérifie si on peut placer 'student' dans 'target_class' en respectant 'pas avec' constraints.
        
        AND: Aucun des noms ne doit être dans la classe
        OR: Les noms ne peuvent pas TOUS être dans la classe ensemble (au moins un absent)
        """
        if not names:
            return True
        
        class_members = set(classes[target_class])
        names_set = set(n for n in names if n in eleves_set)
        
        if operator == 'AND':
            # Aucun ne doit être dans la classe
            return len(names_set & class_members) == 0
        
        elif operator == 'OR':
            # Tous les noms ne peuvent pas être ensemble (au moins un absent)
            return len(names_set & class_members) < len(names_set)
        
        return True

    def can_place_student(student, target_class):
        """Vérifie si student peut être placé dans target_class en respectant toutes ses contraintes."""
        if relax_hard_constraints:
            return True

        student_contraintes = contraintes.get(student, {}) or {}
        
        avec = student_contraintes.get('avec', [])
        avec_op = student_contraintes.get('avec_operator', 'AND')
        if not check_avec_constraint(student, target_class, avec_op, avec):
            return False
        
        pas_avec = student_contraintes.get('pas_avec', [])
        pas_avec_op = student_contraintes.get('pas_avec_operator', 'AND')
        if not check_pas_avec_constraint(student, target_class, pas_avec_op, pas_avec):
            return False
        
        return True

    # ─── Traiter les groupes "avec AND" en priorité ───
    # Identifier les élèves qui doivent être ensemble (contrainte "avec AND")
    and_groups = {}  # Dict {frozenset(groupe) -> [members]}
    assigned_to_and_group = set()
    
    for student in remaining:
        if student in assigned_to_and_group:
            continue
            
        student_contraintes = contraintes.get(student, {}) or {}
        avec = student_contraintes.get('avec', [])
        avec_op = student_contraintes.get('avec_operator', 'AND')
        
        if avec_op == 'AND' and avec:
            # Cet élève doit être avec tous ces noms (AND)
            required_names = set(n for n in avec if n in eleves_set)
            group = {student} | required_names
            group_id = frozenset(group)
            
            if group_id not in and_groups:
                and_groups[group_id] = list(group)
                assigned_to_and_group.update(group)

    # Placer les groupes AND
    for group_id, group in and_groups.items():
        still_to_place = [m for m in group if m in remaining]
        
        if not still_to_place:
            continue  # Groupe déjà placé
        
        # Chercher une classe qui peut contenir tout le groupe
        valid_classes = [c for c in keys 
                        if class_capacity(c) >= len(still_to_place) 
                        and all(can_place_student(member, c) for member in still_to_place)]

        if not valid_classes:
            valid_classes = [c for c in keys
                            if class_capacity(c, allow_overflow=True) >= len(still_to_place)
                            and all(can_place_student(member, c) for member in still_to_place)]
        
        if valid_classes:
            target = choose_target_class_for_group(still_to_place, valid_classes)
            for member in still_to_place:
                classes[target].append(member)
                remaining.remove(member)

    # ─── Fin traitement groupes AND ───

    # Répartir aléatoirement le reste
    already_assigned = set(e for lst in classes.values() for e in lst)
    remaining = [e for e in eleves if e not in already_assigned]

    # Construire la carte élève -> école
    school_by_student = {}
    for full_name in eleves:
        info = contraintes.get(full_name, {}) or {}
        school = (info.get('ecole') or '').strip()
        if school:
            school_by_student[full_name] = school

    # Appliquer un regroupement minimum par école quand demandé
    if min_same_school is not None and min_same_school > 1:
        school_groups = {}
        for student in remaining:
            school = school_by_student.get(student, '')
            if school:
                school_groups.setdefault(school, []).append(student)

        for school, members in school_groups.items():
            random.shuffle(members)
            while len(members) >= min_same_school:
                chunk = [members.pop() for _ in range(min_same_school)]
                target = select_target_class(required_slots=min_same_school)
                if target is None:
                    target = select_target_class(required_slots=min_same_school, allow_overflow=True)
                if target is None:
                    # Plus de place pour un bloc complet, on remet et on sort
                    members.extend(chunk)
                    break
                classes[target].extend(chunk)

        already_assigned = set(e for lst in classes.values() for e in lst)
        remaining = [e for e in eleves if e not in already_assigned]

    random.shuffle(remaining)
    for eleve in remaining:
        # Chercher une classe où l'élève peut être placé en respectant les contraintes
        valid_classes = [c for c in keys if class_capacity(c) >= 1 and can_place_student(eleve, c)]

        if not valid_classes:
            valid_classes = [c for c in keys if class_capacity(c, allow_overflow=True) >= 1 and can_place_student(eleve, c)]
        
        if not valid_classes:
            # Déterminer si c'est un problème de capacité ou de contraintes
            if not [c for c in keys if class_capacity(c, allow_overflow=True) >= 1]:
                return (False, 'Impossible de placer tous les élèves : capacité insuffisante même avec dépassement autorisé')
            else:
                return (False, f'Impossible de placer l\'élève {eleve} en respectant ses contraintes')
        
        # Placer dans la classe avec le meilleur score de contraintes
        target = choose_target_class_for_student(eleve, valid_classes)
        classes[target].append(eleve)

    return classes


def evaluate_repartition(repartition, eleves, contraintes, global_constraints):
    """
    Évalue une répartition d'élèves et retourne un score global (0-100).
    Score plus haut = meilleure répartition.
    """
    eleves_set = set(eleves)
    score = 0.0

    # Évaluer les contraintes 'avec'
    for student in eleves:
        student_contraintes = contraintes.get(student, {}) or {}
        avec = [n for n in student_contraintes.get('avec', []) if n in eleves_set]
        avec_op = student_contraintes.get('avec_operator', 'AND')
        
        if avec:
            # Trouver la classe de cet élève
            student_class = None
            for class_name, students in repartition.items():
                if student in students:
                    student_class = class_name
                    break
            
            if student_class:
                class_members = set(repartition[student_class])
                matches = sum(1 for n in avec if n in class_members)
                
                if avec_op == 'AND':
                    # Pour AND, tous doivent être présents
                    if matches == len(avec):
                        score += 20
                    elif matches > 0:
                        score += 10 * (matches / len(avec))
                else:  # OR
                    # Pour OR, au moins un doit être présent
                    if matches > 0:
                        score += 15
    
    # Évaluer les contraintes 'pas avec'
    for student in eleves:
        student_contraintes = contraintes.get(student, {}) or {}
        pas_avec = [n for n in student_contraintes.get('pas_avec', []) if n in eleves_set]
        pas_avec_op = student_contraintes.get('pas_avec_operator', 'AND')
        
        if pas_avec:
            # Trouver la classe de cet élève
            student_class = None
            for class_name, students in repartition.items():
                if student in students:
                    student_class = class_name
                    break
            
            if student_class:
                class_members = set(repartition[student_class])
                conflicts = sum(1 for n in pas_avec if n in class_members)
                
                if pas_avec_op == 'AND':
                    # Pour AND, aucun ne doit être présent
                    score += 20 * (1 - conflicts / len(pas_avec)) if pas_avec else 20
                else:  # OR
                    # Pour OR, tous ne peuvent pas être ensemble
                    if conflicts < len(pas_avec):
                        score += 15
    
    # Évaluer l'équilibre des tailles de classes
    sizes = [len(students) for students in repartition.values()]
    if sizes:
        avg_size = sum(sizes) / len(sizes)
        max_deviation = max(abs(size - avg_size) for size in sizes)
        balance_score = 20 * max(0, 1 - max_deviation / (avg_size + 1))
        score += balance_score
    
    # Bonus pour regrouper élèves d'une même école
    school_bonus = 0
    for class_name, students in repartition.items():
        school_count = {}
        for student in students:
            info = contraintes.get(student, {}) or {}
            school = (info.get('ecole') or '').strip()
            if school:
                school_count[school] = school_count.get(school, 0) + 1
        
        # Bonus pour les groupes de même école (≥2)
        for school, count in school_count.items():
            if count >= 2:
                school_bonus += count * 2
    
    score += min(school_bonus, 20)  # Cap à 20 pour ne pas dominer
    
    return min(score, 100)  # Score maximal de 100


@app.route('/creation-classe/export-excel', methods=['POST'])
def export_repartition_excel():
    data = request.get_json() or {}
    repartition = data.get('repartition') or {}
    niveau = (data.get('niveau') or '').strip()
    contraintes = data.get('contraintes') or {}

    if not isinstance(repartition, dict) or not repartition:
        return jsonify({'error': 'Aucune répartition à exporter'}), 400

    try:
        from openpyxl import Workbook
    except ImportError:
        return jsonify({'error': "Le module openpyxl est requis pour l'export Excel"}), 500

    wb = Workbook()
    ws = wb.active
    ws.title = 'Repartition'

    ws.append(['Niveau', 'Classe', 'Ordre', 'Eleve', 'Ecole', 'Genre', 'Demande'])

    for class_name in sorted(repartition.keys()):
        students = repartition.get(class_name, []) or []
        if not isinstance(students, list):
            continue

        for idx, student_name in enumerate(sorted(students, key=lambda s: s.lower()), start=1):
            info = contraintes.get(student_name, {}) or {}
            ws.append([
                niveau,
                class_name,
                idx,
                student_name,
                (info.get('ecole') or ''),
                (info.get('genre') or ''),
                (info.get('demande_raw') or ''),
            ])

    # Ajustement simple de la largeur des colonnes pour lisibilité dans Excel.
    widths = {'A': 12, 'B': 24, 'C': 8, 'D': 30, 'E': 24, 'F': 10, 'G': 40}
    for col, width in widths.items():
        ws.column_dimensions[col].width = width

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    safe_niveau = niveau.replace(' ', '_') if niveau else 'niveau'
    file_name = f'repartition_{safe_niveau}_{timestamp}.xlsx'

    return send_file(
        buffer,
        as_attachment=True,
        download_name=file_name,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )

@app.route('/upload', methods=['POST'])
def upload_file():
    data = request.json  # Recevez les données JSON envoyées depuis le client
    # Traitez les données comme vous le souhaitez
    print(data)  # Affiche les données dans le terminal pour vérification
    return jsonify({'status': 'success'})


@app.route('/update', methods=['POST'])
def update_data():
    payload = request.get_json() or {}
    professors = payload.get('professors')

    if not isinstance(professors, list):
        return jsonify({'error': "Format invalide: 'professors' doit être une liste"}), 400

    normalized_professors = []
    class_keys = ["61", "62", "63", "64", "51", "52", "53", "54", "41", "42", "43", "44", "31", "32", "33", "34"]
    session_keys = ["S1L1", "S1L2", "S1M1", "S1M2", "S1J1", "S1J2", "S2L1", "S2L2", "S2M1", "S2M2", "S2J1", "S2J2"]

    for p in professors:
        if not isinstance(p, dict):
            continue

        name = (p.get('name') or '').strip()
        subject = (p.get('subject') or '').strip()
        pp = (p.get('PP') or '-').strip() or '-'

        if not name:
            continue

        normalized = {
            'name': name,
            'subject': subject,
            'PP': pp,
        }

        for ck in class_keys:
            normalized[f'c{ck}'] = bool(p.get(f'c{ck}', False))

        for sk in session_keys:
            normalized[sk] = bool(p.get(sk, False))

        normalized_professors.append(normalized)

    data_to_save = {'professors': normalized_professors}

    try:
        with open(get_data_file_path(), 'w', encoding='utf-8') as json_file:
            json.dump(data_to_save, json_file, ensure_ascii=False, indent=2)
    except OSError:
        return jsonify({'error': "Impossible d'écrire data/data.json"}), 500

    global loaded_data
    loaded_data = data_to_save

    return jsonify({'status': 'success', 'count': len(normalized_professors)})

@app.route('/trouver_creneau', methods=['POST'])
def trouver_creneau():
    data = request.get_json() or []

    if not isinstance(data, list):
        return jsonify({'error': 'Format invalide: liste de professeurs attendue'}), 400

    classes = {}
    ignored_rows = 0

    for professor in data:
        if not isinstance(professor, dict):
            ignored_rows += 1
            continue

        name = (professor.get('name') or '').strip()
        classes_list = professor.get('classes') or []
        sessions_list = professor.get('sessions') or []

        if not name or not isinstance(classes_list, list) or not isinstance(sessions_list, list):
            ignored_rows += 1
            continue

        if not classes_list or not sessions_list:
            ignored_rows += 1
            continue

        for class_number in classes_list:
            class_number = str(class_number).strip()
            if not class_number:
                continue
            if class_number not in classes:
                classes[class_number] = {}
            classes[class_number][name] = sessions_list

    if not classes:
        return jsonify({'error': 'Aucune donnée exploitable: renseignez au moins un professeur avec classes et disponibilités'}), 400

    print("***********************Lancement traitement************************")

    assignations = resoudre_contraintes(classes)

    print("Assignation des créneaux aux classes :")
    print(assignations)

    if not isinstance(assignations, dict):
        return jsonify({'error': 'Le moteur de résolution a retourné un format inattendu'}), 500

    response = dict(assignations)
    if ignored_rows:
        response['_warning'] = f'{ignored_rows} ligne(s) ont été ignorées (incomplètes ou invalides).'

    return jsonify(response)

# Route pour télécharger le modèle Excel
@app.route('/telecharger_modele')
def telecharger_modele():
    chemin_du_fichier = 'data/Modele.xlsx'
    return send_file(chemin_du_fichier, as_attachment=True, download_name='modele_import_professeurs.xlsx')

if __name__ == '__main__':
    app.run(debug=True)

