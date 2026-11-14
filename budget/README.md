# Budget — gestion de dépenses (Android)

Base d'application Android native (Kotlin, Jetpack Compose, Material 3, Room) pour suivre
ses comptes bancaires, ses dépenses et rentrées d'argent, et planifier les opérations à venir.
Tout reste sur le téléphone (base SQLite locale), sans compte ni réseau.

## Installer sur le téléphone

1. Ouvrir la release `budget-apk-latest` du dépôt
   (`https://github.com/<propriétaire>/<dépôt>/releases/tag/budget-apk-latest`).
2. Télécharger `budget.apk` puis l'ouvrir (autoriser les « sources inconnues » la première fois).

Chaque push qui touche `budget/` relance le workflow `APK Budget` : tests unitaires, puis
compilation et remplacement de l'APK de la release. Toutes les versions sont signées avec la
même clé (`app/budget.keystore`, sans valeur, pour l'installation manuelle), donc une mise à
jour s'installe par-dessus l'ancienne sans perdre les données.

## Interface

Un mélange de Wallet (accueil en cartes) et de Money Manager (liste mensuelle). Accent corail,
revenus en bleu et dépenses en rouge. Thème au choix dans Plus › Apparence : Système (suit le
téléphone), Clair, Sombre, ou Noir (noir pur, économe sur les écrans OLED) ; la barre d'état
suit le thème choisi.

Quatre onglets :

- **Accueil** (façon Wallet)
  - **Mes comptes** : une tuile colorée par compte (icône, nom, solde) et une tuile
    « Ajouter un compte ». Toucher une tuile ouvre les opérations du compte ; le crayon y
    modifie le compte (nom, solde initial, icône, couleur) ou le supprime.
  - **Solde réel** : total de tous les comptes aujourd'hui, et solde prévu en fin de mois en
    comptant les opérations planifiées restantes.
  - **Structure des dépenses** : donut des dépenses du mois par catégorie.
  - **Derniers enregistrements** et **Paiements planifiés à venir** (30 jours), chacun avec
    « Afficher plus ».
- **Opérations** (façon Money Manager)
  - Mois en haut (‹ ›, toucher le mois revient au mois courant), vues **Liste** et **Calendrier**.
  - Bandeau Revenus / Dépenses / Total du mois.
  - Bandeau **Récurrences** : les échéances planifiées pas encore passées dans le mois, leurs
    dates et leur total ; le toucher ouvre les planifications.
  - Liste groupée par jour (numéro, jour de la semaine, totaux du jour). Chaque ligne montre la
    catégorie et la sous-catégorie, le libellé, le compte et le rythme si l'opération vient
    d'une planification (« Boursorama (Tous les mois) »).
  - Calendrier : totaux de chaque jour ; toucher un jour affiche ses opérations, et le + y
    ajoute une opération à cette date.
- **Stats** : répartition du mois par catégorie principale (donut et pourcentages), en
  dépenses ou en revenus.
- **Plus** : opérations planifiées, catégories, ajout de compte.

## Fonctions

- **Opérations** : sens (dépense / rentrée), montant, libellé, catégorie, compte, date.
- **Catégories** : dépenses et revenus, chacune avec un emoji et une couleur, et des
  **sous-catégories** (un niveau, ex. Loisirs › Abonnements). Les statistiques regroupent les
  sous-catégories dans leur catégorie principale. Supprimer une catégorie supprime ses
  sous-catégories ; les opérations restent, sans catégorie.
- **Planifié** :
  - *Répéter : Non* → une échéance unique à une date donnée.
  - *Chaque jour / semaine / mois / année*, « tous les N », qui se termine **jamais** ou
    **après N fois**.
  - Les échéances arrivées à terme deviennent de vraies opérations à chaque ouverture de l'app.
    Une date de départ passée crée tout de suite les échéances passées.
  - Modifier une série agit sur la suite : la date affichée est la prochaine échéance et le
    nombre celui des échéances restantes. Supprimer une série garde les opérations déjà créées.
  - Une série mensuelle commencée un 31 tombe le dernier jour des mois courts.
  - **Dates non fixes** (séries mensuelles et annuelles), champ « Jour » : le jour de la date
    choisie, le dernier jour du mois, le premier / dernier / Nᵉ jour ouvré, ou un jour de la
    semaine (« 2ᵉ mardi », « dernier vendredi »). La date choisie sert alors de point de
    départ (« À partir du ») : si la règle tombe avant elle dans le mois, la série commence au
    mois suivant.
  - **Week-ends et jours fériés** : pour une date fixe (et pour les séries hebdomadaires ou
    ponctuelles), on peut décaler l'échéance au jour ouvré suivant ou précédent.
  - Jours ouvrés = du lundi au vendredi hors jours fériés français (1er janvier, lundi de
    Pâques, 1er et 8 mai, Ascension, lundi de Pentecôte, 14 juillet, 15 août, 1er et 11
    novembre, 25 décembre), calculés pour chaque année.
  - Le formulaire montre en direct les prochaines dates de la série.
- **Budgets mensuels** (Plus › Budgets, ou Stats › Budgets) : un montant par mois pour chaque
  catégorie de dépense principale (sous-catégories comprises). Barre de progression orange à
  80 %, rouge au-delà de 100 % ; les budgets les plus entamés sont sur l'accueil.
- **Solde prévisionnel** (Plus, ou « Afficher plus » sous le solde réel) : courbe du solde jour
  par jour sur 30 jours à 1 an, pour tous les comptes ou un seul, avec les opérations
  planifiées, virements et débits différés à venir ; le point le plus bas et une alerte si le
  solde passe sous zéro, puis la liste des mouvements prévus.
- **Stats sur la durée** : « Ce mois » (donut, budgets, détail d'une catégorie par
  sous-catégorie en la touchant) ou « 12 derniers mois » (barres revenus / dépenses par mois,
  moyennes mensuelles, épargne, tableau mois par mois).
- **Recherche et filtres** (loupe de l'onglet Opérations) : texte libre (libellé, catégorie,
  compte, montant, sans tenir compte des accents), période, type, compte, catégorie, montant
  min / max ; nombre de résultats et totaux.
- **Saisie rapide** : le clavier s'ouvre sur le montant ; catégories en grille d'emojis (puis
  sous-catégories) ; suggestions d'après les libellés déjà saisis, qui reprennent catégorie,
  compte et montant ; « Dupliquer » une opération ; glisser une opération vers la gauche pour
  la supprimer (annulable).
- **Vues Mois et Total** (onglet Opérations, à côté de Liste et Calendrier) : « Mois » = les 12
  mois de l'année avec revenus, dépenses et bilan (toucher un mois l'ouvre en liste) ;
  « Total » = budget du mois, comparaison avec le mois précédent, moyennes, soldes des comptes
  et plus grosses dépenses.
- **Pointage / rapprochement** (bouton « Pointer » sur la page d'un compte) : on saisit le solde
  du relevé, on coche chaque opération retrouvée sur le relevé, l'écran affiche le solde pointé
  et l'écart. Quand l'écart est nul, « Rapprocher » verrouille les opérations pointées.
  - Les dépenses d'une carte à débit différé se pointent ensemble, sur la ligne de leur débit.
  - Les opérations à venir sont listées à part (pas encore sur le relevé).
  - Dans les listes : ✓ = pointée, 🔒 = rapprochée. Une opération rapprochée ne se modifie ni
    ne se supprime plus ; son formulaire propose de la déverrouiller.
- **Sauvegarde / restauration** (Plus › Données) : export de toute la base dans un fichier JSON
  (à enregistrer sur Google Drive par exemple), restauration depuis ce fichier après
  confirmation (remplace toutes les données). La date de la dernière sauvegarde est affichée.
- **Annuler une suppression** : après la suppression d'une opération, d'un virement, d'un
  compte, d'une catégorie, d'une planification ou d'un paiement en plusieurs fois, un bandeau
  propose « Annuler », qui remet la base dans l'état d'avant (liens compris).
- **Virements entre comptes** : choix « Virement » à côté de Dépense / Rentrée, dans le
  formulaire d'opération comme dans les planifications (ex. épargne chaque mois).
  - Un virement est une sortie sur le compte débité et une entrée sur le compte crédité, liées :
    les deux soldes sont justes, et modifier ou supprimer l'une agit sur les deux.
  - Il ne compte ni en revenu ni en dépense (totaux du mois, calendrier, Stats, structure des
    dépenses) ; il apparaît en gris « Boursorama → Fortuneo » dans la liste de tous les
    comptes, et en sortie ou entrée colorée dans la page d'un compte.
  - Un virement planifié vers un compte supprimé est supprimé avec lui ; un virement passé garde
    son autre côté comme simple opération.
- **Montant variable** (salaire…) : case « Montant variable » d'une opération planifiée. Chaque
  échéance est créée avec un montant estimé (« ≈ 2 482,61 € » en italique, compté dans les
  soldes) et apparaît dans la carte **À confirmer** de l'accueil : un appui ouvre la saisie du
  montant reçu, clavier ouvert, pré-rempli avec l'estimation (« ✓ Correct » s'il est juste).
  L'estimation devient la **moyenne des 3 derniers montants confirmés**, et sert aux échéances
  suivantes et au solde prévisionnel. Modifier l'opération depuis son formulaire la confirme
  aussi.
- **Compte de secours** (réglage du compte) : « Si le solde ne suffit pas pour un paiement
  planifié, compléter depuis » un autre compte. À l'échéance d'une dépense planifiée, l'app
  regarde le solde du compte à cette date : s'il ne suffit pas, la dépense est enregistrée en
  entier et le manque arrive par un virement automatique « Complément automatique · … » depuis
  le compte de secours (paiement de 20 € avec 15 € de solde : 15 € pris sur le compte, 5 € sur
  le secours ; solde à zéro ou négatif : tout vient du secours). Le solde prévisionnel simule
  ces compléments. Non appliqué aux dépenses en débit différé (débitées plus tard) ni aux
  virements planifiés.
- **Carte à débit différé** (réglage du compte, crayon sur la page du compte) : jour d'arrêté
  des dépenses (ex. le 20, 31 = fin de mois) et jour de débit (dernier jour du mois, dernier
  jour ouvré, ou un jour fixe). Arrêté le 20, débit le dernier jour : une dépense du 13/11 est
  débitée le 30/11, une du 21/11 le 31/12.
  - Les dépenses gardent leur date dans l'historique, les listes et les statistiques ; chacune
    affiche en plus sa date de débit (« débit le 30/11 »).
  - Le solde du compte ne les retire qu'à la date de débit. D'ici là elles forment l'**encours**,
    affiché sur la tuile du compte et en haut de sa page.
  - L'onglet Opérations montre, pour le mois affiché, le total de chaque débit différé (déjà
    débité ou à venir) ; l'accueil liste les prochains débits et en tient compte dans le solde
    prévu en fin de mois.
  - Dans les formulaires (opération, planification, paiement en plusieurs fois), l'interrupteur
    « Débit différé (carte) » est activé par défaut pour une dépense de ce compte ; on le coupe
    pour une dépense débitée tout de suite (ex. un prélèvement).
  - Changer le réglage du compte recalcule la date de débit de toutes ses dépenses.
- **Paiement en plusieurs fois** (Plus › Opérations planifiées › Planifier, ou « Payer en
  plusieurs fois… » sous le formulaire d'une nouvelle opération, qui reprend montant, compte,
  catégorie et libellé) :
  - montant total, nombre de paiements, date du 1er paiement (aujourd'hui par défaut) puis
    date du paiement suivant et rythme (tous les N jours, semaines ou mois) ;
  - l'échéancier est calculé (les centimes en trop vont sur le 1er paiement) puis **chaque
    paiement se modifie séparément** : date, montant, retrait, ajout d'un paiement. Une fois une
    ligne modifiée, plus rien n'est recalculé automatiquement (bouton « Recalculer ») ;
  - un paiement daté d'aujourd'hui ou avant est enregistré tout de suite dans les opérations,
    les autres arrivent à leur date, marqués « paiement 2/4 » ;
  - la liste des planifications montre chaque paiement en plusieurs fois avec ses échéances,
    le nombre payé et le reste à payer. Les paiements déjà passés sont des opérations
    ordinaires, modifiables depuis l'onglet Opérations.

Les montants se saisissent en euros (`12,50` ou `12.50`) et sont stockés en centimes.

## Organisation du code

```
app/src/main/java/net/demipech/budget/
  BudgetApp.kt, MainActivity.kt   Application (dépôt partagé), activité Compose
  data/                           Room : entités, DAO, base, BudgetRepository,
                                  Backup.kt (sauvegarde JSON, testée)
  domain/Recurrence.kt            calcul des échéances (pur Kotlin, testé)
  domain/BusinessDays.kt          jours ouvrés et fériés français (testé)
  domain/Installments.kt          répartition d'un paiement en plusieurs fois (testé)
  domain/DeferredDebit.kt         date de débit d'une carte à débit différé (testé)
  domain/Analytics.kt             totaux mensuels, budgets, projection, recherche (testé)
  domain/Forecast.kt              échéances à venir, répartition par catégorie (testé)
  domain/Money.kt                 saisie et affichage des montants (testé)
  ui/                             navigation, thème, composants, un dossier par écran
                                  (home, operations, stats, more, accounts, categories, scheduled)
app/src/test/                     tests unitaires JVM
```

- `Operation` : une dépense ou rentrée réelle (montant positif + sens `EXPENSE`/`INCOME`).
- `ScheduledOperation` : une planification ; `generatedCount` compte les échéances déjà
  transformées en opérations, `occurrences = null` signifie sans fin.
- Les soldes sont calculés en SQL à partir des opérations, jamais stockés.

## Compiler

Avec le SDK Android installé :

```
cd budget
gradle testDebugUnitTest   # tests unitaires
gradle assembleDebug       # APK de debug
```

La base est en version 10. Les migrations de `BudgetDatabase` gardent les données d'une
installation existante : 1 → 2 ajoute la couleur et l'icône des comptes, l'emoji et la
catégorie parente des catégories ; 2 → 3 ajoute les règles de date des planifications ; 3 → 4 les paiements en plusieurs fois ; 4 → 5 le débit différé ; 5 → 6 les virements ; 6 → 7 le pointage ; 7 → 8 les budgets ; 8 → 9 le compte de secours ; 9 → 10 les montants variables.

## Pistes

Rappels (WorkManager + notification), export CSV, sauvegarde automatique, widget d'écran
d'accueil, import des relevés bancaires.
