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

## Fonctions

Quatre onglets :

- **Comptes** : solde total et solde de chaque compte (solde initial + rentrées − dépenses).
  Toucher un compte ouvre ses opérations ; le crayon permet de le renommer, de changer son
  solde initial ou de le supprimer (avec ses opérations et planifications).
- **Opérations** : toutes les dépenses et rentrées, groupées par jour, avec le bilan du mois.
  Le bouton + ajoute une opération (sens, montant, compte, catégorie, date, note) ; toucher
  une opération la modifie ou la supprime.
- **Planifié** : opérations futures.
  - *Répéter : Non* → une échéance unique à une date donnée.
  - *Chaque jour / semaine / mois / année*, « tous les N », qui se termine **jamais** ou
    **après N fois**.
  - Les échéances arrivées à terme deviennent de vraies opérations (marquées « planifiée ») à
    chaque ouverture de l'app. Une date de départ passée crée tout de suite les échéances passées.
  - Modifier une série agit sur la suite : la date affichée est la prochaine échéance et le
    nombre celui des échéances restantes. Supprimer une série garde les opérations déjà créées.
  - Une série mensuelle commencée un 31 tombe le dernier jour des mois courts.
- **Catégories** : catégories de dépenses et de rentrées, avec une couleur. Un jeu de
  catégories est créé au premier lancement. Supprimer une catégorie garde ses opérations,
  sans catégorie.

Les montants se saisissent en euros (`12,50` ou `12.50`) et sont stockés en centimes.

## Organisation du code

```
app/src/main/java/net/demipech/budget/
  BudgetApp.kt, MainActivity.kt   Application (dépôt partagé), activité Compose
  data/                           Room : entités, DAO, base, BudgetRepository
  domain/Recurrence.kt            calcul des échéances (pur Kotlin, testé)
  domain/Money.kt                 saisie et affichage des montants (testé)
  ui/                             navigation, thème, composants, un dossier par écran
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

Le schéma Room est exporté dans `app/schemas/` à la compilation : à versionner dès qu'il faudra
écrire une migration (passage de `version = 1` à `2` dans `BudgetDatabase`).

## Pistes

Virements entre comptes, recherche et filtres (période, catégorie), statistiques par
catégorie, budgets mensuels, solde prévisionnel avec les échéances à venir, rappels
(WorkManager + notification), export CSV / sauvegarde.
