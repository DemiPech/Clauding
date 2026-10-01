# FaB Decks — version Android

Le Decklist Viewer (FaBrary + CardNexus) en application Android à installer par APK.
Mêmes écrans et mêmes fonctions que la version PC : decks FaBrary, decks d'inventaire
CardNexus, déplacement de cartes, montage d'une liste FaBrary dans CardNexus.

## Installer sur le téléphone

1. Ouvrir la page **Releases** du dépôt, release `apk-latest`
   (`https://github.com/<propriétaire>/<dépôt>/releases/tag/apk-latest`).
2. Télécharger `fab-decks.apk`, puis l'ouvrir. Android demande d'autoriser l'installation
   depuis le navigateur (« sources inconnues ») la première fois.
3. Au premier lancement, coller sa clé d'API CardNexus dans les réglages (⚙). Elle reste
   sur le téléphone ; les decks FaBrary fonctionnent sans.

Chaque push qui touche `android/` recompile l'APK (workflow `APK Android`) et remplace le
fichier de la release. Toutes les versions sont signées avec la même clé
(`app/decklist.keystore`), donc une mise à jour s'installe par-dessus l'ancienne sans
perdre la clé d'API.

## Navigation

Quatre onglets en bas de l'écran :

- **Collection** (l'accueil) : tous les emplacements sur une seule page, decks compris (avec
  leur héros et leur nombre de cartes). « Sans emplacement » est épinglé en tête tant qu'il
  reste des cartes à ranger. Un champ filtre par nom, et des filtres rapides sélectionnent
  Decks, Vracs, Kallax ou Classeurs. Toucher un emplacement l'ouvre. **Tirer vers le bas** en
  haut de la page, ou toucher ↻, relit les emplacements et les decks sans le cache de l'app
  (par exemple après en avoir créé un sur le site).
- **Chercher** : un seul champ. Un nom de carte montre où sont les exemplaires dans la
  collection, et on peut les déplacer depuis la barre du bas. Un lien de deck FaBrary (ou son
  identifiant de 26 caractères) ouvre la liste.
- **Outils** : Ranger les vracs, Monter une liste FaBrary, Comparer un deck à une liste
  (on y choisit le deck).
- **Historique** : journal de l'app, changements entre photos, modifié récemment.

Dans un deck ou un emplacement :

- **En-tête compact** : nom, nombre de cartes, et un menu **⋯** qui regroupe les actions
  secondaires (Voir sur FaBrary, Copier la decklist, Comparer, Renommer, Retirer les tags,
  Supprimer l'emplacement). Seule l'action principale d'une liste FaBrary, « Monter dans
  CardNexus », reste en vue.
- **Options** : Vue et Grouper par sur une ligne. En dessous, **Prendre** : Tout, Au-delà de N,
  + Depuis l'inventaire.
- **Barre du bas contextuelle** : elle n'apparaît qu'avec des cartes en main (ou le panneau
  « depuis l'inventaire » ouvert). Elle affiche « N en main », Tout reposer, la destination,
  Déplacer et Supprimer.

La barre du haut suit l'écran : le nom de l'onglet à la racine. Sur un écran ouvert par-dessus
(emplacement, deck, plan, rangement), elle affiche une flèche retour et le titre de l'écran. Les
choix exclusifs (Grille/Liste, les vues de l'Historique) sont des contrôles segmentés.

Un deck, un emplacement ou un plan de montage s'ouvre par-dessus l'onglet d'où l'on vient.
Le bouton retour du téléphone y ramène, puis ramène à la Collection, puis quitte l'app.

## Démarrage instantané et progression

- **Démarrage instantané** : l'app garde sur le téléphone la dernière liste des emplacements et
  des decks (héros, nombre de cartes). À l'ouverture, la Collection s'affiche tout de suite avec
  cette liste, puis se met à jour en arrière-plan, deck par deck. Hors ligne, la liste reste
  affichée. Elle est liée à la clé d'API : changer de compte ne montre pas l'ancien.
- **Progression** : tout chargement de plus d'un instant affiche une barre sous la barre du haut,
  avec ce qui se charge et le pourcentage : « Lecture de « Vrac 5 » · 45 % » puis
  « 200 / 450 lignes ». C'est le cas pour ouvrir un emplacement, compter les cartes, chercher,
  calculer un plan ou un rangement, déplacer ou supprimer des cartes, prendre une photo, etc.
  L'API CardNexus donne le nombre total de lignes, donc le pourcentage est exact.
- Quand CardNexus impose une pause (60 requêtes par minute), la barre l'indique avec un décompte :
  « Quota CardNexus atteint : reprise dans 8 s ».
- Une mise à jour en arrière-plan (au démarrage, photo automatique) s'affiche en plus discret,
  et l'écran reste utilisable pendant ce temps.

## Monter un deck : où chercher les cartes

La répartition proposée cherche à **visiter le moins d'endroits possible** :

1. d'abord dans la collection hors decks et hors cartes en vente, avec le plus petit ensemble
   d'endroits qui fournit tout ce qu'elle peut fournir ;
2. puis, seulement pour ce qui manque encore, dans d'autres decks ;
3. enfin dans les cartes en vente.

À chaque étape, les endroits déjà retenus sont gratuits : on n'en ajoute un que pour ce qu'ils
ne couvrent pas. La recherche est exacte jusqu'à 16 endroits candidats (les endroits
indispensables, seuls à avoir une carte, sont retenus d'office), puis gloutonne au-delà.
Une fois les endroits retenus, ils sont classés du plus fourni au moins fourni. Chaque carte vient
d'un seul endroit quand l'un d'eux en a assez : le mieux classé. Sinon, elle est prise d'abord dans
le mieux classé, et le reste ailleurs. Dans un même endroit, on prend d'abord les exemplaires
Standard et en meilleur état.

La case **« Éviter de prendre dans les autres decks »** (cochée par défaut) commande l'étape 2.
Décochée, un autre deck devient un endroit comme un autre. C'est utile pour reprendre en bloc un
deck qui contient déjà la liste. Quand un autre deck peut fournir au moins la moitié des cartes à
réunir, l'app le signale et propose « Tout prendre là-bas », qui décoche la case et recalcule.

Le récap **Où chercher** regroupe la sélection par endroit, le plus fourni en premier, avec
pour chaque carte le code d'impression, la finition, l'état et la langue. Il signale les
endroits qui sont d'autres decks, et liste à part les cartes **manquantes**. Il suit les
compteurs en direct. « Copier le récap » le met en texte dans le presse-papiers, et
« Revenir à la répartition optimisée » annule les retouches manuelles.

## Comparer un deck à une liste FaBrary

Sur un deck CardNexus, « Comparer à une liste FaBrary » demande l'URL d'une liste, puis ouvre
l'écran de montage avec ce deck pour destination. Il montre les deux sens :

- **Cartes de la liste** : ce qu'il faut faire entrer, pris ailleurs dans la collection
  (mêmes règles d'allocation que le montage), et ce qui manque. Les cartes déjà en place
  sont masquées par défaut, pour ne voir que les écarts.
- **En trop dans le deck** : les cartes absentes de la liste, ou en plus grand nombre. Les
  exemplaires proposés à la sortie sont d'abord ceux en vente, puis les plus abîmés : le deck
  garde ses meilleurs exemplaires. On choisit où les ranger (« Les ranger dans »).

Chaque ligne se déplie sur ses exemplaires, avec un compteur. « Déplacer les cartes » applique
les sorties puis les entrées. Le bandeau de confirmation propose d'annuler, et chaque carte
retourne alors d'où elle venait.

Le même calcul s'applique quand on monte une liste FaBrary dans un **deck existant** depuis
l'écran « Monter dans CardNexus ».

## Emplacements

Depuis l'accueil, **Emplacements** liste toutes les locations CardNexus, rangées en
« Vrac & autres », « Kallax », « Classeurs » et « Decks ». La nature d'un endroit se lit
à son icône (deck) et à son nom (kallax, classeur/binder/album).

- Toucher un endroit l'ouvre avec les outils d'un deck d'inventaire : prendre des cartes,
  les sortir vers un autre endroit, annuler. Le retour ramène aux Emplacements.
- Un emplacement qui n'est pas un deck s'affiche sans héros ni decklist : son nom, sa nature,
  son nombre de cartes, et toutes ses cartes (héros compris) d'un bloc.
- **Renommer** change le nom de l'emplacement, et les cartes restent en place.
  **Supprimer l'emplacement** propose d'abord de déplacer ses cartes ailleurs. Sinon, elles
  restent dans la collection sans emplacement ; aucune carte n'est jamais supprimée. Les deux
  valent aussi pour les decks.
- **Grouper par** : pitch, type, classe, talent, classe + talent (« Draconic Ninja »),
  extension (inventaire seulement) ou rien. Un emplacement de rangement s'ouvre groupé par
  classe et un deck par pitch. Un choix manuel vaut jusqu'à la prochaine ouverture.
- **« Sans emplacement »**, en tête de liste, montre les cartes qui n'ont aucun emplacement.
  Il s'ouvre comme un emplacement : on y prend des cartes et on les range ailleurs.
- **Prendre au-delà de N** (N entre 1 et 4, 3 par défaut) met en main tout ce qui dépasse N
  exemplaires par carte (même nom, même pitch). Avec 5, 6 et 2 exemplaires, on en prend 2, 3 et 0.
  Partent d'abord les exemplaires en vente, puis les plus abîmés, puis les Standard : les foils
  restent sur place. On choisit ensuite la destination dans la barre du bas.
- **Supprimer** (bouton rouge de la barre du bas) retire de la collection les cartes en main,
  après confirmation. On choisit comme pour un déplacement : « Tout prendre » pour tout, toucher
  une carte pour tous ses exemplaires, « + » pour un exemplaire à la fois. C'est définitif, et une
  carte en vente perd son annonce. Retirer une partie d'une ligne passe par un lot de baisses de
  quantité. Une ligne entière demande une requête `DELETE` à elle seule : l'API n'a pas de
  suppression en lot.
- Les tags s'affichent sur les exemplaires. **Retirer les tags** les enlève de toutes les
  lignes de la vue, et les tags restent définis dans le compte.
- La recherche trouve une carte dans toute la collection. On règle combien d'exemplaires
  prendre sur chaque ligne, puis on choisit la destination dans la barre du bas.

Le nombre de cartes d'un endroit s'affiche dès qu'il est connu (endroit ouvert, rangement
calculé). **Compter les cartes** compte toute la collection en un balayage (200 lignes par
requête) et indique aussi combien de cartes n'ont aucun emplacement.

## Importer des cartes

Outils → **Importer des cartes**, pour saisir un booster ou un achat :

- Choisir l'**extension**, la **langue** et l'**état**. Les extensions s'affichent comme dans la
  recherche de FaBrary : groupées par famille (Core Set, Armory Deck, Mastery Pack, History Pack,
  Silver Age, 1st Strike, Blitz Deck, Welcome Deck, Classic Battles, Round the Table, Hero Deck,
  Promo, Autres), par ordre alphabétique dans chaque groupe, avec un champ pour filtrer. La famille
  se déduit du nom (`js/expansions.js`) ; une grosse extension inconnue compte comme Core Set.
- Les cartes suivent par défaut l'**ordre des numéros de print**. L'ordre se choisit : par
  numéro, par rareté (des communes aux plus rares), par nom, par pitch ou par type ; le choix est
  gardé. Des filtres rapides n'affichent qu'une ou plusieurs raretés, et un champ filtre par nom
  ou numéro. Les **tokens** et les **basiques** sont à part (ni avec les communes, ni dans le
  compte d'un booster) : un token se reconnaît à son type, un basique à la rareté de ses
  attributs, même quand CardNexus les classe en « Common ».
- **Toucher une carte** en ajoute un exemplaire. **+3**, **−1** et **Retirer** (✕) ajustent.
- La **finition** (Standard, Rainbow, Cold, Gold) se choisit au-dessus de la liste et se compte à
  part ; une carte rappelle ce qui est déjà compté dans les autres finitions.
- La barre du bas affiche le total, l'emplacement de destination et **Ajouter**. La destination
  peut être un emplacement existant, « Sans emplacement », ou **+ Nouvel emplacement…** : on tape
  son nom et il est créé au moment d'ajouter. Une carte déjà présente à l'identique au même endroit voit sa ligne grossir.
- Le comptage est gardé sur le téléphone tant qu'il n'est pas ajouté : quitter l'écran ou l'app
  ne le perd pas. **Tout effacer** demande confirmation.
- Un import s'**annule** depuis le bandeau ou l'Historique : seuls les exemplaires ajoutés sont
  retirés.

## Ranger les vracs

**Ranger les vracs** propose un plan pour regrouper les cartes dans les endroits cochés.
Par défaut, c'est tout ce qui n'est ni deck, ni Kallax, ni classeur ; le choix est mémorisé.

- **Par nom** : toutes les copies d'une carte, pitchs confondus, rejoignent l'endroit qui en
  a déjà le plus.
- **Par classe**, **talent**, **classe + talent** ou **extension** : même règle pour les noms, et chaque groupe occupe en
  plus le moins d'endroits possible. Les plus gros groupes sont placés d'abord, dans les
  endroits où ils sont déjà. Chaque boîte garde à peu près son remplissage actuel (+5 %).

Un nom de carte n'est jamais coupé entre deux endroits. Le plan montre le contenu de chaque
endroit après rangement, puis les déplacements trajet par trajet (« Vrac 3 → Vrac 1 »). On peut
le copier en texte et l'appliquer d'un geste, annulable depuis le bandeau.

La logique est dans `js/tidy.js`, sans accès réseau, donc testable seule.

## Historique

L'API CardNexus n'a pas d'historique d'inventaire. Une ligne ne donne que sa date de dernière
modification (`updatedAt`), et les webhooks ne signalent que les changements de quantité, vers
un serveur. L'écran **Historique** combine donc deux sources :

- **Journal de l'app** : chaque action faite depuis l'app (déplacement, montage, rangement,
  suppression de cartes, retrait des tags, renommage et suppression d'emplacement), avec sa
  date et son détail carte par carte. Il est gardé sur le téléphone (300 dernières actions).
  Un déplacement peut encore y être annulé : chaque carte retourne à son emplacement d'origine.
- **Changements** : l'app photographie la collection, c'est-à-dire combien d'exemplaires de
  chaque carte (finition, état, langue) il y a à chaque endroit. Elle compare ensuite chaque
  photo à la précédente : cartes **ajoutées**, **supprimées ou vendues**, **déplacées**. Cela
  couvre aussi ce qui est fait sur le site. La photo est prise automatiquement à l'ouverture
  quand la dernière date de plus de 24 h (réglable dans ⚙ : 12 h, 1 jour, 3 jours, 1 semaine,
  jamais), ou à la demande. Seules la dernière photo et les différences sont gardées sur le
  téléphone. Le calcul (`js/snapshots.js`) compte par carte et par endroit plutôt que par
  ligne : un déplacement partiel coupe une ligne et une arrivée peut fusionner, donc les
  identifiants de ligne changent sans que la collection change.
- **Modifié récemment** : les lignes de la collection, de la plus récemment modifiée à la plus
  ancienne, y compris ce qui est fait sur le site, mais sans dire ce qui a changé.

## Flesh and Blood seulement

L'app ne traite que Flesh and Blood. Chaque lecture de l'inventaire passe le filtre de jeu de
l'API (`gameFilters: { game: "fab" }` sur la recherche, `game=fab` sur la lecture au curseur).
Les cartes des autres jeux restent invisibles et intactes. Elles ne sont ni comptées, ni
rangées, ni comparées entre deux photos. Seule exception, la suppression d'un emplacement
avertit s'il contient encore des lignes d'autres jeux, car elles perdraient leur emplacement.

## API CardNexus

Référence : https://docs.cardnexus.com/ (`llms.txt` liste les pages, `reference/openapi.json`
décrit chaque route).

- Les lectures d'endroits passent par `POST /inventory/search` : 200 lignes par page contre 100
  pour `GET /inventory`, et jusqu'à 50 endroits dans une même requête (filtre `location` en
  `op: "or"`). Elle pagine par position, dans la limite de 10 000 lignes.
- Limite : 60 requêtes par minute et par compte. L'app s'auto-limite à 55. Sur un `429`, elle
  attend la durée indiquée par `Retry-After` et rejoue la requête, jusqu'à 3 fois. Les écritures
  gardent leur `Idempotency-Key`, donc une reprise ne s'applique qu'une fois.

## Comment c'est fait

Pas de serveur Node sur le téléphone : l'app est une WebView qui embarque l'interface web.

```
app/src/main/java/.../MainActivity.java   WebView + pont natif (HTTP, presse-papiers, liens)
app/src/main/assets/www/
  index.html, styles.css                  interface, adaptée au mobile
  js/app.js                               point d'entrée : retour Android, événements, démarrage
  js/ui/                                  l'interface, un module par partie :
    core.js                               éléments de la page, état partagé, libellés
    nav.js                                onglets, barre du haut, liste des decks
    deck-view.js                          affichage d'un deck ou d'un emplacement, menu ⋯
    moves.js                              cartes en main, barre du bas, déplacements, annulation
    build.js                              monter une liste, récap « où chercher »
    deck-tools.js                         export texte, aperçu, réglages, comparer
    places.js                             onglet Collection, tirer pour actualiser
    tidy-view.js                          ranger les vracs
    sheets.js                             confirmations, suppression, tags, renommer
    history.js                            onglet Historique, photos de la collection
    import-view.js                        importer des cartes d'une extension
    progress-view.js                      barre de progression en haut
    collection-cache.js                   liste gardée pour le démarrage instantané
  js/tidy.js, js/snapshots.js             calculs sans réseau (rangement, photos)
  js/progress.js                          avancement des chargements (tâches, pourcentages)
  js/api.js                               remplace server.js : répond aux fetch('/api/…')
  js/fabrary.js, js/cardnexus.js          les clients de lib/, portés au navigateur
  js/http.js                              requêtes sortantes via le pont natif
```

- `api.js` intercepte les appels `fetch('/api/…')` et y répond localement, avec les mêmes
  routes, handlers et cache que `server.js`.
- Les appels vers CardNexus et FaBrary passent par Java (`AndroidApp.request`). Ils échappent
  ainsi au CORS du navigateur, et peuvent porter les en-têtes `Origin` / `Referer` /
  `User-Agent` exigés par le WAF de FaBrary.
- La signature SigV4 de FaBrary utilise WebCrypto au lieu de `node:crypto`. Elle produit
  exactement les mêmes signatures que la version PC.
- L'interface est servie sous `https://appassets.androidplatform.net/` (interceptée,
  jamais réseau) : c'est un contexte sécurisé, nécessaire pour WebCrypto et les modules ES.

Ajouts propres au mobile :

- **Réglages (⚙)** : saisie de la clé CardNexus, à la place de `api_key.txt`.
- **Carte en grand** : toucher une carte (deck FaBrary) ou appui long (deck d'inventaire,
  où le toucher sert à prendre la carte) l'affiche en plein écran.
- **Bouton retour** : ferme ce qui est ouvert, remonte d'une vue, et quitte depuis l'accueil.
- **Liens externes** (« Voir sur FaBrary ») : ouverts dans le navigateur du téléphone.

## Tests

Les tests sont dans `tests/` et tournent sur GitHub à chaque push : si l'un échoue,
l'APK n'est pas publié (l'ancien reste en ligne).

- `tests/unit/` : les calculs seuls (`node:test`) — répartition des cartes à prendre
  (le moins d'endroits possible), plan de rangement, comparaison des photos.
- `tests/e2e/` : l'interface dans Chromium (Playwright), comme dans la WebView.
  `helpers/mock-bridge.js` remplace le pont natif par un faux FaBrary et un faux
  inventaire CardNexus en mémoire ; chaque test vérifie l'inventaire obtenu après ses
  actions (prendre, déplacer, annuler, monter, comparer, ranger, supprimer, renommer…).

```bash
cd android/tests
npm ci
npx playwright install chromium   # une fois
npm test                          # ou npm run test:unit / npm run test:e2e
```

## Compiler soi-même

JDK 17, SDK Android (plateforme 34) et Gradle 8.7+ :

```bash
cd android
gradle assembleRelease   # → app/build/outputs/apk/release/app-release.apk
```
