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

## Comment c'est fait

Pas de serveur Node sur le téléphone : l'app est une WebView qui embarque l'interface web.

```
app/src/main/java/.../MainActivity.java   WebView + pont natif (HTTP, presse-papiers, liens)
app/src/main/assets/www/
  index.html, styles.css                  interface, adaptée au mobile
  js/app.js                               l'app.js du PC, avec quelques ajouts mobiles
  js/api.js                               remplace server.js : répond aux fetch('/api/…')
  js/fabrary.js, js/cardnexus.js          les clients de lib/, portés au navigateur
  js/http.js                              requêtes sortantes via le pont natif
```

- `api.js` intercepte les appels `fetch('/api/…')` et y répond localement, avec les mêmes
  routes, handlers et cache que `server.js` : `app.js` reste presque identique au PC.
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

## Compiler soi-même

JDK 17, SDK Android (plateforme 34) et Gradle 8.7+ :

```bash
cd android
gradle assembleRelease   # → app/build/outputs/apk/release/app-release.apk
```
