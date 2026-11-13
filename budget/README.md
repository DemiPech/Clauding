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

Un mélange de Wallet (accueil en cartes) et de Money Manager (liste mensuelle). Thème clair ou
sombre selon le téléphone, accent corail, revenus en bleu et dépenses en rouge.

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

Les montants se saisissent en euros (`12,50` ou `12.50`) et sont stockés en centimes.

## Organisation du code

```
app/src/main/java/net/demipech/budget/
  BudgetApp.kt, MainActivity.kt   Application (dépôt partagé), activité Compose
  data/                           Room : entités, DAO, base, BudgetRepository
  domain/Recurrence.kt            calcul des échéances (pur Kotlin, testé)
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

La base est en version 2 : la migration 1 → 2 (`MIGRATION_1_2` dans `BudgetDatabase`) ajoute
la couleur et l'icône des comptes, l'emoji et la catégorie parente des catégories, sans perdre
les données d'une installation existante.

## Pistes

Virements entre comptes, recherche et filtres, vues « Mois » et « Total » de Money Manager,
détail d'une catégorie par sous-catégorie dans Stats, budgets mensuels, rappels
(WorkManager + notification), export CSV / sauvegarde.
