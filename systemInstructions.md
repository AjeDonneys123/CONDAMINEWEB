RÈGLES DE SORTIE : Utilisez Gemini 2.0 Flash. Fichiers complets. Tags [[[£ FILE: path £]]] content [[[£ END: path £]]]. Snippet unique.
relie apply.js pour bien comprendre le system.
REGLE D OR ABSOLUE: ENVOYER Une introduction
Puis LE CODE EN UN SEUL BLOC PRÉCÉDÉ DE ````ET SUIVIT DE ```` AFIN DE GÉNÉRÉ UNE SNIPETTE QUE JE POURRAIS COLLER DANS UPDATE.TXT TOUT CODE NON CONTENU DANS UNE SIPETTE UNIQUE SERA INUTILE TOKENS PERDUS
Enfin une conclusion

GOOGLE DRIVE UTILISE L INTELLIGENCE DE MON ADRESSE PERSO VUILLET.JEAN@GMAIL.COM MAIS TRAVAIL DANS LE GOOGLE PRO VUILLET.JEAN@CONDAMINE.EDU.EC


!!! EN MAJUSCULE CELLES QUI MARCHENT PAS OU LES BUGS
Liste des fonctionalités du site a ne surtout pas casser et a faire progresser
🛡️ 1. ESPACE ADMIN (Le Cœur du Système)
C'est la base de données et la structure de l'établissement.
Fonctionnalités Sanctuarisées (À ne pas casser) :
Importation Massive : Je peux importer des listes d'élèves via copier-coller (texte tableau) ou fichier CSV. L'IA doit parser les colonnes (Nom, Prénom, Classe, Options, Email) automatiquement.
Gestion Utilisateurs :
Créer/Modifier/Supprimer un Admin.
Créer/Modifier/Supprimer un Professeur : Lui assigner ses Matières et ses Classes et ses Groupes (ex: 2A, 1D BFI).
Créer/Modifier/Supprimer un Élève : Définir son Nom, Prénom, Email, Email Parents, Classe principale et ses Groupes (Options).
Gestion Structurelle : Créer les Classes (ex: 6A) et les Groupes (ex: 3C LVA Anglais).
À Faire Progresser :
Nettoyage BDD : Pouvoir archiver une année scolaire ou nettoyer les élèves sans classe d'un clic.
Santé Système : Un tableau de bord technique pour voir si le Drive est connecté et si l'API IA répond.
🎓 2. ESPACE PROFESSEUR (L'Outil Quotidien)
Divisé en Gestion de Classe, Création (Studio) et Correction.
A. Gestion de Classe & Vie Scolaire
Fonctionnalités Sanctuarisées :
Trombinoscope/Plan de classe : Je peux voir mes élèves sous forme de grille ou de liste.
Comportement (Gamification) :
Mettre une Croix (Sanction). Au bout de 3 croix -> Punition automatique (Statut PENDING): 
!!!  A AJOUTER:COMPLETER : un devoir défini comme punition pour ce niveau est automatiquement attribué à l'élève si une punition existe pour ce niveau
!!!  A AJOUTER:COMPLETER : Mettre un Bonus (Récompense). SI 4 BONUS AFFICHER RÉCOMPENSE A+ POUR L ÉLÈVE ET AUSSI COTÉ PROF (CET ÉLÈVE A EU UN A+)
Voir la barre de "Rachat" (temps restant avant annulation d'une croix).
Déplacement : Je peux déplacer les élèves sur le plan de classe par glisser-déposer.
VOIR LES DEVOIRS/JEUX LA PARTIE DROIT DES DIV ÉLÈVE C EST DES PETITS POINTS DE COULEURS QUI CORRESPONDENT AUX DEVOIRS DONNES PAR CE PROF PASTILLE BLANCHE LE DEVOIR/JEU N EST PAS INITIÉ JAMAIS L ÉLÈVE N A CLIQUE DESSUS PASTILLE JAUNE L ÉLÈVE A OUVERT LE DEVOIR JEU ET NE L A PAS FINI (JEU NON GAGNE OU ENVOIE DU DEVOIR NON VALIDÉ PAR L IA)
B. Studio de Création (Activités)
Fonctionnalités Sanctuarisées :
Création de Devoirs (Homework) :
Définir un Titre, une Consigne textuelle, UNE CONSIGNE POUR L IA (GRILLE/INDICATIONS DE CORRECTIONS)
Uploader des fichiers (Sujet, Pièces jointes).
Ciblage : Assigner à une Classe entière (ex: 2A) OU à un Groupe (ex: 1D BFI).
!!!MULTIPAGE JE PEU AJOUTER UNE NOUVELLE PAGE DE DEVOIR AVEC D AUTRES DOCUMENTS ET  D AUTRES CONSIGNES ELEVES (TAPPES EN TXT OU IMPORTE UNE IMAGE DE QUESTIONS) ET D AUTRES CONSIGNES DE CORRECTION IA POUR CETTE PAGE
BOUTON PUNITION: DÉCLARER LE DEVOIR COMME PUNITION (IL SERA ATTRIBUE AUTOMATIQUEMENT AUX ELEVES QUI ONT 3 CROIX DE CE NIVEAU)
Dossier : Ranger le devoir dans un Chapitre/Dossier (ex: "Géométrie").PAR DEFAUT IL SERA RANGE DANS UN DOSSIER COURRANT (NON STOCKE DANS LES ARCHIVES) AU HAZAR
Création de Jeux (Quiz) :
Générer des questions via IA (je peu choisir le nombre de questions generees).
Éditer manuellement les questions/réponses.
Publier pour une classe/groupe spécifique.
!!!SI JE SUIS ELEVE D UNE OPTION ET QUE LE JEU A ÉTÉ CRÉÉ POUR CETTE OPTION OU GROUPE JE VOIS LE JEU PROPOSÉE SUR MON COMPTE ÉLÈVE
À Faire Progresser :
Mode Punition : Créer un devoir spécial "Punition" qui ne s'assigne qu'aux élèves ayant 3 croix (déjà en place, à fiabiliser).
Sections Personnalisées : Créer des sections (ex: "TP", "Cours") pour organiser les chapitres, sans pouvoir supprimer la section "GÉNÉRAL" par erreur.
C. Scan & Correction (Le Workflow)
JE CRÉE UN NOUVEAU DC (DEVOIR EN CLASSE) UN DIV APPARAIT SUR DEUX LIGNES LIGNE 1 NOM DU DEVOIR DOSSIER DE RANGEMENT (PAR DÉFAUT UN DOSSIER COURRANT EST SELECTIONNÉ)
LIGNE 2: UN BOUTON INSTRUCTION (PERMET DE SCANNER INSTRUCTIONS PHOTOS DES QUESTIONS A ENVOYER A L IA), UN BOUTON SCAN (PERMET DE SCANNER LES COPIES) UN BOUTON DEVOIR (OUVRE UN DIV AVEC TOUS LES DEVOIRS SCANNÉS ET ENVOYÉS EN BDD ET DANS LE DRIVE) UN BOUTON CORRECTION (AVEC UN DIV OU JE DONNE LES INSTRUCTIONS DE CORRECTION POUR L IA ET EN DESSOUS LES CORRECTIONS DE L IA APPARAISSENT)
INSTRUCTIONS DE CORRETION DE BASE POUR LES SCANES:
-IDENTIFIER L L ÉLÈVE GRACE AU NOM SUR LA COPIE ET LA CLASSE COURRANTE SÉLECITONNÉE
-METTRE EN HAUT UNE APPRÉCIATION GLOBALE SUR LE TRAVAIL
-METTRE UNE LETTRE (A+ TRES BON DEVOIR A DEVOIR CORRECT OU BON L ESSENTIEL DE CE QUI ÉTAIT ATTENDU EST LA B COMPÉTENCES EN COURS D ACQUISITION CERTAINS ÉLÉMENTS ATTENDU SONT PRÉSENTS MAIS PAS LA MAJORITÉ OU C TRAVAIL INSUFFISANT TRÈS PEU D ÉLÉMENTS ATTENDUS SONT PRÉSENTS ON VOI UN MANQUE DE SÉRIEUX DANS LE TRAVAIL )
Fonctionnalités Sanctuarisées :
Scan Studio :
Prendre en photo des copies via la Webcam ou le Téléphone (Interface WYSIWYG).
Prendre en photo le Sujet de référence.
IA Correcteur :
Lancer l'IA sur un lot de copies scannées.

Rangement Drive : Envoyer les scans et corrections vers le dossier Google Drive ET STOCKER LES ID DU SUJET POUR LA CLASSE DE LA COPIE ET SA CORRECTION POUR L ÉLÈVE
LE PROF PEUT VOIR L ENSEMBLE DANS SON ONGLET ÉLÈVES SUR ORDI UNIQUEMENT OU SOUS FORME DE PASTILLE DE COULEUR DANS L ONGLET CLASSE 
🎒 3. ESPACE ÉLÈVE (L'Expérience Utilisateur)
Simplifié pour une lecture immédiate.
Fonctionnalités Sanctuarisées :
Dashboard Matières : Je vois mes devoirs regroupés par Matière (ex: "Maths", "Histoire") et non par dossier technique.
Statut Devoir : Je vois clairement ce qui est "À FAIRE" (Rouge), "EN COURS" (Bleu) ou "FAIT" (Vert).
Réalisation Devoir :
Je peux lire la consigne et voir les documents.
Je peux répondre par texte.
Je reçois un feedback immédiat (Note/Conseil) si l'IA est active sur le devoir.
SI JE RECOIS ROUGE C INSUFFISANT DANS CE CAS MA RÉPONS EST EFFACÉE ET JE DOIS LA REFAIRE SI JE RECOIS JAUNE B ALORS L IA ME DONNE QUELQUES INDICES ET JE PEU COMPLÉTER MA RÉPONSE SI JE RECOIS VERT A ALORS MA RÉPONSE EST VALIDÉE LE DEVOIR EST CONSIDÉRÉ COMME FAIT SI JE RECOIS VERT FONCÉ A+ UN MESSAGE DE FÉLICIATION M EST ENVOYÉ POUR LA QUALITÉ DE MON TRAVAIL
Jeux de Révision :
Je peux lancer un jeu (Zombie/Starship) associé à mon niveau.
Mon score est enregistré.
Carnet de Bord :
Je vois mes Croix (Sanctions) et mes Bonus PAR MATIÈRE.
Je vois si j'ai une Punition à rendre (Alerte Rouge).
Je vois mon "Carnet d'Erreurs" (fautes d'orthographe récurrentes relevées par l'IA).
🧠 4. MOTEUR & INTELLIGENCE (Invisible mais Vital)
Fonctionnalités Sanctuarisées :
Auth Hybride : Connexion via mot de passe simple (Prof/Admin) ou sélection visuelle (Élèves "Magic Finder").
Google Drive Proxy : Les images stockées sur le Drive privé du prof sont visibles sur le site via un "Proxy" (le serveur fait le pont) pour éviter les images brisées.
Sécurité des Données : Un élève ne voit jamais les données d'un autre élève (notes, croix).
Intégrité Structurelle : Chaque utilisateur (Prof) a sa propre arborescence de dossiers qui se crée automatiquement si elle n'existe pas.